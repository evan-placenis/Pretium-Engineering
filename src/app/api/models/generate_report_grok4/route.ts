import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { ReportImage } from '@/lib/supabase';
import { embeddingService } from '@/app/projects/[id]/hooks/embedding-service';

// Helper function to chunk array
function chunk<T>(array: T[], size: number): T[][] {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

//### PROMPT 1 ###

const photoWritingPrompt = `
# ROLE:
You are a professional report-writing assistant for a contracting and engineering company. Your job is to convert technical point-form site descriptions into clear, neutral, and **concise** written observations suitable for inclusion in an internal or client-facing construction report. Start the draft immediately—do not include an introduction or conclusion.

# MISSION:
Your output must be technically accurate and professional, but **never verbose**, **never flowery**, and **never include opinions or assumptions**. You are not a marketer — you are writing documentation. Focus on **facts only**.


# RULES:
- For each photo, write one or more professional engineering observations. Every photo must be referenced at least once.
- Do **not** include any headers, intros, or summaries.
- DO NOT include filler words or phrases like "suggesting," "typically," "providing effective," "well-executed," or "appears to", this is a professional report.
- DO NOT make positive assumptions or compliments unless explicitly stated in the input or required by the spec. We do not want to take any legal risk, instead, put it on the contractor.
- DO NOT refer to work as "successful," "complete,", "effective" or speculate on intent unless those words are used in the input.
- ONLY state that something "meets spec" or "as specified" if that is explicitly stated or visually verified.
- Be minimal, technical, and clear. You may incorperate your own civil engineering knowledge, but do not make up facts.
- **ONLY cite specifications when they are provided in the RELEVANT SPECIFICATIONS section.**

# INPUT:
You are given a point-form description and possibly an image tag (e.g. DEFICIENCY or OVERVIEW). Use that to write one or two sentences. Your tone must remain factual and compliant-focused.
Project specifications may be provided alongside image and which can include important facts or requirements. You must reference these specifications if it is meaningful to do so.

# FORMATTING:
- Number each bullet using the format: 1.1, 1.2, 1.3, etc.
- Write **multiple bullet points per image if needed**, but each bullet must independently reference the image using the placeholder format [IMAGE:<image_number>:<GROUP_NAME>].
- **CRITICAL**: The image reference [IMAGE:<image_number>:<GROUP_NAME>] must appear on the SAME LINE as the bullet point text, not on a separate line.
- Use plain text only — no markdown, asterisks, or symbols.
- Do **not** use dashes (") for bullets.
- Section numbers (1., 2., etc.) will be added later by the system — you do **not** need to include them.

# SPECIFICATION CITATION REQUIREMENTS:
**ONLY cite specifications when they are explicitly provided to you in the "RELEVANT SPECIFICATIONS" section below.**

When specifications ARE provided:
1. **Cite specific documents and sections** using the format: "as specified in [Document Name] - [Section Title]"
2. **Reference exact requirements** from the specifications when making compliance statements
3. **Use file names and section headers** from the provided knowledge context to create precise citations
4. **Connect observations directly to specification requirements** rather than making general statements
5. **Include section numbers** when available (e.g., "as specified in Roofing Specs - Section 2.1 Materials")

When NO specifications are provided:
- Write factual observations without referencing any specifications
- Do NOT use phrases like "as specified," "as noted in," "per spec," etc.
- Focus on describing what is observed without making compliance statements

# BAD EXAMPLES (do not imitate text in brackets):

1. **Input description**: "Shingles removed and deck exposed"
   - Output: *(Shingle removal and deck replacement are underway, **indicating the initial stages of the roofing project**. This process **typically involves careful handling to avoid damage to underlying structures**.)*
   - Fix: *Shingles removed; deck exposed for replacement.*

# GOOD EXAMPLES (follow this style):

1. **Input**: "Metal drip edge to be mitered and gap-free"
   - Output: *The Contractor was instructed to ensure that going forward, metal drip edge flashings at the top of the gable are to be neatly mitered and contain no gaps, as specified in Roofing Specifications - Section 2.1 Materials.*

2. **Input**: "Rebar installed at footing per drawings"
   - Output: *Rebar installed at footing location in accordance with construction drawings.*

3. **Input**: "Shingle removal and deck replacement underway"
   - Output: 1.1 The Contractor was reminded that all plywood sheathing replacement is to have a minimum span across three (3) roof trusses, as specified. [IMAGE:1:ROOF]
             1.2 Where tongue and groove plywood is not utilized, metal H-clips should be implemented to provide edge support between roof trusses as per specifications. [IMAGE:1:ROOF]

`;


//-You are encouraged to introduce additional subheadings where appropriate; however, for small observation reports, typically only a few subheadings are needed.
const generalAndSummaryPrompt = `
# ROLE:
You are the final editor of a Civil Engineering report for Pretium. Your job is to format and finalize building observation reports from a draft made of site observations. The technical content is already written. Your task is to apply consistent formatting, group and reorder observations correctly, and ensure the final output is clear, professional, and logically structured.

# CONTEXT:
- Each paragraph corresponds to an observation linked to a photo.
- Observations appear on the left of the final document; images are on the right.
- Your role is to organize and finalize the layout to make it the best possible report. You may make edits to the content, but this must be done by retyping the entire report.
- This section will be appended into an existing "Observations" section, so **do not write a new "Observations" title**.

# INSTRUCTIONS:
1. **Group observations into subheadings** based on the group tag "<GROUP NAME>".
   - Each group becomes a new subheading.
   - If an observation has no group, place it under a section titled **"General Observations"**.
   - If an observation belongs to multiple groups, repeat it under each relevant group.
2. **Order observations within each group** based on the provided image number (e.g., Photo 1, Photo 2, etc.).
   - If the number is missing apply your own judgement.
3. **Retype the entire report** to enforce the correct order and format.
   - Do not skip, delete, or merge any observations (unless it is intented).
   - Every observation must be kept and clearly visible in the final version.
4. **Number subheadings** using whole numbers (e.g., 1., 2., 3., ...).  **CRITICAL**: Always include the period (.) after the number - this indicated a subheading.
5. **Number bullet points within each subheading** as decimals: 1.1, 1.2, 1.3... and 2.1, 2.2... etc.
   - Restart the bullet numbering for each new subheading.
   - There may be **multiple bullet points per image**, each on its own line.
6. Use the format "[IMAGE:<image_number>:<GROUP_NAME>]" to reference images on the same line as the bullet point text.
   - Do not skip or omit image references.
   - Each image must appear exactly once per group.

# FORMATTING RULES:
- Use plain text only. Do not use markdown, asterisks, or any other formatting.
- **CRITICAL**: When starting a new subheading, the number in "[IMAGE:<image_number>:<GROUP_NAME>]" must restart from 1, not continue from the previous subheading.
- Do **not** use dashes ("-") for bullets. Always use numeric bullet formats (1.1, 1.2, etc.).
- Start each bullet point on a new line.
- Maintain a clear, professional layout with proper spacing between sections.

# STYLE:
- Your edits should improve clarity and flow only when necessary.
- No markdown or styling – use plain text output only.
- Ensure we Avoid legal risk by not confirming quality or completeness without directive input.

`;

// Initialize Grok client
const grokClient = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
  timeout: 360000, // Timeout after 360s for reasoning models
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

// Helper function to get relevant knowledge chunks for an image
async function getRelevantKnowledgeChunks(projectId: string, imageDescription: string, imageTag: string): Promise<string> {
  try {
    // Create a search query based on the image description and tag
    const searchQuery = `${imageDescription}`;
    
    // Search for relevant chunks
    const results = await embeddingService.searchSimilarContent(projectId, searchQuery, 2);
    
    if (results.length === 0) {
      return ''; // No relevant knowledge found
    }
    
    // Format the relevant knowledge as context with enhanced citations
    const relevantKnowledge = results.map((result: any, index: number) => {
      const similarity = (result.similarity * 100).toFixed(1);
      
      // Extract document name and section for better citation
      const documentSource = result.documentSource || 'Unknown Document';
      const sectionTitle = result.sectionTitle || 'General Content';
      
      // Create a clean document name (remove file extension and clean up)
      const documentName = documentSource
        .replace(/\.[^/.]+$/, '') // Remove file extension
        .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
        .replace(/\b\w/g, (l: string) => l.toUpperCase()); // Title case
      
      // Create citation format that matches the prompt requirements
      const citation = `${documentName} - ${sectionTitle}`;
      
      return `[Specification ${index + 1} - ${similarity}% relevant from ${citation}]:\n${result.content_chunk}`;
    }).join('\n\n');
    
    console.log(`\n\nRELEVANT KNOWLEDGE CONTEXT:\n${relevantKnowledge}\n`);
    return `\n\nRELEVANT SPECIFICATIONS:\n${relevantKnowledge}\n\nIMPORTANT: When referencing these specifications in your observations, use the exact document name and section title provided in the citations above.`;
    
    
  } catch (error) {
    console.error('Error getting relevant knowledge chunks:', error);
    return ''; // Return empty string if search fails
  }
}

export async function POST(request: Request) {
  try {
    // Validate environment variables
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { bulletPoints, contractName, location, reportId, images, projectId } = body;

    if (!bulletPoints || !reportId || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: bulletPoints, reportId, or projectId' },
        { status: 400 }
      );
    }

    // Check if report already exists and is not already processing
    const { data: existingReport, error: checkError } = await supabase
      .from('reports')
      .select('id, generated_content')
      .eq('id', reportId)
      .single();
      
    if (checkError) {
      return NextResponse.json(
        { error: `Report ${reportId} not found in database` },
        { status: 404 }
      );
    }

    // If report is already being processed, return early
    if (existingReport.generated_content?.includes('[PROCESSING IN PROGRESS...]')) {
      return NextResponse.json({
        success: true,
        message: 'Report generation already in progress',
        reportId: reportId
      });
    }

    // Start the async processing with better error handling
    try {
      // Set initial processing status
      await supabase
        .from('reports')
        .update({ 
          generated_content: 'Starting report generation...\n\n[PROCESSING IN PROGRESS...]'
        })
        .eq('id', reportId);

      // Start processing in background (don't await here to prevent timeout)
      processReportAsync(bulletPoints, contractName, location, reportId, images, projectId)
        .catch(async (error: any) => {
          console.error('Background processing error:', error);
          // Update the report with the error
          await supabase
            .from('reports')
            .update({ 
              generated_content: `Error generating report: ${error.message}\n\nPlease try again or contact support if the issue persists.`
            })
            .eq('id', reportId);
        });

    } catch (error: any) {
      console.error('Error starting report generation:', error);
      // Update the report with the error
      await supabase
        .from('reports')
        .update({ 
          generated_content: `Error starting report generation: ${error.message}\n\nPlease try again or contact support if the issue persists.`
        })
        .eq('id', reportId);
      
      return NextResponse.json(
        { error: 'Failed to start report generation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Report generation started',
      reportId: reportId
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'An error occurred while starting report generation' },
      { status: 500 }
    );
  }
}

async function processReportAsync(bulletPoints: string, contractName: string, location: string, reportId: string, images: any[], projectId: string) {
  try {
    // First, verify the report exists in the database
    const { data: existingReport, error: checkError } = await supabase
      .from('reports')
      .select('id, generated_content')
      .eq('id', reportId)
      .single();
      
    if (checkError) {
      throw new Error(`Report ${reportId} not found in database`);
    }

    // Use images passed in the request body
    let imagesToUse: (ReportImage)[] = [];
    
    if (images && images.length > 0) {
      imagesToUse = images;
    } else {
      return;
    }

    // Status is already set in the main POST function

    // Resize images for AI processing
    const resizedImages = await Promise.all(
      imagesToUse.map(async (img) => {
        const resizedUrl = await resizeImageForAI(img.url, 1600, 1600, 0.85);
        return { ...img, url: resizedUrl };
      })
    );

    // Update status
    const { error: updateError2 } = await supabase
      .from('reports')
      .update({ 
        generated_content: `Images resized (${resizedImages.length}). Starting batch processing...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);
      
    if (updateError2) {
      throw updateError2;
    }

    // Split the images into chunks for better performance
    const imageChunks = chunk(resizedImages, 5);
    const batchResponses: string[] = [];

    // Set up the initial conversation with system prompt and instructions
    const baseMessages = [
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

      // Prepare content parts for this batch
      const contentParts: any[] = [
        {
          type: 'text',
          text: `You are processing Image Batch #${i + 1} of ${imageChunks.length}.
      
                Your task is to write clear, technical, and structured bullet-point observation(s) for each photo provided below. Follow these exact rules:
                
                #IMPORTANT:
                1. Every bullet point **must** reference its image and group using the format [IMAGE:<image_number>:<GROUP_NAME>]. This is the most important rule to follow, without this the output wont display.
                2. If no number is provided, assign one based on its position in this batch , and add a note that the number is not provided.
                3. If you write multiple points for a single image, each bullet must include its own [IMAGE:<image_number>:<GROUP_NAME>] reference.
                4. **CRITICAL**: Use the EXACT group name provided for each image e.g ([IMAGE:<image_number>:<GROUP_NAME>]) , NOT the tag (OVERVIEW/DEFICIENCY). The group name is the actual category the image belongs to.
                5. **CRITICAL**: The image reference [IMAGE:<image_number>:<GROUP_NAME>] must appear on the SAME LINE as the bullet point text, not on a separate line.
                
                # REMEMBER:
                - Use minimal, factual language in accordance with the project specifications or user description.
                -You may incorperate your own civil engineering knowledge and reasoning, but do not make up facts.
                - Only mention compliance or effectiveness if specified.
                - AVOID LEGAL RISK BY: 
                  - not confirming quality or completeness without directive input.
                  - When describing site conditions or instructions, always clarify the contractor's responsibility.
                `,
        }
      ];

      // Process each image in the batch
      for (let j = 0; j < currentChunk.length; j++) {
        const img = currentChunk[j];
        
        // Get relevant knowledge chunks for this image
        const relevantKnowledge = await getRelevantKnowledgeChunks(projectId, img.description || '', img.tag || 'OVERVIEW');
        
        // Add image description with knowledge context
        contentParts.push({
          type: 'text',
          text: `New Photo - Description: ${img.description || 'No description provided'}, Group: (${img.group || 'NO GROUP'}), Number: (${img.number || `NO NUMBER: Position in batch ${i * 5 + j + 1}`}), Tag: (${img.tag?.toUpperCase() || 'OVERVIEW'})

${relevantKnowledge ? `The following specifications are relevant to this photo and should be referenced in your observations. Use the exact document name and section title when citing requirements:

${relevantKnowledge}` : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.'}

IMPORTANT: When referencing this image in your observations, use the EXACT group name "${img.group || 'NO GROUP'}" (not the tag). The correct format is [IMAGE:${img.number || (i * 5 + j + 1)}:${img.group || 'NO GROUP'}].`,
        });
        
        // Add image
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: img.url,
            detail: 'auto',
          },
        });
      }

      const batchMessages = [
        ...baseMessages,
        {
          role: 'user',
          content: contentParts,
        },
      ];

      let response;
      try {
        console.log(`Processing Grok batch ${i + 1}/${imageChunks.length} with ${currentChunk.length} images`);
        response = await grokClient.chat.completions.create({
          model: 'grok-4',
          messages: batchMessages as any,
          temperature: 0.7,
          max_tokens: 10000,
        }, {
          timeout: 120000, // 2 minute timeout per batch
        });
        console.log(`Grok batch ${i + 1} completed successfully`);
      } catch (grokError: any) {
        console.error(`Grok API error in batch ${i + 1}:`, grokError);
        
        // Update database with error and continue with next batch
        const errorMessage = `Error processing batch ${i + 1}: ${grokError.message || 'Grok API timeout or error'}`;
        await supabase
          .from('reports')
          .update({ 
            generated_content: `${batchResponses.join('\n\n')}\n\n${errorMessage}\n\n[PROCESSING IN PROGRESS...]`
          })
          .eq('id', reportId);
        
        // Skip this batch and continue with next
        continue;
      }
      const section = response.choices[0]?.message?.content || '';
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

    const FinalReportMessage = [
      {
        role: 'system',
        content: generalAndSummaryPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:`IMPORTANT: You must retype the entire report. Do **not** delete or omit any original text. Every part of the draft must remain visible in your rewritten version.

                  Follow all user instructions exactly: ${bulletPoints}

                  The draft report below is composed of ${batchResponses.length} sections. You must:
                  1. **Group observations under appropriate section headers based on their group name tag in the reference bullet point- [IMAGE:<image_number>:<GROUP_NAME>].**
                  2. **Within each group, reorder the observations by their associated image number** (i.e., Photo 2 comes before Photo 4).
                  4. Maintain the original format - do not duplicate any content
                  5. - **CRITICAL**: When starting a new subheading, the number in "[IMAGE:<image_number>:<GROUP_NAME>]" must restart from 1, not continue from the previous subheading.

                  Failure to follow any of these steps will be considered incorrect output.

                  Here is the draft report:\n\n${combinedDraft}`
          },
        ],
      },
    ];

    let FinalReportOutput;
    try {
      console.log('Starting Grok final review step');
      FinalReportOutput = await grokClient.chat.completions.create({
        model: 'grok-4',
        messages: FinalReportMessage as any,
        temperature: 0.7,
        max_tokens: 4000,
      }, {
        timeout: 180000, // 3 minute timeout for final review
      });
      console.log('Grok final review completed successfully');
    } catch (finalError: any) {
      console.error('Final review Grok API error:', finalError);
      
      // If final review fails, use the combined draft as the final result
      const finalReport = combinedDraft + '\n\n[Note: Final formatting step failed due to API timeout. Report content is complete but may need manual formatting.]';
      
      await supabase
        .from('reports')
        .update({ generated_content: finalReport })
        .eq('id', reportId);
      
      return; // Exit successfully with partial result
    }
    const finalReport = FinalReportOutput.choices[0]?.message?.content || '';

    
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