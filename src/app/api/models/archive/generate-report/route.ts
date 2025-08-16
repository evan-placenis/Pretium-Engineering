import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServiceSupabase, ReportImage } from '@/lib/supabase';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = getServiceSupabase();

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

    //### PROMPT 1 ### (may want to add more project details here to improve the knowledge of the agent)
    const prompt = `
    ### WRITING INSTRUCTIONS:


    You are a senior engineering report writer at Pretium, a professional engineering consulting firm. Your assignment is to produce a highly technical, detailed, and professionally written site observation report for a project. 

You will be provided with:

A series of site photographs, each accompanied by a brief description and a tag indicating whether it is an overview or a deficiency photo.

A set of bullet-point observations that offer additional insights. These points may include general site observations not directly tied to a specific photo but are essential to include in the report.

Your task is to thoroughly expand upon and integrate both the photo descriptions and the bullet-point observations into a cohesive and professional report.

Key Instructions:

Every photo must be explicitly referenced and described in the report. Use the image descriptions and tags to guide your interpretation.

Bullet-point observations must be fully incorporated, especially where they provide context or important findings that are not visually documented.

Do not omit or generalize content. All information provided should be represented with technical precision and completeness.

Maintain a clear, logical structure throughout the report, and use a formal engineering tone.

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
    Below are the general observations. This text may contain further instructions that are crucial to consider when writing the.
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


    //### Passing images  and prompt to the agent ###
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          // Add each image with its description
          ...imagesToUse.flatMap((img, index) => [
            // First add the description as text
            {
              type: 'text' as const,
              text: `\n\nPhoto ${index + 1} Description (${img.tag?.toUpperCase() || 'OVERVIEW'}): ${img.description || 'No description provided'}`
            },
            // Then add the actual image
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

    // Log what we're sending to OpenAI
    console.log('Messages structure being sent to OpenAI:');
    const messageContent = messages[0]?.content;
    if (Array.isArray(messageContent)) {
      console.log('Total content items:', messageContent.length);
      messageContent.forEach((item: any, index: number) => {
        if (item.type === 'text') {
          console.log(`Content ${index}: TEXT - ${item.text.substring(0, 100)}...`);
        } else if (item.type === 'image_url') {
          console.log(`Content ${index}: IMAGE - URL: ${item.image_url.url.substring(0, 50)}...`);
        }
      });
    } else {
      console.log('Content is not an array:', typeof messageContent);
    }
    
    // Call OpenAI API
    // const response = await openai.chat.completions.create({
    //   model: 'gpt-4o',
    //   messages: [{ role: 'user', content: prompt }],
    //   temperature: 0.7,
    // });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
    });

    // Extract the generated content
    const generatedContent = response.choices[0]?.message.content || '';

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