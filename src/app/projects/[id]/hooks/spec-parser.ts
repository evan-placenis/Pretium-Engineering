import { supabase } from '../../../../lib/supabase';

export interface ParsedSpec {
  content: string;
  sections: SpecSection[];
  chunks: string[];
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    extractedAt: Date;
  };
}

export interface SpecSection {
  title: string;
  content: string;
  level: number;
  pageNumber?: number;
}

export class SpecParser {
  private static instance: SpecParser;

  private constructor() {}

  public static getInstance(): SpecParser {
    if (!SpecParser.instance) {
      SpecParser.instance = new SpecParser();
    }
    return SpecParser.instance;
  }

  /**
   * Extract text content from a file stored in Supabase storage
   * Supports both PDF and DOCX files
   */
  async extractTextFromFile(filePath: string, fileName: string, projectId?: string, knowledgeId?: string, skipEmbeddings: boolean = false): Promise<ParsedSpec> {
    try {
      const fileExtension = fileName.toLowerCase().split('.').pop();
      console.log(`Calling document parsing API for: ${fileName} (${fileExtension})`);
      
      // Call the server-side API route
      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath,
          fileName,
          projectId,
          knowledgeId,
          skipEmbeddings
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || `API call failed: ${response.status}`);
        } catch (parseError) {
          throw new Error(`API call failed: ${response.status} - ${errorText.substring(0, 200)}`);
        }
      }

      const result = await response.json();
      console.log(`${fileExtension?.toUpperCase()} parsing completed: ${result.content.length} characters extracted`);
      
      return {
        content: result.content,
        sections: result.sections,
        chunks: result.chunks,
        metadata: {
          fileName: result.metadata.fileName,
          fileType: result.metadata.fileType,
          fileSize: result.metadata.fileSize,
          extractedAt: new Date(result.metadata.extractedAt)
        }
      };
    } catch (error) {
      console.error('Error extracting text from file:', error);
      throw error;
    }
  }

  /**
   * Test method to debug document parsing
   */
  async testDocumentParsing(filePath: string, fileName: string, projectId?: string, knowledgeId?: string): Promise<void> {
    try {
      const fileExtension = fileName.toLowerCase().split('.').pop();
      console.log(`Testing ${fileExtension} parsing for: ${fileName}`);
      
      // Skip embedding processing during testing to avoid creating duplicates
      const result = await this.extractTextFromFile(filePath, fileName, projectId, knowledgeId, true);
      
      console.log(`Parsing results: ${result.sections.length} sections, ${result.content.length} characters`);
      
    } catch (error) {
      console.error('Document parsing test failed:', error);
    }
  }

  /**
   * Split text into chunks suitable for embedding
   */
  public splitIntoChunks(text: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence.trim() + '.';
      
      if (currentChunk.length + sentenceWithPunctuation.length > maxChunkSize) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentenceWithPunctuation;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
}

// Export a singleton instance
export const specParser = SpecParser.getInstance();
