

//  //-----------------
//  import { NextRequest, NextResponse } from 'next/server';
// import OpenAI from 'openai';
// import { createClient } from '@supabase/supabase-js';
// import { ReportImage } from '@/lib/supabase';

// // Helper function to chunk array
// function chunk<T>(array: T[], size: number): T[][] {
//   const chunked: T[][] = [];
//   for (let i = 0; i < array.length; i += size) {
//     chunked.push(array.slice(i, i + size));
//   }
//   return chunked;
// }

// //### PROMPT 1 ###

// const photoWritingPrompt = `
// # ROLE:
// You are a senior engineering report writer at Pretium. Your task is to generate technically accurate and concise bullet-point observations based strictly on a batch of site photographs. These observations will form an internal draft used later to produce the final report. Start the draft immediately—do not include an introduction or conclusion.

// # CONTEXT:
// Each image includes:
// - A brief description that must be heavily used to guide your analysis.
// - A tag indicating either OVERVIEW or DEFICIENCY

// Use these to guide your analysis:
// - OVERVIEW: Describe general site conditions or context
// - DEFICIENCY: Emphasize the issue observed and its potential implications

// # INSTRUCTIONS:
// 1. For each photo, write one or more professional engineering observations.
// 2. Enhance the provided description with technical insights where appropriate.
// 3. You may incorporate relevant general engineering knowledge if applicable.
// 4. Write **multiple bullet points per image if needed**, but:
//    - Each bullet must independently reference the image using the placeholder format [IMAGE:<image_number>:<GROUP_NAME>].
//    - Do **not** merge multiple ideas into one bullet point.
// 5. Every photo must be referenced at least once.
// 6. If a photo number is missing, assign it based on its position in the batch and leave a note that the number is not provided.
// 7. Use the reference bullet points (provided by the user) as supporting context when writing your observations.
// 8. Do **not** include any headers, intros, or summaries.

// # FORMATTING:
// - Number each bullet using the format: 1.1, 1.2, 1.3, etc.
// - Use plain text only — no markdown, asterisks, or symbols.
// - Do **not** use dashes (“-”) for bullets.
// - Each bullet must include a photo reference in the format "[IMAGE:X]", based on the image number provided.
// - Section numbers (1., 2., etc.) will be added later by the system — you do **not** need to include them.

// # STYLE:
// - Tone: Professional, technical, and objective
// - Be precise and clear
// - No unnecessary embellishments
// - Plain text only — no styling markdown, asterisks, or symbols.
// `;


// //-You are encouraged to introduce additional subheadings where appropriate; however, for small observation reports, typically only a few subheadings are needed.
// const generalAndSummaryPrompt = `
// # ROLE:
// You are the final editor of a Civil Engineering report for Pretium. Your job is to format and finalize building observation reports from a draft made of site observations. The technical content is already written. Your task is to apply consistent formatting, group and reorder observations correctly, and ensure the final output is clear, professional, and logically structured.

// # CONTEXT:
// - Each paragraph corresponds to an observation linked to a photo.
// - Observations appear on the left of the final document; images are on the right.
// - You will **not** be generating new content. Your role is to organize and finalize the layout.
// - This section will be appended into an existing "Observations" section, so **do not write a new "Observations" title**.

// # INSTRUCTIONS:
// 1. **Group observations into subheadings** based on the group tag "<GROUP NAME>".
//    - Each group becomes a new subheading.
//    - If an observation has no group, place it under a section titled **"General Observations"**.
//    - If an observation belongs to multiple groups, repeat it under each relevant group.
// 2. **Order observations within each group** based on the provided image number (e.g., Photo 1, Photo 2, etc.).
//    - If the number is missing apply your own judgement.
// 3. **Retype the entire report** to enforce the correct order and format.
//    - Do not skip, delete, or merge any observations.
//    - Every observation must be kept and clearly visible in the final version.
// 4. **Number subheadings** using whole numbers (e.g., 1, 2, 3...).
// 5. **Number bullet points within each subheading** as decimals: 1.1, 1.2, 1.3... and 2.1, 2.2... etc.
//    - Restart the bullet numbering for each new subheading.
//    - There may be **multiple bullet points per image**, each on its own line.
// 6. Use the format "[IMAGE:<image_number>:<GROUP_NAME>]" to reference images.
//    - Do not skip or omit image references.
//    - Each image must appear exactly once per group.

// # FORMATTING RULES:
// - Use plain text only. Do not use markdown, asterisks, or any other formatting.
// - Do **not** use dashes ("-") for bullets. Always use numeric bullet formats (1.1, 1.2, etc.).
// - Start each bullet point on a new line.
// - Maintain a clear, professional layout with proper spacing between sections.

// # STYLE:
// - Tone: Professional, objective, and concise.
// - Do not embellish or add filler text.
// - Your edits should improve clarity, grammar, and flow only when necessary.
// - No markdown or styling – use plain text output only.
// `;


// const old_generalAndSummaryprompt =  `
// #ROLE:
// -You are the final editor of a Report for a Civil Engineering firm called Pretium. Your role is to format and finalize building observation reports based on a rough draft composed of a series of site observations. The core content has already been generated. Your primary responsibility is to apply consistent formatting, structure the report with appropriate headers, and ensure clarity and professionalism. You are not expected to rewrite or elaborate on the observations—focus on organizing and polishing the report layout.


// #CONTEXT:
// -Each chunk of text corresponds to an observation related to a specific image. In the final formatted report, the observation text will appear on the left, with the associated image on the right. These text-image pairs may not be in their optimal order initially. Your task is to ensure a logical and cohesive flow throughout the report by reordering them where appropriate.
// -The report already has a "General Project Status" and "Observations" section created manually. Your output is appended into the already existing "Observations" sections, so make appropriate subheadings and bullet points.

// #INSTRUCTIONS:
// -If reordering is required, you may do so by retyping the report and placing the relevant text-image pairs in the appropriate order. Do not alter or remove any of the original text in the editing process
// -Ensure bullet point observations are separated by a new line with a number in front of them. (E.g 1.1, 1.2, 1.3, ect..)
// -You must reorder photos/observations into subheadings based on the group name which is provided as [GROUP:<GROUP NAME>] at the end of the description. The subheading must be the group name.
// -An image-text pair may be a part of multiple groups. In this case the image must appear once in each group.
// -If the image is not part of a group, create one subheading called "General Observations" and group all the images that are not part of a group.
// - The order of the images within a subheading is crucial. Make sure to reference the images in the order of the number of each image. In the user did not provide a number, a note will be provided and you should use your own judgement to determine the order.
// -Each subheading should be numbered (e.g., 1). Bullet points under a subheading should be labeled sequentially (e.g., 1.1, 1.2, etc.). When a new group is tagged, the subheading has now changed and the numbers should increase (e.g., 2.1, 2.2, etc.)
// -Once reordering is complete, read the contents of the report thorouhgly from start to finish. You may edit or add additional text where appropriate. As the final editor, you have discretion to make adjustments to improve clarity and flow.
// -Do not write a title "Observations" because it already exists.

// #FORMATTING:
// - Ensure proper formatting of bullet points. Reference each photo using the placeholder format [IMAGE:X] (e.g., [IMAGE:1], [IMAGE:2]). 
// - There can (and should) be multiple bullet points per image separated by a new line.
// - Do not use "-" to start a bullet point, instead use the appropriate number. Note: Never use "-" in professional reports.

// #STYLE:
// - Engineering field report tone
// - Plain text only (no markdown, no styling)
// - Concise, objective, and formal
// `;

// const old_photoWritingPrompt  = `
// #ROLE:
// You are a senior engineering report writer for Pretium. Your task is to generate detailed and technically accurate observations based strictly on the batch of site photographs provided. These observation narratives will form an internal draft, to be used at a later time to generate a full report. Start the draft directly. Do not include preambles. 


// #CONTEXT:
// Each image is provided with a short description and a tag  (OVERVIEW or DEFICIENCY). Use this information to guide your interpretation.

// #INSTRUCTIONS:
// - Refer to the provided description and the tags to guide your focus. Use this information to help analyze the content of the images.
// - For each photo, professionally write observations based on the description and the tag. Enhance the description that was provided and add more detail where appropriate.
// - You are encouraged to incorporate relevant general knowledge to enhance your analysis of the images.
// - The Tags influence the tone of the description in the following ways:
//   -- DEFICIENCY photos: emphasize the issue and its potential consequences.
//   -- OVERVIEW photos: describe the contents of the image in general terms 
// - Aim for concise observations (1–2 sentences). You are encouraged to write mulitple bullet points per image, each point must reference the photo using the placeholder format [IMAGEID:X] (e.g., [IMAGE:1], [IMAGE:2]). 
// - If you have more than one point to write about, split them into separate bullets.
// - Do NOT write an introduction or a conclusion section for your findings of the batch.
// - You must consider the reference bullet points about the overall site (provided to you) when making observations.


// #FORMATTING:
// - Reference each photo using the placeholder format [IMAGEID:X] (e.g., [IMAGE:1], [IMAGE:2]). The number is based off of the number provided to you. If the number is not provided, use the number of the image in the batch.
// - Each image must be referenced at least once.
// - Sections are formatted with a number in the format - 1. , 2., 3. ect.. [This is not your job]
// - Bullet points are formatted with a number in the format - 1.1 , 1.2, 1.3  ect..
// - Do not use "-" to start a bullet point, instead use the appropriate number. Note: Never use "-" in professional reports.

 
// #STYLE:
// - Professional engineering tone.
// - Precise, complete, and objective language.
// - Plain text only — no markdown, no asterisks, no styling. 
// `;



// // Initialize OpenAI client
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// // Initialize Supabase client
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// const supabase = createClient(supabaseUrl, supabaseServiceKey);

// // Helper function to resize image
// async function resizeImageForAI(imageUrl: string, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.8): Promise<string> {
//   try {
//     // Fetch the original image
//     const response = await fetch(imageUrl);
//     if (!response.ok) {
//       throw new Error(`Failed to fetch image: ${response.statusText}`);
//     }
    
//     const arrayBuffer = await response.arrayBuffer();
//     const buffer = Buffer.from(arrayBuffer);
    
//     // Import sharp dynamically (install with: npm install sharp @types/sharp)
//     const sharp = require('sharp');
    
//     // Resize and compress the image
//     const resizedImageBuffer = await sharp(buffer)
//       .resize(maxWidth, maxHeight, { 
//         fit: 'inside', 
//         withoutEnlargement: true 
//       })
//       .jpeg({ quality: Math.round(quality * 100) })
//       .toBuffer();
    
//     // Convert to base64 data URL
//     const base64Image = resizedImageBuffer.toString('base64');
//     return `data:image/jpeg;base64,${base64Image}`;
    
//   } catch (error) {
//     console.error('Error resizing image:', error);
//     // Fallback to original URL if resizing fails
//     return imageUrl;
//   }
// }

// export async function POST(request: Request) {
//   try {
//     const body = await request.json();
//     const { bulletPoints, contractName, location, reportId, images } = body;

//     if (!bulletPoints || !reportId) {
//       return NextResponse.json(
//         { error: 'Missing required fields' },
//         { status: 400 }
//       );
//     }

//     // Start the async processing
//     try {
//       await processReportAsync(bulletPoints, contractName, location, reportId, images);
//     } catch (error: any) {
//       // Update the report with the error
//       await supabase
//         .from('reports')
//         .update({ 
//           generated_content: `Error generating report: ${error.message}\n\nPlease try again or use a different model.`
//         })
//         .eq('id', reportId);
//       throw error;
//     }

//     return NextResponse.json({
//       success: true,
//       message: 'Report generation started',
//       reportId: reportId
//     });
//   } catch (error: any) {
//     return NextResponse.json(
//       { error: error.message || 'An error occurred while starting report generation' },
//       { status: 500 }
//     );
//   }
// }

// async function processReportAsync(bulletPoints: string, contractName: string, location: string, reportId: string, images: any[]) {
//   try {
//     // First, verify the report exists in the database
//     const { data: existingReport, error: checkError } = await supabase
//       .from('reports')
//       .select('id, generated_content')
//       .eq('id', reportId)
//       .single();
      
//     if (checkError) {
//       throw new Error(`Report ${reportId} not found in database`);
//     }

//     // Use images passed in the request body
//     let imagesToUse: (ReportImage)[] = [];
    
//     if (images && images.length > 0) {
//       imagesToUse = images;
//     } else {
//       return;
//     }

//     // Update status in database
//     const { error: updateError1 } = await supabase
//       .from('reports')
//       .update({ 
//         generated_content: 'Starting report generation...\n\n[PROCESSING IN PROGRESS...]'
//       })
//       .eq('id', reportId);
    
//     if (updateError1) {
//       throw updateError1;
//     }

//     // Resize images for AI processing
//     const resizedImages = await Promise.all(
//       imagesToUse.map(async (img) => {
//         const resizedUrl = await resizeImageForAI(img.url, 1600, 1600, 0.85);
//         return { ...img, url: resizedUrl };
//       })
//     );

//     // Update status
//     const { error: updateError2 } = await supabase
//       .from('reports')
//       .update({ 
//         generated_content: `Images resized (${resizedImages.length}). Starting batch processing...\n\n[PROCESSING IN PROGRESS...]`
//       })
//       .eq('id', reportId);
      
//     if (updateError2) {
//       throw updateError2;
//     }

//     // Split the images into chunks for better performance
//     const imageChunks = chunk(resizedImages, 5);
//     const batchResponses: string[] = [];

//     // Set up the initial conversation with system prompt and instructions
//     const baseMessages: OpenAI.ChatCompletionMessageParam[] = [
//       {
//         role: 'system',
//         content: photoWritingPrompt ,
//       },
//     ];

//     // Process each batch
//     for (let i = 0; i < imageChunks.length; i++) {
//       const currentChunk = imageChunks[i];
      
//       // Update status in database
//       const { error: updateErrorBatch } = await supabase
//         .from('reports')
//         .update({ 
//           generated_content: `Processing batch ${i + 1}/${imageChunks.length} (${currentChunk.length} images)...\n\n${batchResponses.join('\n\n')}\n\n[PROCESSING IN PROGRESS...]`
//         })
//         .eq('id', reportId);
        
//       if (updateErrorBatch) {
//         console.error(`Error updating database before batch ${i + 1}:`, updateErrorBatch);
//       }

//       const batchMessages: OpenAI.ChatCompletionMessageParam[] = [
//         ...baseMessages,
//         {
//           role: 'user',
//           content: [
//             {
//               type: 'text',
//               text: `You are processing Image Batch #${i + 1} of ${imageChunks.length}.
      
//                     Your task is to write clear, technical, and structured bullet-point observation(s) for each photo provided below. Follow these exact rules:
                    
//                     1. IMPORTANT:Every bullet point **must** reference its image and group using the format [IMAGE:<image_number>:<GROUP_NAME>]. This is the most important rule to follow, without this the output wont display.
//                     2. If no number is provided, assign one based on its position in this batch , and add a note: "(number not provided)".
//                     3. If you write multiple points for a single image, each bullet must include its own [IMAGE:<image_number>:<GROUP_NAME>] reference.
//                     5. Observations must be written professionally and objectively. Focus on the description provided and what is visible and relevant.
                    
//                     IMPORTANT: The following instructions are provided by the user. If they relate to your job of writing photo-based observations, they MUST be followed exactly:\n\n${bulletPoints}`,
//             },
//             ...currentChunk.flatMap((img: ReportImage, index: number) => [
//               {
//                 type: 'text' as const,
//                 text: `New Photo - Description: ${img.description || 'No description provided'}, Group: (${img.group || 'NO GROUP'}), Number: (${img.number || `NO NUMBER: Position in batch ${i * 5 + index + 1}`}), Tag: (${img.tag?.toUpperCase() || 'OVERVIEW'})`,
//               },
//               {
//                 type: 'image_url' as const,
//                 image_url: {
//                   url: img.url,
//                   detail: 'auto' as const,
//                 },
//               },
//             ]),
//           ],
//         },
//       ];


//       const response = await openai.chat.completions.create({
//         model: 'gpt-4o',
//         messages: batchMessages,
//         temperature: 0.7,
//       });
    
//       const section = response.choices[0]?.message.content || '';
//       batchResponses.push(section);
      
//       // Update database with the current progress
//       const combinedSoFar = batchResponses.join('\n\n');
//       const { error: updateErrorAfterBatch } = await supabase
//         .from('reports')
//         .update({ 
//           generated_content: combinedSoFar + '\n\n[PROCESSING IN PROGRESS...]'
//         })
//         .eq('id', reportId);
        
//       if (updateErrorAfterBatch) {
//         console.error(`Error updating database after batch ${i + 1}:`, updateErrorAfterBatch);
//       }
//     }
    
//     // Update status
//     await supabase
//       .from('reports')
//       .update({ 
//         generated_content: batchResponses.join('\n\n') + '\n\nStarting final review...\n\n[PROCESSING IN PROGRESS...]'
//       })
//       .eq('id', reportId);

//     // Final review step
//     const combinedDraft = batchResponses.join('\n\n');

//     const FinalReportMessage: OpenAI.ChatCompletionMessageParam[] = [
//       {
//         role: 'system',
//         content: generalAndSummaryPrompt,
//       },
//       {
//         role: 'user',
//         content: [
//           {
//             type: 'text',
//             text:`IMPORTANT: You must retype the entire report. Do **not** delete or omit any original text. Every part of the draft must remain visible in your rewritten version.

//                   Follow all user instructions exactly: ${bulletPoints}

//                   The draft report below is composed of ${batchResponses.length} sections. You must:
//                   1. **Group observations under appropriate section headers based on their group name tag in the reference bullet point- [IMAGE:<image_number>:<GROUP_NAME>].**
//                   2. **Within each group, reorder the observations by their associated image number** (i.e., Photo 2 comes before Photo 4).
//                   3. Retain all original content — you are rewriting and reformatting, not summarizing.

//                   Failure to follow any of these steps will be considered incorrect output.

//                   Here is the draft report:\n\n${combinedDraft}`
//           },
//         ],
//       },
//     ];

//     const FinalReportOutput = await openai.chat.completions.create({
//       model: 'gpt-4o',
//       messages: FinalReportMessage,
//       temperature: 0.7,
//     });


//     const finalReport = FinalReportOutput.choices[0]?.message.content || '';

    
//     // Update the database with the final content
//     const { error: finalUpdateError } = await supabase
//       .from('reports')
//       .update({ generated_content: finalReport })
//       .eq('id', reportId);
      
//     if (finalUpdateError) {
//       console.error('Error updating database with final content:', finalUpdateError);
//     }

//   } catch (error: any) {
//     console.error('Error in async processing:', error);
//     // Update database with error
//     await supabase
//       .from('reports')
//       .update({ 
//         generated_content: `Error generating report: ${error.message}\n\nPlease try again or use a different model.`
//       })
//       .eq('id', reportId);
//   }
// }

 