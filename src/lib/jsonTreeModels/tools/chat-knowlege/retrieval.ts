import { OpenAI } from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';

const MAX_PAYLOAD_CHARS = 4000;

export async function getRelevantKnowledgeChunks(
  supabase: SupabaseClient,
  projectId: string, 
  query: string, 
  topK: number = 3
): Promise<string> {
  try {
    console.log('🔍 Searching for relevant knowledge:', { query, topK });
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: query,
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    const { data, error } = await supabase.rpc('search_embeddings', {
      query_embedding: queryEmbedding,
      project_id: projectId,
      match_threshold: 0.5,
      match_count: topK,
    });
    
    if (error) {
      console.error('Database search error:', error);
      return '';
    }
    
    const results = data || [];
    console.log(`Found ${results.length} relevant knowledge chunks`);
    
    if (results.length === 0) {
      return '';
    }
    
    const enhancedResults = await Promise.all(
      results.map(async (result: any) => {
        try {
          const { data: knowledgeData } = await supabase
            .from('project_knowledge')
            .select('file_name')
            .eq('id', result.knowledge_id)
            .single();
          
          return {
            content: result.content_chunk,
            similarity: result.similarity,
            fileName: knowledgeData?.file_name || 'Unknown file',
            documentSource: result.document_source || 'Unknown Document',
            sectionTitle: result.section_title || 'General Content',
          };
        } catch (error) {
          console.error('Error fetching knowledge metadata:', error);
          return {
            content: result.content_chunk,
            similarity: result.similarity,
            fileName: 'Unknown file',
            documentSource: result.document_source || 'Unknown Document',
            sectionTitle: result.section_title || 'General Content',
          };
        }
      })
    );
    
    // Format the relevant knowledge as context with enhanced citations
    let totalChars = 0;
    const knowledgeChunks: string[] = [];

    for (const result of enhancedResults) {
        const similarity = (result.similarity * 100).toFixed(1);
        const documentName = result.documentSource
            .replace(/\.[^/.]+$/, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (l: string) => l.toUpperCase());
        const citation = `${documentName} - ${result.sectionTitle}`;
        const chunk = `[Citation ${knowledgeChunks.length + 1} - ${similarity}% relevant from ${citation}]:\n${result.content}`;

        if (totalChars + chunk.length > MAX_PAYLOAD_CHARS) {
            console.log('📦 Payload size limit reached. Truncating results.');
            break;
        }

        knowledgeChunks.push(chunk);
        totalChars += chunk.length;
    }
    
    const relevantKnowledge = knowledgeChunks.join('\n\n');
    
    console.log('📋 Relevant knowledge found and formatted for chat');
    return `\n\n--- RELEVANT SPECIFICATIONS ---\n${relevantKnowledge}\n\nIMPORTANT: Use the specifications above as your primary source of truth when answering questions or editing the report. Always cite the relevant specification when you use it.`;
    
  } catch (error) {
    console.error('Error getting relevant knowledge chunks:', error);
    return '';
  }
}
