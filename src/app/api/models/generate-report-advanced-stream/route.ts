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
You are a senior engineering report writer for Pretium. Your task is to generate detailed and technically accurate observations based strictly on the batch of site photographs provided. These observation narratives will form an internal draft, to be used at a later time to generate a full report. Start the draft directly. Do not include preambles. 


#CONTEXT:
Each image is provided with a short description and a tag  (OVERVIEW or DEFICIENCY). Use this information to guide your interpretation.

#INSTRUCTIONS:
- Refer to the provided description and the tags to guide your focus. Use this information to help analyze the content of the images.
- For each photo, describe what is shown, enhance the description that was provided, and explain its technical significance.
- You are encouraged to incorporate relevant general knowledge to enhance your analysis of the images.
- The Tags influence the tone of the description in the following ways:
  -- DEFICIENCY photos: emphasize the issue and its potential consequences.
  -- OVERVIEW photos: describe the contents of the image in general terms 
- Aim for concise observations (1–2 sentences).
- If you have more than one point, split them into separate bullets with tab indentation.
- Do NOT write an introduction or a conclusion section for your findings of the batch.
- Do consider the reference bullet points about the overall site (provided to you) when making observations.


#FORMATTING:
- Reference each photo using the placeholder format [IMAGEID:X] (e.g., [IMAGE:1], [IMAGE:2]). 
- Each image must be referenced once.
 
#STYLE:
- Professional engineering tone.
- Precise, complete, and objective language.
- Plain text only — no markdown, no asterisks, no styling. 
`;


const generalAndSummaryPrompt = `
#ROLE:
-You are the final editor of a Report for a Civil Engineering firm called Pretium. Your role is to format and finalize building observation reports based on a rough draft composed of a series of site observations. The core content has already been generated. Your primary responsibility is to apply consistent formatting, structure the report with appropriate headers, and ensure clarity and professionalism. You are not expected to rewrite or elaborate on the observations—focus on organizing and polishing the report layout.


#CONTEXT:
-Each chunk of text corresponds to an observation related to a specific image. In the final formatted report, the observation text will appear on the left, with the associated image on the right. These text-image pairs may not be in their optimal order initially. Your task is to ensure a logical and cohesive flow throughout the report by reordering them where appropriate.

#INSTRUCTIONS:
-If reordering is required, you may do so by retyping the report and placing the relevant text-image pairs in the appropriate order. Do not alter or remove any of the original text in the editing process
-Always begin the report with the main header: "OBSERVATIONS"

-You are encouraged to introduce additional subheadings where appropriate; however, for small observation reports, typically only a few subheadings are needed.
-Each subheading should be numbered (e.g., 2). Bullet points under a subheading should be labeled sequentially (e.g., 2.1, 2.2, etc.). Use tab indentation to format the bullet points under each subheading for clear hierarchy and readability.
-You may add brief text where appropriate. As the final editor, you have discretion to make minor adjustments to improve clarity and flow.


#STYLE:
- Engineering field report tone
- Plain text only (no markdown, no styling)
- Concise, objective, and formal
`;


const old_prompt =  `
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

export async function POST(request: Request) {
  console.log('API Route: generate-report-advanced-stream called');
  try {
    const body = await request.json();
    console.log('Request body:', {
      hasBulletPoints: !!body.bulletPoints,
      hasContractName: !!body.contractName,
      hasLocation: !!body.location,
      hasReportId: !!body.reportId,
      imagesCount: body.images?.length || 0
    });

    const { bulletPoints, contractName, location, reportId, images } = body;

    if (!bulletPoints || !reportId) {
      console.error('Missing required fields:', { bulletPoints: !!bulletPoints, reportId: !!reportId });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Start the async processing
    console.log('Starting async processing for report:', reportId);
    processReportAsync(bulletPoints, contractName, location, reportId, images)
      .catch(error => {
        console.error('Error in processReportAsync:', error);
      });

    // Return immediately while processing continues
    console.log('Returning initial response for report:', reportId);
    return NextResponse.json({
      success: true,
      message: 'Report generation started',
      reportId: reportId
    });
  } catch (error: any) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while starting report generation' },
      { status: 500 }
    );
  }
}

// Async function to handle the actual processing
async function processReportAsync(bulletPoints: string, contractName: string, location: string, reportId: string, images: any[]) {
  console.log('processReportAsync started for report:', reportId);
  try {
    // First, verify the report exists in the database
    console.log('Verifying report exists in database...');
    const { data: existingReport, error: checkError } = await supabase
      .from('reports')
      .select('id, generated_content')
      .eq('id', reportId)
      .single();
      
    if (checkError) {
      console.error('Error checking if report exists:', checkError);
      console.error('Error details:', {
        code: checkError.code,
        message: checkError.message,
        details: checkError.details,
        hint: checkError.hint
      });
      throw new Error(`Report ${reportId} not found in database`);
    }
    
    console.log('Report found in database:', {
      id: existingReport.id,
      hasContent: !!existingReport.generated_content
    });

    // Use images passed in the request body
    let imagesToUse: (ReportImage)[] = [];
    
    if (images && images.length > 0) {
      console.log('Using provided images:', images.length);
      imagesToUse = images;
    } else {
      console.error('No images provided for report generation');
      return;
    }

    // Update status in database
    console.log('Updating initial status in database...');
    const { error: updateError1 } = await supabase
      .from('reports')
      .update({ 
        generated_content: 'Starting report generation...\n\n[PROCESSING IN PROGRESS...]'
      })
      .eq('id', reportId);
    
    if (updateError1) {
      console.error('Error updating database with initial status:', updateError1);
      console.error('Error details:', {
        code: updateError1.code,
        message: updateError1.message,
        details: updateError1.details,
        hint: updateError1.hint
      });
    } else {
      console.log('Successfully updated initial status');
    }

    // Resize images for AI processing
    console.log('Starting image resizing...');
    const resizedImages = await Promise.all(
      imagesToUse.map(async (img, index) => {
        console.log(`Resizing image ${index + 1}/${imagesToUse.length}`);
        const resizedUrl = await resizeImageForAI(img.url, 1600, 1600, 0.85);
        return { ...img, url: resizedUrl };
      })
    );
    console.log('Image resizing complete');

    // Update status
    console.log('Updating status after image resizing...');
    const { error: updateError2 } = await supabase
      .from('reports')
      .update({ 
        generated_content: `Images resized (${resizedImages.length}). Starting batch processing...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);
      
    if (updateError2) {
      console.error('Error updating database after image resizing:', updateError2);
    } else {
      console.log('Successfully updated status after image resizing');
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
              text: `Process Image Batch #${i + 1} of ${imageChunks.length}: Reference each image once using [IMAGE:X] starting from ${i * 5 + 1}. For each photo below, write bullet-point observations. Where appropriate, incorporate general site knowledge provided here: ${bulletPoints}.`,
            },
            ...currentChunk.flatMap((img: ReportImage, index: number) => [
              {
                type: 'text' as const,
                text: `Photo ${i * 5 + index + 1} Description: ${img.description || 'No description provided'}, Tag: (${img.tag?.toUpperCase() || 'OVERVIEW'}) `,
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

    const FinalReportMessage: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: generalAndSummaryPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `IMPORTANT: All edits must be done by retyping the entire report. Do not delete, the original text from the final report.
                  Here is the draft report composed of ${batchResponses.length} sections that need to be re-ordered and formatted according to the instructions:\n\n${combinedDraft}`,
          },
        ],
      },
    ];

    const FinalReportOutput = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: FinalReportMessage,
      temperature: 0.7,
    });


    const finalReport = FinalReportOutput.choices[0]?.message.content || '';

    
    // Update the database with the final content
    const { error: finalUpdateError } = await supabase
      .from('reports')
      .update({ generated_content: finalReport })
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

 