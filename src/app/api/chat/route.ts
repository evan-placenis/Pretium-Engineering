import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { ReportImage } from '@/lib/supabase';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const { 
      reportId, 
      message, 
      reportContent, 
      projectName, 
      bulletPoints,
      images 
    } = await req.json();

    console.log('Received chat request:', { reportId, message, projectName, imagesCount: images?.length || 0 });

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

    // Create the chat prompt following the generate-report-simple pattern
    const prompt = `
    #ROLE AND CONTEXT:
    You are a senior engineering report assistant at Pretium, a professional engineering consulting firm. 
    You are helping the user modify and improve their existing engineering report for the project: ${projectName || 'a project'}.

    #CURRENT REPORT CONTENT:
    The user is currently working on this report:
    ${reportContent}

    #ORIGINAL BULLET POINTS:
    This report was originally based on these observations:
    ${bulletPoints || 'Not provided'}

    #USER REQUEST:
    The user has asked: "${message}"

    #INSTRUCTIONS:
    - You are an expert assistant helping to modify, improve, or answer questions about this engineering report
    - You can see the current report content ${imagesToUse.length > 0 ? 'and associated images' : '(images available but not loaded for faster response)'}
    ${imagesToUse.length > 0 ? 
      '- IMPORTANT: You can see and analyze the images provided. Reference them in your response' :
      '- NOTE: Images are available but not loaded for this request. If you need to see images, ask the user to rephrase their question mentioning "images" or "photos"'
    }
    - If the user asks for changes, provide the complete updated report content
    - Maintain the professional engineering tone and format (two-column layout with [IMAGE:X] placeholders)
    - Keep the same section structure (GENERAL, SITE / STAGING AREA, ROOF SECTIONS, DEFICIENCY SUMMARY, etc.)
    - If you reference images, use the [IMAGE:X] format where X is the photo number
    - Provide specific, actionable changes when requested

    #RESPONSE FORMAT:
    Respond with a JSON object containing:
    {
      "message": "Your conversational response explaining what you did or answering their question",
      "updatedContent": "The complete updated report content (only if making changes, otherwise null)"
    }

    #GUIDELINES:
    - Be helpful and professional
    - If making changes, provide the COMPLETE updated report, not just the changed sections
    - Maintain the existing [IMAGE:X] references and positioning
    - Use plain text format for the report (no markdown)
    - Keep section headers in UPPERCASE with colons
    `;

    console.log('Generated chat prompt');

    // Prepare messages for OpenAI, including images if available
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          // Add each image with its description if available
          ...imagesToUse.flatMap((img, index) => [
            {
              type: 'text' as const,
              text: `\n\nCurrent Photo ${index + 1} (${img.tag?.toUpperCase() || 'OVERVIEW'}): ${img.description || 'No description provided'}`
            },
            {
              type: 'image_url' as const,
              image_url: {
                url: img.url,
                detail: 'auto' as const,
              },
            }
          ])
        ],
      },
    ];

    console.log('Sending request to OpenAI with', Array.isArray(messages[0]?.content) ? messages[0].content.length : 1, 'content items');

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    // Extract and parse the response
    const responseContent = response.choices[0]?.message.content || '';
    console.log('Received response from OpenAI');
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      parsedResponse = {
        message: "I had trouble processing your request. Could you try rephrasing?",
        updatedContent: null
      };
    }

    return NextResponse.json({
      message: parsedResponse.message,
      updatedContent: parsedResponse.updatedContent
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat request' },
      { status: 500 }
    );
  }
} 