import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/supabase';
import { ReportImage } from '@/lib/supabase';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createServerSupabaseClient();

// Helper function to search embeddings
async function searchProjectEmbeddings(projectId: string, query: string, limit: number = 5) {
  try {
    console.log(`Searching embeddings for project ${projectId} with query: "${query}"`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return [];
    }
    
    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('Generated embedding for query');

    // Search in database using cosine similarity
    const { data, error } = await supabase.rpc('search_embeddings', {
      query_embedding: queryEmbedding,
      project_id: projectId,
      match_threshold: 0.55,
      match_count: limit
    });

    if (error) {
      console.error('Database search error:', error);
      return [];
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

    return enhancedResults;
  } catch (error) {
    console.error('Error searching embeddings:', error);
    // Return empty array instead of throwing to prevent 500 errors
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { 
      reportId, 
      message, 
      reportContent, 
      projectName, 
      bulletPoints,
      images,
      projectId,
      searchKnowledgeBase = false,
      searchQuery = null,
      conversationHistory = [],
      isInitialLoad = false
    } = await req.json();

    console.log('Received enhanced chat request:', { 
      reportId, 
      message, 
      projectName, 
      imagesCount: images?.length || 0,
      searchKnowledgeBase,
      searchQuery,
      isInitialLoad,
      conversationLength: conversationHistory.length
    });

    // Validate required environment variables
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // If this is a knowledge base search request
    if (searchKnowledgeBase && searchQuery && projectId) {
      const results = await searchProjectEmbeddings(projectId, searchQuery, 5);
      return NextResponse.json({
        type: 'search_results',
        results: results,
        query: searchQuery,
        totalFound: results.length
      });
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!reportContent) {
      return NextResponse.json(
        { error: 'Report content is required' },
        { status: 400 }
      );
    }

    // Validate conversation history format
    if (conversationHistory && !Array.isArray(conversationHistory)) {
      console.error('Invalid conversation history format:', conversationHistory);
      return NextResponse.json(
        { error: 'Invalid conversation history format' },
        { status: 400 }
      );
    }

    // Use images passed in the request (from the current edit session)
    let imagesToUse: ReportImage[] = [];
    
    if (images && images.length > 0) {
      console.log('✅ Images provided for visual analysis:', images.length, 'images');
      console.log('Image URLs:', images.map((img: any) => img.url));
      console.log('Image descriptions:', images.map((img: any) => img.description));
      imagesToUse = images;
    } else {
      console.log('⚡ Fast mode: No images sent (speeds up response)');
    }

    // Create the system prompt (only on initial load)
    const systemPrompt = `
    #ROLE AND CONTEXT:
    You are a senior engineering report assistant at Pretium, a professional engineering consulting firm. 
    You are helping the user modify and improve their existing engineering report for the project: ${projectName || 'a project'}.

    #CURRENT REPORT CONTENT:
    The user is currently working on this report:
    ${reportContent}

    #ORIGINAL BULLET POINTS:
    This report was originally based on these observations:
    ${bulletPoints || 'Not provided'}

    #INSTRUCTIONS:
    - You are an expert assistant helping to modify, improve, or answer questions about this engineering report
    - You have access to the current report content ${imagesToUse.length > 0 ? 'and associated images' : '(images available but not loaded for faster response)'}
    - You can access project knowledge from specifications and building codes when relevant to user questions
    - If the user asks for changes, provide the complete updated report content
    - Maintain the professional engineering tone and format (two-column layout with [IMAGE:X] placeholders)
    - Keep the same section structure (GENERAL, SITE / STAGING AREA, ROOF SECTIONS, DEFICIENCY SUMMARY, etc.)
    - If you reference images, use the [IMAGE:X] format where X is the photo number
    - Provide specific, actionable changes when requested
    - If project knowledge is relevant to the user's question, reference it appropriately

    #RESPONSE FORMAT:
    You must respond with a valid JSON object containing:
    {
      "message": "Your conversational response explaining what you did or answering their question",
      "updatedContent": "The complete updated report content (only if making changes, otherwise null)",
      "embeddingResults": "Array of relevant embedding results if you found useful project knowledge (optional)"
    }

    #GUIDELINES:
    - Be helpful and professional
    - If making changes, provide the COMPLETE updated report, not just the changed sections
    - Maintain the existing [IMAGE:X] references and positioning
    - Use plain text format for the report (no markdown)
    - Keep section headers in UPPERCASE with colons
    - If project knowledge is relevant, mention it in your response and explain how it applies
    - If the user's question relates to specifications or building codes, use the provided knowledge to give accurate answers
    - Always respond with valid JSON format as specified above
    - IMPORTANT: 
     - Set "updatedContent" to null when you are only answering questions or providing information without making changes to the report.
     - Set "updatedContent" to the full report content (with your changes) when the user specifically requests changes or modifications.
    - EXAMPLES:
      * User asks: "What does this section mean?" → updatedContent: null
      * User asks: "Change the header to 'Attic'" → updatedContent: "FULL_REPORT_CONTENT_WITH_CHANGES"
      * User asks: "Add a new section" → updatedContent: "FULL_REPORT_CONTENT_WITH_NEW_SECTION"
      * User asks: "Summarize the report" → updatedContent: null
    `;

    // Prepare messages for OpenAI
    const messages: any[] = [];

    // Add system message only on initial load
    if (isInitialLoad) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
      console.log("Agent initialized!!!!")
    }

    // Add conversation history
    if (conversationHistory.length > 0) {
      // Filter out messages with null or empty content
      const validHistory = conversationHistory.filter((msg: any) => 
        msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0
      );
      console.log('Filtered conversation history:', {
        original: conversationHistory.length,
        filtered: validHistory.length,
        removed: conversationHistory.length - validHistory.length
      });
      messages.push(...validHistory);
    }

    // For non-initial messages, search for relevant knowledge and add it to the user message
    let userMessageText = message;
    if (!isInitialLoad && projectId) {
      try {
        console.log('Searching embeddings for message:', message);
        const embeddingResults = await searchProjectEmbeddings(projectId, message, 3);
        console.log('Found embedding results:', embeddingResults.length);
        
        if (embeddingResults.length > 0) {
          const relevantKnowledge = '\n\nRELEVANT PROJECT KNOWLEDGE:\n' + 
            embeddingResults.map((result: any, index: number) => 
              `${index + 1}. ${result.content}`
            ).join('\n\n');
          
          userMessageText = `Context: ${relevantKnowledge}\n\nUser question: ${message}`;
          console.log('Enhanced user message with knowledge base content');
        }
      } catch (error) {
        console.error('Error searching embeddings for chat:', error);
        // Continue with original message if embedding search fails
        userMessageText = message;
      }
    }

    // Add current user message
    const userMessageContent: any[] = [
      { type: 'text', text: userMessageText }
    ];

    // For non-initial messages, add JSON requirement to satisfy OpenAI
    if (!isInitialLoad) {
      userMessageContent[0].text += '\n\nPlease respond with a valid JSON object as specified in the system prompt.';
    }

    // Validate that user message content is not null or empty
    if (!userMessageContent[0].text || userMessageContent[0].text.trim().length === 0) {
      console.error('User message content is null or empty:', userMessageContent[0].text);
      return NextResponse.json(
        { error: 'User message content cannot be null or empty' },
        { status: 400 }
      );
    }

    // Add images if available
    if (imagesToUse.length > 0) {
      imagesToUse.forEach((img, index) => {
        userMessageContent.push(
          {
            type: 'text',
            text: `\n\nCurrent Photo ${index + 1} (${img.tag?.toUpperCase() || 'OVERVIEW'}): ${img.description || 'No description provided'}`
          },
          {
            type: 'image_url',
            image_url: {
              url: img.url,
              detail: 'auto',
            },
          }
        );
      });
    }

    messages.push({
      role: 'user',
      content: userMessageContent
    });

    console.log('Sending enhanced request to OpenAI with', messages.length, 'messages');

    // Call OpenAI API
    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError);
      
      // Handle specific OpenAI errors
      if (openaiError.code === 'insufficient_quota') {
        return NextResponse.json(
          { error: 'OpenAI quota exceeded. Please try again later.' },
          { status: 429 }
        );
      } else if (openaiError.code === 'invalid_api_key') {
        return NextResponse.json(
          { error: 'OpenAI API key is invalid' },
          { status: 500 }
        );
      } else if (openaiError.status === 429) {
        // Rate limit error
        const retryAfter = openaiError.headers?.['retry-after'] || '60';
        const waitTime = parseInt(retryAfter) || 60;
        
        return NextResponse.json(
          { 
            error: `Rate limit reached. Please wait ${waitTime} seconds before trying again.`,
            retryAfter: waitTime,
            type: 'rate_limit'
          },
          { status: 429 }
        );
      } else {
        return NextResponse.json(
          { error: `OpenAI API error: ${openaiError.message || 'Unknown error'}` },
          { status: 500 }
        );
      }
    }

    // Extract and parse the response
    const responseContent = response.choices[0]?.message.content || '';
    console.log('Received enhanced response from OpenAI');
    console.log('Raw response content:', responseContent);
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
      console.log('Parsed response:', {
        message: parsedResponse.message,
        hasUpdatedContent: !!parsedResponse.updatedContent,
        updatedContentType: typeof parsedResponse.updatedContent,
        updatedContentLength: parsedResponse.updatedContent ? parsedResponse.updatedContent.length : 0,
        updatedContentPreview: parsedResponse.updatedContent ? parsedResponse.updatedContent.substring(0, 200) + '...' : 'null'
      });
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      console.error('Raw response content:', responseContent);
      parsedResponse = {
        message: "I had trouble processing your request. Could you try rephrasing?",
        updatedContent: null,
        embeddingResults: null
      };
    }

    return NextResponse.json({
      type: 'chat_response',
      message: parsedResponse.message,
      updatedContent: parsedResponse.updatedContent,
      embeddingResults: parsedResponse.embeddingResults || null
    });
  } catch (error: any) {
    console.error('Error in enhanced chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process enhanced chat request' },
      { status: 500 }
    );
  }
} 