import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { embeddingService } from '../../projects/[id]/hooks/embedding-service';

// Simple test endpoint
export async function GET() {
  return NextResponse.json({ message: 'Document parsing API is working' });
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== DOCUMENT PARSING STARTED ===');
    
    const { filePath, fileName, projectId, knowledgeId, skipEmbeddings } = await request.json();
    console.log(`Processing: ${fileName}, Skip embeddings: ${skipEmbeddings}`);

    if (!filePath || !fileName) {
      return NextResponse.json({ error: 'Missing filePath or fileName' }, { status: 400 });
    }

    if (!projectId || !knowledgeId) {
      return NextResponse.json({ error: 'Missing projectId or knowledgeId' }, { status: 400 });
    }

    // Create server-side Supabase client
    const supabase = createServerSupabaseClient();

    // Download file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('project-knowledge')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError.message);
      return NextResponse.json({ error: `Failed to download file: ${downloadError.message}` }, { status: 400 });
    }

    if (!fileData) {
      return NextResponse.json({ error: 'No file data received' }, { status: 400 });
    }

    console.log(`File downloaded: ${fileData.size} bytes`);

    // Determine file type and parse accordingly
    const fileExtension = fileName.toLowerCase().split('.').pop();
    let rawText = '';
    let numPages = 1;
    let documentInfo = null;

    if (fileExtension === 'docx') {
      // Parse DOCX file using mammoth
      try {
        const mammoth = await import('mammoth');
        
        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Validate that this is actually a DOCX file by checking the file signature
        const isDocx = buffer.length >= 4 && 
          buffer[0] === 0x50 && buffer[1] === 0x4B && 
          buffer[2] === 0x03 && buffer[3] === 0x04;
        
        if (!isDocx) {
          console.warn('File does not have valid DOCX signature - may be corrupted or renamed');
          rawText = `Invalid DOCX file: ${fileName}\n\nThis file appears to be corrupted or may be a PDF that was renamed to .docx.\n\nFile size: ${fileData.size} bytes\n\nPlease ensure you're uploading a valid DOCX file created by Microsoft Word or similar applications.`;
          documentInfo = {
            title: fileName,
            author: 'Unknown',
            subject: 'Invalid DOCX File',
            creator: 'File Upload System',
            producer: 'Pretium Knowledge Management'
          };
        } else {
          const result = await mammoth.extractRawText({ buffer });
          const fullText = result.value;
          
          // Extract only specific sections
          const extractedText = extractSpecificSections(fullText, fileName);
          rawText = extractedText;
          
          // Get document metadata
          const metadata = await mammoth.extractRawText({ buffer });
          documentInfo = {
            title: fileName,
            author: 'Unknown',
            subject: 'DOCX Document',
            creator: 'Microsoft Word',
            producer: 'Mammoth Parser'
          };
          
          console.log(`DOCX parsed: ${fullText.length} chars total, ${rawText.length} chars extracted`);
          
          if (rawText.length < 100) {
            console.warn('Very little text extracted from specified sections');
          }
        }
        
      } catch (parseError: any) {
        console.error('DOCX parsing failed:', parseError);
        
        // Provide more helpful error messages
        if (parseError.message && parseError.message.includes('zip')) {
          rawText = `Invalid DOCX file: ${fileName}\n\nThis file appears to be corrupted or may be a PDF that was renamed to .docx.\n\nFile size: ${fileData.size} bytes\nError: ${parseError.message}\n\nPlease ensure you're uploading a valid DOCX file created by Microsoft Word or similar applications.`;
        } else {
          rawText = `DOCX content could not be parsed. File size: ${fileData.size} bytes. Error: ${parseError?.message || 'Unknown error'}`;
        }
        
        documentInfo = {
          title: fileName,
          author: 'Unknown',
          subject: 'DOCX Parsing Error',
          creator: 'File Upload System',
          producer: 'Pretium Knowledge Management'
        };
      }
      
    } else if (fileExtension === 'pdf') {
      // For PDFs, use the placeholder approach for now
      rawText = `PDF Document: ${fileName}\n\nThis PDF has been uploaded successfully but text extraction is temporarily disabled due to library compatibility issues.\n\nFile size: ${fileData.size} bytes\nUploaded: ${new Date().toISOString()}\n\nTo extract text from this PDF, you can:\n1. Convert to DOCX format and re-upload\n2. Use the document viewer in your browser\n3. Copy text manually from the PDF\n4. Use external PDF text extraction tools\n\nThis document is stored in your knowledge base and can be referenced by filename.`;
      
      documentInfo = {
        title: fileName,
        author: 'Unknown',
        subject: 'PDF Document',
        creator: 'PDF Upload System',
        producer: 'Pretium Knowledge Management'
      };
      
      console.log(`PDF processed (placeholder): ${fileData.size} bytes`);
      
    } else {
      // Unsupported file type
      rawText = `Unsupported file type: ${fileExtension}\n\nFile: ${fileName}\nSize: ${fileData.size} bytes\n\nSupported formats: DOCX, PDF`;
      documentInfo = {
        title: fileName,
        author: 'Unknown',
        subject: 'Unsupported File Type',
        creator: 'File Upload System',
        producer: 'Pretium Knowledge Management'
      };
    }

    console.log(`Document processed: ${fileExtension}, ${fileData.size} bytes, ${rawText.length} chars`);

    // Create chunks from the raw text
    const chunks = createSimpleChunks(rawText, fileName);
    const sections = [{
      title: fileExtension === 'docx' ? "Document Content" : "Document Information",
      content: rawText,
      level: 1
    }];

    // Process embeddings and store in database
    if (!skipEmbeddings) {
      console.log('Starting embedding processing...');
      try {
        await embeddingService.processAndStoreEmbeddings(
          projectId,
          knowledgeId,
          rawText,
          fileName
        );
        console.log('Embedding processing completed');
      } catch (embeddingError) {
        console.error('Embedding processing failed:', embeddingError);
        // Continue with the response even if embedding fails
        // The chunks are still available for immediate use
      }
    } else {
      console.log('Skipping embedding processing (test mode)');
    }

    const result = {
      content: rawText,
      sections: sections,
      chunks: chunks,
      metadata: {
        fileName: fileName,
        fileType: fileExtension,
        fileSize: fileData.size,
        numPages: numPages,
        extractedAt: new Date().toISOString(),
        documentInfo: documentInfo,
        note: fileExtension === 'docx' ? 'Text extracted successfully' : 'Text extraction limited for this file type'
      }
    };

    console.log(`Parsing completed: ${sections.length} sections, ${chunks.length} chunks`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Document processing error:', error);
    return NextResponse.json(
      { error: `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * Create simple chunks from raw text
 */
function createSimpleChunks(text: string, fileName: string): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  
  let currentChunk = `Document: ${fileName}\n\n`;
  
  for (const sentence of sentences) {
    const sentenceWithPunctuation = sentence.trim() + '.';
    
    if (currentChunk.length + sentenceWithPunctuation.length > 1000) {
      if (currentChunk.length > 50) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = `Document: ${fileName}\n\n${sentenceWithPunctuation}`;
    } else {
      currentChunk += (currentChunk.length > 50 ? ' ' : '') + sentenceWithPunctuation;
    }
  }
  
  // Add the last chunk
  if (currentChunk.length > 50) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Parse technical document into sections and chunks optimized for RAG
 */
function parseTechnicalDocument(text: string, fileName: string) {
  const sections: any[] = [];
  const chunks: string[] = [];

  // Split text into lines and process
  const lines = text.split('\n').map(line => line.trim()).filter((line: string) => line.length > 0);
  
  let currentSection: any = null;
  let currentContent: string[] = [];
  let sectionLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect section headers (common patterns in technical docs)
    const isHeader = detectSectionHeader(line);
    
    if (isHeader) {
      // Save previous section if exists
      if (currentSection && currentContent.length > 0) {
        currentSection.content = currentContent.join('\n');
        sections.push(currentSection);
        
        // Create chunks from this section
        const sectionChunks = createChunksFromSection(currentSection);
        chunks.push(...sectionChunks);
      }
      
      // Start new section
      const level = determineHeaderLevel(line);
      currentSection = {
        title: line,
        content: '',
        level: level,
        pageNumber: null // Could be determined if needed
      };
      currentContent = [];
      sectionLevel = level;
    } else {
      // Add content to current section
      if (currentSection) {
        currentContent.push(line);
      }
    }
  }

  // Handle the last section
  if (currentSection && currentContent.length > 0) {
    currentSection.content = currentContent.join('\n');
    sections.push(currentSection);
    
    const sectionChunks = createChunksFromSection(currentSection);
    chunks.push(...sectionChunks);
  }

  // If no sections were detected, create chunks from the whole text
  if (sections.length === 0) {
    const fallbackChunks = createChunksFromText(text, fileName);
    chunks.push(...fallbackChunks);
    
    sections.push({
      title: "Document Content",
      content: text,
      level: 1
    });
  }

  return { sections, chunks };
}

/**
 * Detect if a line is a section header
 */
function detectSectionHeader(line: string): boolean {
  // Common patterns in technical documents
  const headerPatterns = [
    /^\d+\.\s+/, // 1. Section
    /^\d+\.\d+\s+/, // 1.1 Subsection
    /^\d+\.\d+\.\d+\s+/, // 1.1.1 Sub-subsection
    /^[A-Z][A-Z\s]{2,}$/, // ALL CAPS HEADERS
    /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*$/, // Title Case Headers
    /^Section\s+\d+/i, // Section 1
    /^Part\s+\d+/i, // Part 1
    /^Chapter\s+\d+/i, // Chapter 1
    /^Appendix\s+[A-Z]/i, // Appendix A
    /^Table\s+\d+/i, // Table 1
    /^Figure\s+\d+/i, // Figure 1
    /^Specification\s+\d+/i, // Specification 1
    /^Requirements?\s+\d+/i, // Requirements 1
    /^Materials?\s+\d+/i, // Materials 1
    /^Installation\s+\d+/i, // Installation 1
    /^Testing\s+\d+/i, // Testing 1
    /^Quality\s+Control/i, // Quality Control
    /^Safety\s+Requirements/i, // Safety Requirements
  ];

  return headerPatterns.some(pattern => pattern.test(line));
}

/**
 * Determine the level of a header
 */
function determineHeaderLevel(line: string): number {
  if (/^\d+\.\d+\.\d+\s+/.test(line)) return 3;
  if (/^\d+\.\d+\s+/.test(line)) return 2;
  if (/^\d+\.\s+/.test(line)) return 1;
  if (/^[A-Z][A-Z\s]{2,}$/.test(line)) return 1; // ALL CAPS
  return 1; // Default
}

/**
 * Create chunks from a section with context preservation
 */
function createChunksFromSection(section: any): string[] {
  const chunks: string[] = [];
  const content = section.content;
  
  if (content.length <= 1000) {
    // Small section - keep as single chunk with header
    chunks.push(`${section.title}\n\n${content}`);
    return chunks;
  }

  // Large section - split into chunks while preserving context
  const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  let currentChunk = `${section.title}\n\n`;
  
  for (const sentence of sentences) {
    const sentenceWithPunctuation = sentence.trim() + '.';
    
    if (currentChunk.length + sentenceWithPunctuation.length > 1000) {
      if (currentChunk.length > section.title.length + 10) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = `${section.title}\n\n${sentenceWithPunctuation}`;
    } else {
      currentChunk += (currentChunk.length > section.title.length + 10 ? ' ' : '') + sentenceWithPunctuation;
    }
  }
  
  // Add the last chunk
  if (currentChunk.length > section.title.length + 10) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Create chunks from raw text when no sections are detected
 */
function createChunksFromText(text: string, fileName: string): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = `Document: ${fileName}\n\n`;
  
  for (const sentence of sentences) {
    const sentenceWithPunctuation = sentence.trim() + '.';
    
    if (currentChunk.length + sentenceWithPunctuation.length > 1000) {
      if (currentChunk.length > 50) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = `Document: ${fileName}\n\n${sentenceWithPunctuation}`;
    } else {
      currentChunk += (currentChunk.length > 50 ? ' ' : '') + sentenceWithPunctuation;
    }
  }
  
  // Add the last chunk
  if (currentChunk.length > 50) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Extract specific sections from the full text
 */
function extractSpecificSections(fullText: string, fileName: string): string {
  const targetKeywords = [
    'PRODUCTS',
    'EXECUTION'
  ];

  let extractedText = `Document: ${fileName}\n\nExtracted Sections:\n\n`;
  let foundSections = 0;

  for (const keyword of targetKeywords) {
    const keywordStart = fullText.indexOf(keyword);
    if (keywordStart !== -1) {
      foundSections++;
      
      // Find the start of the section (look backwards for PART or section header)
      let sectionStart = keywordStart;
      const beforeText = fullText.substring(0, keywordStart);
      const partMatch = beforeText.match(/PART\s+\d+[^-\n]*$/m);
      if (partMatch) {
        sectionStart = fullText.lastIndexOf(partMatch[0], keywordStart);
      }
      
      // Find the end of this section by looking for the next major section
      let sectionEnd = fullText.length;
      const nextSectionStart = fullText.indexOf('PART ', keywordStart + keyword.length);
      if (nextSectionStart !== -1) {
        sectionEnd = nextSectionStart;
      }
      
      // Extract the full section content
      const sectionContent = fullText.substring(sectionStart, sectionEnd).trim();
      extractedText += `${sectionContent}\n\n`;
    }
  }

  if (foundSections === 0) {
    extractedText += `No target sections found in document.\n\nAvailable sections may include:\n`;
    // Look for any PART sections to help user
    const partMatches = fullText.match(/PART \d+[^-\n]*/g);
    if (partMatches) {
      extractedText += partMatches.slice(0, 5).join('\n');
    }
    
    // Also look for PRODUCTS and EXECUTION keywords
    const productsIndex = fullText.indexOf('PRODUCTS');
    const executionIndex = fullText.indexOf('EXECUTION');
    if (productsIndex !== -1 || executionIndex !== -1) {
      extractedText += `\n\nFound keywords at positions:\n`;
      if (productsIndex !== -1) extractedText += `PRODUCTS at position ${productsIndex}\n`;
      if (executionIndex !== -1) extractedText += `EXECUTION at position ${executionIndex}\n`;
    }
  }

  return extractedText.trim();
} 