import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { ProjectImage, ReportImage } from '@/lib/supabase';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to resize image
async function resizeImageForAI(imageUrl: string, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.8): Promise<string> {
  try {
    // Fetch the original image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Import sharp dynamically (install with: npm install sharp @types/sharp)
    const sharp = require('sharp');
    
    // Resize and compress the image
    const resizedImageBuffer = await sharp(buffer)
      .resize(maxWidth, maxHeight, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: Math.round(quality * 100) })
      .toBuffer();
    
    // Convert to base64 data URL
    const base64Image = resizedImageBuffer.toString('base64');
    return `data:image/jpeg;base64,${base64Image}`;
    
  } catch (error) {
    console.error('Error resizing image:', error);
    // Fallback to original URL if resizing fails
    return imageUrl;
  }
}

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

    // Resize images for AI processing
    console.log('Resizing images for AI processing...');
    const resizedImages = await Promise.all(
      imagesToUse.map(async (img, index) => {
        console.log(`Resizing image ${index + 1}/${imagesToUse.length}`);
        const resizedUrl = await resizeImageForAI(img.url, 1024, 1024, 0.7);
        return { ...img, url: resizedUrl };
      })
    );
    console.log('Image resizing completed');

    // Create a prompt for GPT

    //### PROMPT 1 ###
    const prompt = `
    #WRITING INSTRUCTIONS:
    You are a senior engineering report writer at Pretium, a professional engineering consulting firm. Your assignment is to produce a highly technical, detailed, and professionally written site observation report for the project titled ${contractName || 'a contract'}, located at ${location || 'the specified location'}.

    You will be provided with:
      - A series of site photographs, each accompanied by a brief description and a tag indicating whether it is an overview or a deficiency photo.
      - A set of bullet-point observations that offer additional insights. These points may include general site observations not directly tied to a specific photo but are essential to include in the report.
      - Your task is to thoroughly expand upon and integrate both the photo descriptions and the bullet-point observations into a cohesive and professional report.

    Key Instructions:
      - Every photo must be explicitly referenced and described in the report. Use the image descriptions and tags to guide your interpretation.
      - Bullet-point observations must be fully incorporated, especially where they provide context or important findings that are not visually documented.
      - Do not omit or generalize content. All information provided should be represented with technical precision and completeness.
      - Maintain a clear, logical structure throughout the report, and use a formal engineering tone.


    ---

    #FORMATTING INSTRUCTIONS:

    The report follows a two-column layout:
      - Left column: Detailed written observations
      - Right column: Corresponding images

    Each photo must be referenced using the placeholder format [IMAGE:X], where X is the photo number (e.g., [IMAGE:1], [IMAGE:2], etc.).
      - Each photo must be referenced and placed in the reportexactly once.
      - Place the placeholder where the image should appear in the report.

    For each image:
      - Describe what the photo visually shows and summarize its description.
      - Clearly relate it to the site observations.
      - For DEFICIENCY photos: Emphasize the issue shown and its potential impact.
      - For OVERVIEW photos: Use to provide environmental or contextual understanding of the work area.
    ---
    #STRUCTURE:
    Use standard engineering section headers in UPPERCASE (not markdown formatting). Typical sections include:
     1. GENERAL
     2. SITE / STAGING AREA
     3. ROOF SECTIONS
     4. DEFICIENCY SUMMARY
    Do not use headers like "Introduction" or "Conclusion" — these are not part of Pretium's reporting format.
    ---
    #WRITING GUIDELINES:
    - Use a professional and technical tone consistent with engineering field reports.
    - Expand each observation with relevant detail, technical reasoning, and implications where applicable.
    - Integrate all bullet-point observations and every photo into the report. Each photo must be referenced exactly once
    - Return the report as plain text only — no markdown, no asterisks, and no styling. Use uppercase and colons to differentiate section headers.

    Example of proper image referencing:
    "During the inspection, a safety concern was identified in the playground area. As shown in the image, the placement of equipment creates a potential hazard...   [IMAGE:1]"

    ---

    BULLET POINT OBSERVATIONS:
    ${bulletPoints}

    ---

    Start writing the report only after interpreting and organizing the observations and photo data in a meaningful way.
    `;

    console.log('Generated prompt');


    //### Passing images  and prompt to the agent ###
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          // Add each image with its description
          ...resizedImages.flatMap((img, index) => [
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
                detail: 'low' as const, // Use 'low' detail for better performance with many images
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
          console.log(`Content ${index}: IMAGE - Detail: ${item.image_url.detail}`);
        }
      });
    } else {
      console.log('Content is not an array:', typeof messageContent);
    }
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
    });

    // Extract the generated content
    const generatedContent = response.choices[0]?.message.content || '';

    return NextResponse.json({
      generatedContent,
      images: imagesToUse, // Return the original images array so frontend can map placeholders to actual images
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