import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { bulletPoints, contractName, location } = await req.json();
    console.log('Received request data:', { bulletPoints, contractName, location });

    if (!bulletPoints) {
      return NextResponse.json(
        { error: 'Bullet points are required' },
        { status: 400 }
      );
    }

    // Create a prompt for GPT
    const prompt = `
You are an expert engineering report writer for a professional engineering firm Called Pretium. 
Generate a detailed, professional report based on the following observations for ${contractName || 'a contract'} located at ${location || 'the specified location'}.

Bullet point observations to expand upon:
${bulletPoints}

Please structure the report with the following sections which are in bold and slighly larger font:
OBSERVATIONS / COMMENTS
    1. GENERAL
    2. SITE / STAGING AREA
    3. ROOF SECTIONS
    4. DEFICIENCY SUMMARY

Remember to:
1. Maintain a professional and technical tone throughout
2. Be specific and detailed in your observations
4. Use proper formatting with clear section headers
5. Return the report as plain text, with no markdown (no **bold**), and use UPPERCASE or colon formatting for headings if needed.`;

    console.log('Generated prompt:', prompt);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    // Extract the generated content
    const generatedContent = response.choices[0]?.message.content || '';
    console.log('Generated content length:', generatedContent.length);

    return NextResponse.json({
      generatedContent
    });
  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
} 