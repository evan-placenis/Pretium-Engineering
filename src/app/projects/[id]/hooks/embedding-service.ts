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
            model: 'text-embedding-3-small',
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
        embeddings.push(...batch.map(() => new Array(1536).fill(0)));
      }
    }

    return embeddings;
  }

  /**
   * Process text content and store embeddings in database
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

      // Split content into chunks
      const chunks = this.splitIntoChunks(content);
      console.log(`Created ${chunks.length} chunks`);

      // Generate embeddings
      console.log('Generating embeddings...');
      const embeddings = await this.generateEmbeddings(chunks);
      console.log(`Generated ${embeddings.length} embeddings`);

      // Store in database
      console.log('Storing embeddings in database...');
      for (let i = 0; i < chunks.length; i++) {
        try {
          const { error } = await supabase
            .from('project_embeddings')
            .insert({
              project_id: projectId,
              knowledge_id: knowledgeId,
              content_chunk: chunks[i],
              embedding: embeddings[i],
              chunk_index: i,
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
   * Split text into chunks suitable for embedding
   */
  private splitIntoChunks(text: string, maxChunkSize: number = 1000): string[] {
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

  /**
   * Search for similar content using embeddings
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

      // Search in database using cosine similarity
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
      
      // Log each result with details
      uniqueResults.forEach((result: any, index: number) => {
        console.log(`Result ${index + 1}: ${(result.similarity * 100).toFixed(1)}% similar - "${result.content_chunk.substring(0, 100)}..."`);
      });

      console.log(`=== SEARCH COMPLETED ===`);
      return uniqueResults;
      
    } catch (error) {
      console.error('=== SEARCH FAILED ===');
      console.error('Error searching embeddings:', error);
      return [];
    }
  }
}

// Export singleton instance
export const embeddingService = EmbeddingService.getInstance(); 