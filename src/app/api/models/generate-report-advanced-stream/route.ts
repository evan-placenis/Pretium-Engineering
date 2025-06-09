import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { ReportImage } from '@/lib/supabase';

// Helper function to chunk array
function chunk<T>(array: T[], size: number): T[][] {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

//### PROMPT 1 ###
const photoWritingPrompt  = `
#ROLE:
You are a senior engineering report writer for Pretium. Your task is to generate detailed and technically accurate observations based strictly on a batch of 5 site photographs. These are for internal draft use and will later be compiled and reviewed.

#CONTEXT:
Each image is provided with a short description and a tag indicating whether it's an OVERVIEW or DEFICIENCY photo. Use this to guide your interpretation.

#INSTRUCTIONS:
- Do NOT write an introduction or a conclusion.
- Do NOT include or reference bullet points — those will be incorporated later.
- Do NOT refer to previous or future batches.
- Focus only on describing and analyzing the content of the images provided in this batch.

#FORMATTING:
- Use numbered subsections for each photo: e.g., 1.1, 1.2, 1.3, etc.
- Use uppercase section headers to group related photos if appropriate (e.g., GENERAL, SITE / STAGING AREA, ROOF SECTIONS).
- For each photo, describe what is shown, summarize the description, and explain its technical significance.
- Reference each photo using the placeholder format [IMAGE:X] (e.g., [IMAGE:1], [IMAGE:2]). Each image must be referenced once.
- DEFICIENCY photos: emphasize the issue and its potential consequences.
- OVERVIEW photos: describe the area and its relevance or condition.

#STYLE:
- Professional engineering tone.
- Precise, complete, and objective language.
- Plain text only — no markdown, no asterisks, no styling.

Start the draft directly. Do not include preambles.
`;

const finalEditorPrompt = `
#ROLE:
You are a senior engineering editor at Pretium. You are reviewing and finalizing a site observation report that was written in multiple sections by another writer based on batches of site photographs.

#OBJECTIVE:
- Your job is to refine and re-organize the draft text.
- Integrate the bullet-point observations that contain information of the overall site.
- Add a strong opening section and conclude the report as needed.
- Maintain engineering tone, technical accuracy, and completeness.

#SOURCE MATERIAL:
You will be given all the raw draft sections written in a numbered format (e.g., 1.1, 1.2, etc.). These observations cover all image-based content but lack context and bullet-point integration.

#EDITING TASKS:
- Reorganize text to follow Pretium’s standard section format:
  1. GENERAL
  2. SITE / STAGING AREA
  3. ROOF SECTIONS
  4. DEFICIENCY SUMMARY
- You may create or move content under these headers as appropriate.
- ADD an introductory paragraph at the beginning of the GENERAL section.
- ADD a final summary or closing statement at the end of the DEFICIENCY SUMMARY if appropriate.
- INTEGRATE bullet-point observations into the most relevant sections.
- Ensure every image placeholder (e.g., [IMAGE:X]) remains in the output exactly once and logically placed.

#STRICT PRESERVATION RULE:
- You must NOT delete or omit any content from the existing draft — including photo references, technical details, or observations.
- You may **reorganize**, **rephrase slightly for clarity**, or **add transitions**, but do not lose or dilute any information.
- **Every [IMAGE:X] placeholder must appear exactly once** in the final version.

#STYLE:
- Technical, formal engineering tone
- Plain text only (no markdown, no formatting)
- No headers like “Introduction” or “Conclusion” — use only official Pretium section headers as listed above

Start by reviewing the full draft and restructuring as needed.
`;

const generalAndSummaryPrompt =  `
#ROLE:
You are a senior engineering editor at Pretium. Your task is to write only two sections — the GENERAL section and the DEFICIENCY SUMMARY — for a site observation report.

#INPUT:
You will be given a set of bullet-point observations that summarize overall findings. You will not be given the full report, only the summary information and context.

#GOAL:
- Write a technically accurate and professional GENERAL section that introduces the site, scope of review, and site-wide conditions.
- Write a DEFICIENCY SUMMARY section that recaps the key issues across all photos and observations.
- Use the bullet-point observations as your primary source of information.
- Use the location and contract name to help provide context.

#RESTRICTIONS:
- Do NOT attempt to rewrite or edit any existing report content — you are only appending these two sections.
- Do NOT reference any specific [IMAGE:X] photos.
- Do NOT remove or assume any previous content — you will not see the rest of the report.

#STRUCTURE:
- SECTION: GENERAL
- SECTION: DEFICIENCY SUMMARY

#STYLE:
- Engineering field report tone
- Plain text only (no markdown, no styling)
- Concise, objective, and formal
`;


// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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

    if (!bulletPoints || !reportId) {
      return NextResponse.json(
        { error: 'Bullet points and report ID are required' },
        { status: 400 }
      );
    }

    // Start the actual generation process asynchronously
    processReportAsync(bulletPoints, contractName, location, reportId, images);

    // Return success immediately
    return NextResponse.json({ 
      success: true, 
      message: 'Report generation started',
      reportId 
    });
  } catch (error: any) {
    console.error('Error starting streaming generation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start report generation' },
      { status: 500 }
    );
  }
}

// Async function to handle the actual processing
async function processReportAsync(bulletPoints: string, contractName: string, location: string, reportId: string, images: any[]) {
  try {
    // First, verify the report exists in the database
    const { data: existingReport, error: checkError } = await supabase
      .from('reports')
      .select('id, generated_content')
      .eq('id', reportId)
      .single();
      
    if (checkError) {
      console.error('Error checking if report exists:', checkError);
      throw new Error(`Report ${reportId} not found in database`);
    }

    // Use images passed in the request body
    let imagesToUse: (ReportImage)[] = [];
    
    if (images && images.length > 0) {
      imagesToUse = images;
    } else{
      return;
    }

    // Update status in database
    const { error: updateError1 } = await supabase
      .from('reports')
      .update({ 
        generated_content: 'Starting report generation...\n\n[PROCESSING IN PROGRESS...]'
      })
      .eq('id', reportId);
    
    if (updateError1) {
      console.error('Error updating database with initial status:', updateError1);
    }

    // Resize images for AI processing
    const resizedImages = await Promise.all(
      imagesToUse.map(async (img, index) => {
        const resizedUrl = await resizeImageForAI(img.url, 1600, 1600, 0.85);
        return { ...img, url: resizedUrl };
      })
    );

    // Update status
    const { error: updateError2 } = await supabase
      .from('reports')
      .update({ 
        generated_content: `Images resized (${resizedImages.length}). Starting batch processing...`
      })
      .eq('id', reportId);
      
    if (updateError2) {
      console.error('Error updating database after image resizing:', updateError2);
    }

    // Split the images into chunks for better performance
    const imageChunks = chunk(resizedImages, 5);
    const batchResponses: string[] = [];

    // Set up the initial conversation with system prompt and instructions
    const baseMessages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: photoWritingPrompt ,
      },
    ];

    // Process each batch
    for (let i = 0; i < imageChunks.length; i++) {
      const currentChunk = imageChunks[i];
      
      // Update status in database
      const { error: updateErrorBatch } = await supabase
        .from('reports')
        .update({ 
          generated_content: `Processing batch ${i + 1}/${imageChunks.length} (${currentChunk.length} images)...\n\n${batchResponses.join('\n\n')}\n\n[PROCESSING IN PROGRESS...]`
        })
        .eq('id', reportId);
        
      if (updateErrorBatch) {
        console.error(`Error updating database before batch ${i + 1}:`, updateErrorBatch);
      }

      const batchMessages: OpenAI.ChatCompletionMessageParam[] = [
        ...baseMessages,
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Process Image Batch #${i + 1} of ${imageChunks.length}: Write observations for the following ${currentChunk.length} images using numbered subsections ${i + 1}.1, ${i + 1}.2, ${i + 1}.3, etc. Reference each image using [IMAGE:X] starting from ${i * 5 + 1}.`,
            },
            ...currentChunk.flatMap((img: ReportImage, index: number) => [
              {
                type: 'text' as const,
                text: `Photo ${i * 5 + index + 1} Description (${img.tag?.toUpperCase() || 'OVERVIEW'}): ${img.description || 'No description provided'}`,
              },
              {
                type: 'image_url' as const,
                image_url: {
                  url: img.url,
                  detail: 'auto' as const,
                },
              },
            ]),
          ],
        },
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: batchMessages,
        temperature: 0.7,
      });
    
      const section = response.choices[0]?.message.content || '';
      batchResponses.push(section);
      
      // Update database with the current progress
      const combinedSoFar = batchResponses.join('\n\n');
      const { error: updateErrorAfterBatch } = await supabase
        .from('reports')
        .update({ 
          generated_content: combinedSoFar + '\n\n[PROCESSING IN PROGRESS...]'
        })
        .eq('id', reportId);
        
      if (updateErrorAfterBatch) {
        console.error(`Error updating database after batch ${i + 1}:`, updateErrorAfterBatch);
      }
    }
    
    // Update status
    await supabase
      .from('reports')
      .update({ 
        generated_content: batchResponses.join('\n\n') + '\n\nStarting final review...\n\n[PROCESSING IN PROGRESS...]'
      })
      .eq('id', reportId);

    // Final review step
    const combinedDraft = batchResponses.join('\n\n');

    const generalAndSummaryMessages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: generalAndSummaryPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Here are the general bullet points that were used to generate the report:\n\n${bulletPoints}\n\n
                    Here is the existing draft composed of ${batchResponses.length} sections to use as context:\n\n${combinedDraft} \n\n Please write a General opening statement`,
          },
        ],
      },
    ];

    const generalAndSummaryOutput = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: generalAndSummaryMessages,
      temperature: 0.7,
    });


    const finalSummaryOutputMessages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: generalAndSummaryPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Here are the general bullet points that were used to generate the report:\n\n${bulletPoints}\n\n
                      Here is the existing draft composed of ${batchResponses.length} sections to use as context:\n\n${combinedDraft} \n\n Please write a General opening statement`,
            },
          ],
        },
      ];
  
      const finalSummaryOutput = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: finalSummaryOutputMessages,
        temperature: 0.7,
      });

    //const reviewedContent = finalReview.choices[0]?.message.content || '';
    const generalText = generalAndSummaryOutput.choices[0]?.message.content || '';
    const summaryText = finalSummaryOutput.choices[0]?.message.content || '';

    const fullReport =
    generalText + '\n\n' +
    combinedDraft + '\n\n' +
    summaryText; // optional if separated
    
    // Update the database with the final content
    const { error: finalUpdateError } = await supabase
      .from('reports')
      .update({ generated_content: fullReport })
      .eq('id', reportId);
      
    if (finalUpdateError) {
      console.error('Error updating database with final content:', finalUpdateError);
    }

  } catch (error: any) {
    console.error('Error in async processing:', error);
    // Update database with error
    await supabase
      .from('reports')
      .update({ 
        generated_content: `Error generating report: ${error.message}\n\nPlease try again or use a different model.`
      })
      .eq('id', reportId);
  }
}

 