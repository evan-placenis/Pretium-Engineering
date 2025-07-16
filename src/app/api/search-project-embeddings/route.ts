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

    // First check if there are any embeddings for this project
    const { count: totalEmbeddings, error: countError } = await supabase
      .from('project_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) {
      console.error('Error counting embeddings:', countError);
    } else {
      console.log(`Total embeddings in database for project ${projectId}: ${totalEmbeddings || 0}`);
    }

    // Search in database using cosine similarity (with lower threshold to get debug info)
    const { data, error } = await supabase.rpc('search_embeddings', {
      query_embedding: queryEmbedding,
      project_id: projectId,
      match_threshold: 0.1, // Much lower threshold to see all results
      match_count: Math.max(limit * 2, 10) // Get more results for debugging
    });

    if (error) {
      console.error('Database search error:', error);
      return NextResponse.json(
        { error: 'Failed to search embeddings' },
        { status: 500 }
      );
    }

    const allResults = data || [];
    console.log(`Database returned ${allResults.length} chunks (threshold: 0.1)`);
    
    // Show top 5 results for debugging, regardless of threshold
    if (allResults.length > 0) {
      console.log('Top results (for debugging):');
      allResults.slice(0, 5).forEach((result: any, index: number) => {
        console.log(`  ${index + 1}. Similarity: ${(result.similarity * 100).toFixed(1)}% - "${result.content_chunk.substring(0, 100)}..."`);
      });
    } else {
      console.log('⚠️ No results returned from database at all!');
    }

    // Filter results that meet the original threshold
    const goodResults = allResults.filter((result: any) => result.similarity >= 0.5);
    console.log(`Found ${goodResults.length} chunks above 50% similarity threshold for query: "${query}"`);
    
    // Use the filtered results for the actual response
    const results = goodResults.slice(0, limit);

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