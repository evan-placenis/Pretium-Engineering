import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createServerSupabaseClient();

export async function POST(req: NextRequest) {
  try {
    const { projectId, query, limit = 5 } = await req.json();

    console.log('Searching project embeddings:', { projectId, query, limit });

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search in database using cosine similarity
    const { data, error } = await supabase.rpc('search_embeddings', {
      query_embedding: queryEmbedding,
      project_id: projectId,
      match_threshold: 0.6,
      match_count: limit
    });

    if (error) {
      console.error('Database search error:', error);
      return NextResponse.json(
        { error: 'Failed to search embeddings' },
        { status: 500 }
      );
    }

    const results = data || [];
    console.log(`Found ${results.length} similar chunks for query: "${query}"`);

    // Get additional metadata for results
    const enhancedResults = await Promise.all(
      results.map(async (result: any) => {
        try {
          // Get knowledge document info
          const { data: knowledgeData } = await supabase
            .from('project_knowledge')
            .select('file_name')
            .eq('id', result.knowledge_id)
            .single();

          return {
            content: result.content_chunk,
            similarity: result.similarity,
            chunkIndex: result.chunk_index,
            knowledgeId: result.knowledge_id,
            fileName: knowledgeData?.file_name || 'Unknown file'
          };
        } catch (error) {
          console.error('Error fetching knowledge metadata:', error);
          return {
            content: result.content_chunk,
            similarity: result.similarity,
            chunkIndex: result.chunk_index,
            knowledgeId: result.knowledge_id,
            fileName: 'Unknown file'
          };
        }
      })
    );

    return NextResponse.json({
      results: enhancedResults,
      query: query,
      totalFound: enhancedResults.length
    });

  } catch (error: any) {
    console.error('Error in search-project-embeddings API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search embeddings' },
      { status: 500 }
    );
  }
} 