import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
//chat api route for handling report modifications
// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { reportId, message, reportContent, buildingName, bulletPoints } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Fetch report images
    const { data: images } = await supabase
      .from('report_images')
      .select('url, description')
      .eq('report_id', reportId);

    // Get public URLs for the images
    const imagesWithUrls = images?.map(image => {
      const { data: { publicUrl } } = supabase.storage
        .from('reports-images')
        .getPublicUrl(image.url);
      return {
        ...image,
        url: publicUrl
      };
    }) || [];

    // Create a context for the AI to understand the report
    const context = `
You are an AI assistant helping the user with their engineering report for ${buildingName || 'a building'}.

The report was originally generated based on these bullet points:
${bulletPoints || 'Not provided'}

The current version of the report is:
${reportContent || 'Not provided'}

IMPORTANT: The report includes the following images that you MUST reference and use in your analysis:
${imagesWithUrls.map(img => `- ${img.description || 'Image'}: ${img.url}`).join('\n') || 'No images provided'}

When responding to the user, always consider and reference the provided images in your analysis. If the user asks about specific aspects of the building or report, use the images to provide detailed, visual-based insights.`;

    // Create a prompt for the AI
    const prompt = `${context}

User has asked: "${message}"

Please respond in a helpful, concise manner. If the user is requesting changes to the report, provide those changes.
If you're suggesting edits to the report, provide both:
1. A response message explaining what you've changed
2. The full updated report content

Format your response as JSON with two keys:
- "message": Your response to the user
- "updatedContent": The modified report (only include this if you're suggesting changes, otherwise return null)
`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    // Extract the generated content
    const responseContent = response.choices[0]?.message.content || '';
    
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