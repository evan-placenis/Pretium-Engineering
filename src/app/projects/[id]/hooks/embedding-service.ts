import { supabase } from '../../../../lib/supabase';

export interface EmbeddingResult {
  content: string;
  embedding: number[];
  chunkIndex: number;
}

export class EmbeddingService {
  private static instance: EmbeddingService;
  private openaiApiKey: string;

  private constructor() {
    // Use OPENAI_API_KEY for server-side, fallback to NEXT_PUBLIC_OPENAI_API_KEY for client-side
    this.openaiApiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
  }

  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * Generate embeddings for text chunks using OpenAI API
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const embeddings: number[][] = [];
    
    // Process in batches of 100 (OpenAI limit)
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100);
      
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-large',
            input: batch,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const batchEmbeddings = data.data.map((item: any) => item.embedding);
        embeddings.push(...batchEmbeddings);
        
        console.log(`Generated embeddings for batch ${Math.floor(i / 100) + 1}/${Math.ceil(texts.length / 100)}`);
        
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i / 100) + 1}:`, error);
        // Add zero embeddings for failed chunks
        embeddings.push(...batch.map(() => new Array(3072).fill(0)));
      }
    }

    return embeddings;
  }

  /**
   * Process text content and store embeddings in database with enhanced metadata
   */
  async processAndStoreEmbeddings(
    projectId: string,
    knowledgeId: string,
    content: string,
    fileName: string
  ): Promise<void> {
    try {
      console.log(`=== STARTING EMBEDDING PROCESSING ===`);
      console.log(`File: ${fileName}, Content length: ${content.length} characters`);

      // Split content into intelligent chunks
      const chunks = this.splitIntoIntelligentChunks(content, fileName);
      console.log(`Created ${chunks.length} intelligent chunks`);

      // Generate embeddings
      console.log('Generating embeddings...');
      const embeddings = await this.generateEmbeddings(chunks);
      console.log(`Generated ${embeddings.length} embeddings`);

      // Store in database with enhanced metadata
      console.log('Storing embeddings in database...');
      for (let i = 0; i < chunks.length; i++) {
        try {
          const chunkMetadata = this.extractChunkMetadata(chunks[i], fileName);
          
          const { error } = await supabase
            .from('project_embeddings')
            .insert({
              project_id: projectId,
              knowledge_id: knowledgeId,
              content_chunk: chunks[i],
              embedding: embeddings[i],
              chunk_index: i,
              document_source: fileName,
              section_title: chunkMetadata.sectionTitle,
              chunk_type: chunkMetadata.chunkType,
              created_at: new Date().toISOString()
            });
          
          if (error) throw error;
        } catch (error) {
          console.error(`Error storing chunk ${i}:`, error);
        }
      }

      // Update knowledge record
      const { error: updateError } = await supabase
        .from('project_knowledge')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          chunks_count: chunks.length
        })
        .eq('id', knowledgeId);

      if (updateError) {
        console.error('Error updating knowledge record:', updateError);
      }

      console.log(`=== EMBEDDING PROCESSING COMPLETED ===`);
      
    } catch (error) {
      console.error('Error in embedding processing:', error);
      
      // Update knowledge record with error
      const { error: errorUpdateError } = await supabase
        .from('project_knowledge')
        .update({
          processed: false,
          processing_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', knowledgeId);

      if (errorUpdateError) {
        console.error('Error updating knowledge record with error:', errorUpdateError);
      }
      
      throw error;
    }
  }

  /**
   * Split text into intelligent chunks that preserve complete ideas
   * This replaces the old 1000-character limit with section-based chunking
   */
  private splitIntoIntelligentChunks(text: string, fileName: string): string[] {
    // First, try to parse into sections
    const sections = this.parseDocumentSections(text);
    
    if (sections.length > 0) {
      // Use section-based chunks
      return sections.map(section => this.createCompleteSectionChunk(section, fileName));
    } else {
      // Fallback to paragraph-based chunks for unstructured text
      return this.createParagraphBasedChunks(text, fileName);
    }
  }

  /**
   * Parse document into sections based on headers
   */
  private parseDocumentSections(text: string): any[] {
    const sections: any[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentSection: any = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Detect section headers (common patterns in technical docs)
      const isHeader = this.detectSectionHeader(line);
      
      if (isHeader) {
        // Save previous section if exists
        if (currentSection && currentContent.length > 0) {
          currentSection.content = currentContent.join('\n');
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: line,
          content: '',
          level: this.determineHeaderLevel(line)
        };
        currentContent = [];
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
    }

    return sections;
  }

  /**
   * Detect if a line is a section header
   */
  private detectSectionHeader(line: string): boolean {
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
  private determineHeaderLevel(line: string): number {
    if (/^\d+\.\d+\.\d+\s+/.test(line)) return 3;
    if (/^\d+\.\d+\s+/.test(line)) return 2;
    if (/^\d+\.\s+/.test(line)) return 1;
    if (/^[A-Z][A-Z\s]{2,}$/.test(line)) return 1; // ALL CAPS
    return 1; // Default
  }

  /**
   * Create a complete chunk from a section (no splitting within sections)
   */
  private createCompleteSectionChunk(section: any, fileName: string): string {
    const sectionHeader = section.title;
    const sectionContent = section.content;
    
    // Create chunk with document source and complete section
    return `Document: ${fileName}\nSection: ${sectionHeader}\n\n${sectionContent}`;
  }

  /**
   * Create chunks based on paragraphs for unstructured text
   */
  private createParagraphBasedChunks(text: string, fileName: string): string[] {
    const chunks: string[] = [];
    
    // Split by paragraphs (double newlines)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = `Document: ${fileName}\n\n`;
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      // If adding this paragraph would exceed 2000 characters, start a new chunk
      if (currentChunk.length + trimmedParagraph.length > 2000 && currentChunk.length > 50) {
        chunks.push(currentChunk.trim());
        currentChunk = `Document: ${fileName}\n\n${trimmedParagraph}`;
      } else {
        currentChunk += (currentChunk.length > 50 ? '\n\n' : '') + trimmedParagraph;
      }
    }
    
    // Add the last chunk
    if (currentChunk.length > 50) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Extract metadata from a chunk for database storage
   */
  private extractChunkMetadata(chunk: string, fileName: string): { sectionTitle: string, chunkType: string } {
    // Check if it's a section-based chunk
    const sectionMatch = chunk.match(/Section: (.+?)\n/);
    if (sectionMatch) {
      return {
        sectionTitle: sectionMatch[1],
        chunkType: 'section'
      };
    }
    
    // Check if it's a paragraph-based chunk
    if (chunk.includes('Document: ') && !chunk.includes('Section: ')) {
      return {
        sectionTitle: 'General Content',
        chunkType: 'paragraph'
      };
    }
    
    return {
      sectionTitle: 'Unknown',
      chunkType: 'unknown'
    };
  }

  /**
   * Search for similar content using embeddings with enhanced metadata
   */
  async searchSimilarContent(
    projectId: string,
    query: string,
    limit: number = 5
  ): Promise<EmbeddingResult[]> {
    try {
      console.log(`=== SIMILARITY SEARCH ===`);
      console.log(`Query: "${query}", Limit: ${limit}`);
      
      // Generate embedding for query
      const queryEmbeddings = await this.generateEmbeddings([query]);
      const queryEmbedding = queryEmbeddings[0];

      // Check how many chunks exist for this project
      const { count: totalChunks, error: countError } = await supabase
        .from('project_embeddings')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);
      
      if (countError) {
        console.error('Error counting chunks:', countError);
      } else {
        console.log(`Total chunks in database: ${totalChunks}`);
      }

      // Search in database using cosine similarity with enhanced metadata
      const { data, error } = await supabase.rpc('search_embeddings', {
        query_embedding: queryEmbedding,
        project_id: projectId,
        match_threshold: 0.6, // Increased threshold
        match_count: limit
      });

      if (error) {
        console.error('Database search error:', error);
        throw error;
      }

      const results = data || [];
      console.log(`Found ${results.length} similar chunks`);
      
      // Debug: Check for duplicate chunks
      const uniqueIds = new Set();
      const uniqueResults = results.filter((result: any) => {
        if (uniqueIds.has(result.id)) {
          console.log(`⚠️ Duplicate chunk ID found: ${result.id}`);
          return false;
        }
        uniqueIds.add(result.id);
        return true;
      });
      
      if (uniqueResults.length !== results.length) {
        console.log(`⚠️ Removed ${results.length - uniqueResults.length} duplicate chunks`);
      }
      
      // Enhance results with document source and section information
      const enhancedResults = uniqueResults.map((result: any, index: number) => {
        const documentSource = result.document_source || 'Unknown Document';
        const sectionTitle = result.section_title || 'General Content';
        const chunkType = result.chunk_type || 'unknown';
        
        console.log(`Result ${index + 1}: ${(result.similarity * 100).toFixed(1)}% similar - "${result.content_chunk.substring(0, 100)}..."`);
        console.log(`  Source: ${documentSource}, Section: ${sectionTitle}, Type: ${chunkType}`);
        
        return {
          ...result,
          documentSource,
          sectionTitle,
          chunkType,
          // Add citation information
          citation: `${documentSource} - ${sectionTitle}`
        };
      });

      console.log(`=== SEARCH COMPLETED ===`);
      return enhancedResults;
      
    } catch (error) {
      console.error('=== SEARCH FAILED ===');
      console.error('Error searching embeddings:', error);
      return [];
    }
  }
}

// Export singleton instance
export const embeddingService = EmbeddingService.getInstance(); 