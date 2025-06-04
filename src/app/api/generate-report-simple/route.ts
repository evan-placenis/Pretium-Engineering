import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { ReportImage, ProjectImage } from '@/lib/supabase';

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
    const { bulletPoints, contractName, location, reportId, images } = await req.json();
    console.log('Received request data:', { bulletPoints, contractName, location, reportId, images });

    if (!bulletPoints) {
      return NextResponse.json(
        { error: 'Bullet points are required' },
        { status: 400 }
      );
    }

    // Use images passed in the request body first (since report isn't created yet)
    let imagesToUse: (ReportImage)[] = [];
    
    if (images && images.length > 0) {
      console.log('Using images passed in request:', images);
      imagesToUse = images;
    } else{
      console.log('No images in request, trying to fetch project images');
    }

    console.log('images to use:', imagesToUse.length, 'images');

    // Create a prompt for GPT

    //### PROMPT 1 ###
    const prompt = `
    ### WRITING INSTRUCTIONS:
    You are a senior engineering report writer at Pretium, a professional engineering consulting firm. Your task is to generate a highly technical and detailed site observation report for ${contractName || 'a contract'} located at ${location || 'the specified location'}.

    All the observation information you must eloquently expand upon is provided in the bullet points, photos, and the photos respective descriptions. 

    This report must **strictly follow and expand upon** the provided bullet-point observations and photo descriptions. 

    Every photo must be addressed clearly, thoroughly, and without omission. The description of the photo will provide you with the information you need to do this.

    The Bullet points provide additional information about the observations that you must include in the report.

    ---

    You will be provided with:
    - Bullet point observations made on site
    - A set of site photos, each with a short description and a tag: either "overview" or "deficiency" to help you identify the type of photo.

    Information provided here:

    ${imagesToUse.length > 0 ? `
    SITE PHOTOS WITH DESCRIPTIONS:
    ${imagesToUse.map((img, index) => {
      return `Photo ${index + 1} (${img.tag?.toUpperCase() || 'OVERVIEW'}): ${img.description || 'No description provided'}`;
    }).join('\n\n')}
    ` : 'Note: No photos were provided with this report.'}

    GENERAL OBSERVATIONS:
    ${bulletPoints}

    ---

    ### FORMATTING INSTRUCTIONS:
    Please carefully integrate the images (with descriptions) into the appropriate section of the report. The report follows the two column format with the left column being the description and the right column being the images.

    **IMPORTANT: When referencing an image, use the placeholder format [IMAGE:X] where X is the photo number. Each image placeholder is to be assigned exactly once.**

    For example:
    - To reference Photo 1, use: [IMAGE:1]
    - To reference Photo 2, use: [IMAGE:2]
    - And so on...

    For each image you reference:
    - Describe what the photo shows based on its description
    - Explain how it relates to the observations
    - For DEFICIENCY photos: Focus on the problem/issue shown and its implications
    - For OVERVIEW photos: Use them to provide context about the work area or general conditions
    - Place the [IMAGE:X] placeholder where the image should appear in the report

    ---
    ### STRUCTURE:
    Use the following section headers in UPPERCASE (not markdown):

    OBSERVATIONS / COMMENTS
        1. GENERAL
        2. SITE / STAGING AREA
        3. ROOF SECTIONS
        4. DEFICIENCY SUMMARY

    ---

    ### WRITING GUIDELINES:
    - Use a **professional, technical tone** consistent with engineering field reports.
    - Expand on each observation with technical reasoning and possible implications if relevant.
    - For **Deficiency-tagged photos**, describe the specific deficiency and its impact.
    - For **Overview-tagged photos**, use them to provide general context of work areas.
    - Be **precise and detailed**: Avoid generic language. Reference specific elements, materials, or observations where possible.
    - **MUST reference every provided photo** in the appropriate section based on its description and tag.
    - DO NOT add any content not grounded in the provided bullets or photos.
    - Return the final result as a **plain text report** (NO markdown or formatting like asterisks). Use UPPERCASE and colons to differentiate section headers if needed.

    ---

    Example of proper image referencing:
    "During the inspection, a safety concern was identified in the playground area. As shown in the image, the placement of equipment creates a potential hazard...   [IMAGE:1]"

    ---

    Start writing the report only after interpreting and organizing the observations and photo data in a meaningful way.
    `;

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
      generatedContent,
      images: imagesToUse, // Return the images array so frontend can map placeholders to actual images
      imagesUsed: imagesToUse.length
    });
  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
} 