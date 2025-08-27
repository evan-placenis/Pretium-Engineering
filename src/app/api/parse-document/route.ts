import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { embeddingService, DocxChunk } from '../../projects/[id]/hooks/embedding-service';
import jszip from 'jszip';
import { xml2js, Element } from 'xml-js';

// --- NEW XML-BASED DOCX PARSER ---

// DocxChunk interface is now imported from embedding-service

const CHUNK_CHAR_LIMIT = 4000;

function isElement(node: any): node is Element {
    return node && typeof node === 'object' && node.type === 'element';
}

function findAllTextNodes(element: Element | undefined, texts: string[]): void {
    if (!element) return;

    if (element.name === 'w:t' && element.elements) {
        const textElement = element.elements.find(e => e.type === 'text');
        if (textElement && typeof textElement.text === 'string') {
            texts.push(textElement.text);
        }
    }

    if (element.elements) {
        for (const child of element.elements) {
            findAllTextNodes(child, texts);
        }
    }
}

function extractTextFromParagraph(pNode: Element): string {
    const texts: string[] = [];
    findAllTextNodes(pNode, texts);
    return texts.join('');
}

function getParagraphStyle(pNode: Element): string | null {
    const pPr = pNode.elements?.find(el => el.name === 'w:pPr');
    if (isElement(pPr)) {
        const pStyle = pPr.elements?.find(el => el.name === 'w:pStyle');
        if (isElement(pStyle) && pStyle.attributes) {
            return pStyle.attributes['w:val'] as string || null;
        }
    }
    return null;
}

async function parseDocxFromXml(buffer: Buffer): Promise<{ chunks: DocxChunk[]; rawText: string }> {
    const zip = await jszip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');

    if (!docXmlFile) {
        throw new Error('word/document.xml not found in the DOCX file.');
    }

    const docXml = await docXmlFile.async('string');
    const docJs = xml2js(docXml, { compact: false }) as Element;

    const documentNode = docJs.elements?.find(el => el.name === 'w:document');
    const body = documentNode?.elements?.find(el => el.name === 'w:body');

    if (!isElement(body) || !body.elements) {
        throw new Error('Could not find w:body in document.xml.');
    }

    const chunks: DocxChunk[] = [];
    let currentPA1: string | null = null;
    let currentPA2Chunk: { title: string; content: string[] } | null = null;
    let inAllowedPart = false;
    let rawTextParts: string[] = [];

    const flushPA2Chunk = () => {
        if (currentPA2Chunk) {
            const chunkToFlush = currentPA2Chunk; // Create a new constant for the non-null chunk
            const fullContent = chunkToFlush.content.join('\n').trim();
            if (fullContent) {
                if (fullContent.length > CHUNK_CHAR_LIMIT) {
                    // Split chunk if it's too large
                    const splitContent = splitText(fullContent, CHUNK_CHAR_LIMIT);
                    splitContent.forEach((part, index) => {
                        const title = `${chunkToFlush.title} (${index + 1})`; // Use the new non-null constant
                        const words = part.split(/\s+/).length;
                        console.log(`[Parser] PA2 "${title}" — ${words} words, ${part.length} chars (${currentPA1})`);
                        chunks.push({ title, content: part, words, chars: part.length });
                    });
                } else {
                    const words = fullContent.split(/\s+/).length;
                    console.log(`[Parser] PA2 "${chunkToFlush.title}" — ${words} words, ${fullContent.length} chars (${currentPA1})`);
                    chunks.push({ title: chunkToFlush.title, content: fullContent, words, chars: fullContent.length });
                }
            }
        }
        currentPA2Chunk = null;
    };

    const processNode = (node: Element) => {
        if (node.name === 'w:p') {
            const style = getParagraphStyle(node);
            const text = extractTextFromParagraph(node);

            if (style === 'PA1') {
                const upperCaseText = text.toUpperCase();
                // Only update the section state if the PA1 paragraph actually contains text
                if (upperCaseText.trim().length > 0) {
                    flushPA2Chunk();
                    currentPA1 = text;
                    inAllowedPart = upperCaseText.includes('PRODUCTS') || upperCaseText.includes('EXECUTION');
                    if (!inAllowedPart) {
                        console.log(`Skipping Section: "${text}"`);
                    }
                }
                // If the PA1 paragraph is empty, do nothing and maintain the current state.
            } else if (style === 'PA2' && inAllowedPart) {
                flushPA2Chunk();
                currentPA2Chunk = { title: text, content: [] };
            } else if (inAllowedPart && currentPA2Chunk) {
                if (text) currentPA2Chunk.content.push(text);
            }
             if (inAllowedPart && text) {
                rawTextParts.push(text);
            }
        } else if (node.name === 'w:tbl') {
            if (inAllowedPart && currentPA2Chunk) {
                node.elements?.forEach(tr => { // w:tr
                    if (isElement(tr)) {
                        tr.elements?.forEach(tc => { // w:tc
                            if (isElement(tc)) {
                                tc.elements?.forEach(p => { // w:p
                                    if(isElement(p) && p.name === 'w:p') {
                                        const text = extractTextFromParagraph(p);
                                        if (text && currentPA2Chunk) {
                                            currentPA2Chunk.content.push(text);
                                        }
                                        if(inAllowedPart && text) rawTextParts.push(text);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }
    };

    body.elements.forEach(processNode);
    flushPA2Chunk();
    
    return { chunks, rawText: rawTextParts.join('\n') };
}

function splitText(text: string, maxLength: number): string[] {
    const parts: string[] = [];
    let currentPart = '';
    const sentences = text.split(/(?<=\.|\n)/); // Split by sentences or newlines

    for (const sentence of sentences) {
        if (currentPart.length + sentence.length > maxLength) {
            parts.push(currentPart.trim());
            currentPart = sentence;
        } else {
            currentPart += sentence;
        }
    }
    if (currentPart) {
        parts.push(currentPart.trim());
    }
    return parts;
}

// --- API ROUTE HANDLER ---

export async function POST(request: NextRequest) {
  try {
    console.log('=== DOCUMENT PARSING STARTED (XML) ===');
    
    const { filePath, fileName, projectId, knowledgeId, skipEmbeddings } = await request.json();
    console.log(`Processing: ${fileName}`);

    if (!filePath || !fileName || !projectId || !knowledgeId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('project-knowledge')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError?.message);
      return NextResponse.json({ error: 'Failed to download file' }, { status: 400 });
    }
    console.log(`File downloaded: ${fileData.size} bytes`);

    const buffer = Buffer.from(await fileData.arrayBuffer());

    if (!fileName.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Unsupported file type. Only .docx files are supported.' }, { status: 400 });
    }

    const { chunks, rawText } = await parseDocxFromXml(buffer);

    if (!skipEmbeddings) {
      console.log('Starting embedding processing...');
      try {
        await embeddingService.processAndStoreEmbeddings(
          projectId,
          knowledgeId,
          chunks,
          fileName
        );
        console.log('Embedding processing completed');
      } catch (embeddingError) {
        console.error('Embedding processing failed:', embeddingError);
      }
    }

    const sections = chunks.map(chunk => ({
      title: chunk.title,
      content: chunk.content,
      level: 2 
    }));

    const responsePayload = {
      content: rawText,
      sections: sections,
      chunks: chunks.map(c => `Document: ${fileName}\nSection: ${c.title}\n\n${c.content}`),
      metadata: {
        fileName: fileName,
        fileType: 'docx',
        fileSize: fileData.size,
        extractedAt: new Date().toISOString(),
        documentInfo: { title: fileName, creator: 'XML Parser' },
      }
    };

    console.log(`Parsing completed: ${sections.length} sections, ${chunks.length} chunks`);
    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('Document processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Document processing failed: ${errorMessage}` }, { status: 500 });
  }
} 