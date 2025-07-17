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

//### PROMPT 1 ###

const photoWritingPrompt = `
# ROLE:
You are a professional report-writing assistant for a contracting and engineering company. Your job is to convert technical point-form site descriptions into clear, neutral, and **concise** written observations suitable for inclusion in an internal or client-facing construction report. Start the draft immediately—do not include an introduction or conclusion.

# MISSION:
Your output must be technically accurate and professional, but **never verbose**, **never flowery**, and **never include opinions or assumptions**. You are not a marketer — you are writing documentation. Focus on **facts only**.


# RULES:
- For each photo, write one or more professional engineering observations. Every photo must be referenced at least once.
- Do **not** include any headers, intros, or summaries.
- DO NOT include filler words or phrases like "suggesting," "typically," "providing effective," "well-executed," or "appears to."
- DO NOT make positive assumptions or compliments unless explicitly stated in the input or required by the spec.
- DO NOT refer to work as "successful," "complete," or "effective" unless those words are used in the input.
- DO NOT speculate on intent or process unless described directly.
- ONLY state that something "meets spec" or "as specified" if that is explicitly stated or visually verified.
- LESS TEXT IS BETTER. Be minimal, technical, and clear.
- **ONLY cite specifications when they are provided in the RELEVANT SPECIFICATIONS section.**

# INPUT:
You are given a point-form description and possibly an image tag (e.g. DEFICIENCY or OVERVIEW). Use that to write one or two sentences. Your tone must remain factual and compliant-focused.
Project specifications may be provided alongside image and which can include important facts or requirements. You must reference these specifications if it is meaningful to do so.

# FORMATTING:
- Number each bullet using the format: 1.1, 1.2, 1.3, etc.
- Write **multiple bullet points per image if needed**, but each bullet must independently reference the image using the placeholder format [IMAGE:<image_number>:<GROUP_NAME>].
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

# CITATION EXAMPLES:
**When specifications ARE provided:**
- ✅ "Metal drip edge flashings must be mitered and gap-free as specified in Roofing Specifications - Section 2.1 Materials"
- ✅ "Insulation depth measured at 18 to 20 inches, providing R-value of R-63 to R-70 as required by Building Envelope Specs - Section 3.2 Insulation Requirements"

**When NO specifications are provided:**
- ✅ "Self-adhered membrane applied at roof eaves and rakes with underlayment in the field"
- ✅ "Insulation depth measured at 18 to 20 inches, providing R-value of R-63 to R-70"
- ❌ "Self-adhered membrane applied as noted in" (incomplete reference)
- ❌ "Insulation meets requirements as specified" (no specification provided)

# BAD EXAMPLES (do not imitate text in brackets):

1. **Input description**: "Insulation is 18 to 20 inches deep"
   - Output: *Insulation depth is measured between 18 to 20 inches, providing an R-value of R-63 to R-70, (**which meets or exceeds typical standards for attic insulation**).*
   - Fix: *Insulation depth measured at 18 to 20 inches, providing R-value of R-63 to R-70.*

2. **Input description**: "Shingles removed and deck exposed"
   - Output: *Shingle removal **and deck replacement are underway, indicating the initial stages of the roofing project**. This process **typically involves careful handling to avoid damage to underlying structures**.)*
   - Fix: *Shingles removed; deck exposed for replacement.*

# GOOD EXAMPLES (follow this style):

1. **Input**: "Metal drip edge to be mitered and gap-free"
   - Output: *The Contractor was instructed to ensure that metal drip edge flashings at the top of the gable are to be neatly mitered and contain no gaps, as specified in Roofing Specifications - Section 2.1 Materials.*

2. **Input**: "Damaged insulation observed"
   - Output: *Section of insulation observed to be damaged; replacement required.*

3. **Input**: "Rebar installed at footing per drawings"
   - Output: *Rebar installed at footing location in accordance with construction drawings.*

4. **Input**: "Shingle removal and deck replacement underway"
   - Output: 1.1 The Contractor was reminded that all plywood sheathing replacement is to have a minimum span across three (3) roof trusses, as specified.
             1.2 Where tongue and groove plywood is not utilized, metal H-clips should be implemented to provide edge support between roof trusses as per specifications.

`;


//-You are encouraged to introduce additional subheadings where appropriate; however, for small observation reports, typically only a few subheadings are needed.
const generalAndSummaryPrompt = `
# ROLE:
You are the final editor of a Civil Engineering report for Pretium. Your job is to format and finalize building observation reports from a draft made of site observations. The technical content is already written. Your task is to apply consistent formatting, group and reorder observations correctly, and ensure the final output is clear, professional, and logically structured.

# CONTEXT:
- Each paragraph corresponds to an observation linked to a photo.
- Observations appear on the left of the final document; images are on the right.
- You will **not** be generating new content. Your role is to organize and finalize the layout.
- This section will be appended into an existing "Observations" section, so **do not write a new "Observations" title**.

# INSTRUCTIONS:
1. **Group observations into subheadings** based on the group tag "<GROUP NAME>".
   - Each group becomes a new subheading.
   - If an observation has no group, place it under a section titled **"General Observations"**.
   - If an observation belongs to multiple groups, repeat it under each relevant group.
2. **Order observations within each group** based on the provided image number (e.g., Photo 1, Photo 2, etc.).
   - If the number is missing apply your own judgement.
3. **Retype the entire report** to enforce the correct order and format.
   - Do not skip, delete, or merge any observations.
   - Every observation must be kept and clearly visible in the final version.
4. **Number subheadings** using whole numbers (e.g., 1., 2., 3. , ...).  **CRITICAL**: Always include the period (.) after the number - this indicated a subheading.
5. **Number bullet points within each subheading** as decimals: 1.1, 1.2, 1.3... and 2.1, 2.2... etc.
   - Restart the bullet numbering for each new subheading.
   - There may be **multiple bullet points per image**, each on its own line.
6. Use the format "[IMAGE:<image_number>:<GROUP_NAME>]" to reference images.
   - Do not skip or omit image references.
   - Each image must appear exactly once per group.

# FORMATTING RULES:
- Use plain text only. Do not use markdown, asterisks, or any other formatting.
- Do **not** use dashes ("-") for bullets. Always use numeric bullet formats (1.1, 1.2, etc.).
- **CRITICAL**: When starting a new subheading, the number in "[IMAGE:<image_number>:<GROUP_NAME>]" must restart from 1, not continue from the previous subheading.
- Start each bullet point on a new line.
- Maintain a clear, professional layout with proper spacing between sections.

# STYLE:
- Your edits should improve clarity and flow only when necessary.
- No markdown or styling – use plain text output only.
- Ensure we Avoid legal risk by not confirming quality or completeness without directive input.

`;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  const startTime = Date.now();
  console.log(`[DEBUG] POST request started at ${new Date().toISOString()}`);
  
  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY) {
      console.log('[DEBUG] Missing OPENAI_API_KEY');
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log('[DEBUG] Parsing request body...');
    const body = await request.json();
    const { bulletPoints, contractName, location, reportId, images, projectId } = body;

    console.log('[DEBUG] Request data:', {
      hasBulletPoints: !!bulletPoints,
      hasReportId: !!reportId,
      hasProjectId: !!projectId,
      imagesCount: images?.length || 0
    });

    if (!bulletPoints || !reportId || !projectId) {
      console.log('[DEBUG] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: bulletPoints, reportId, or projectId' },
        { status: 400 }
      );
    }

    // Validate images array
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.log('[DEBUG] No images provided');
      return NextResponse.json(
        { error: 'No images provided for report generation' },
        { status: 400 }
      );
    }

    console.log('[DEBUG] Checking existing report...');
    // Check if report already exists and is not already processing
    const { data: existingReport, error: checkError } = await supabase
      .from('reports')
      .select('id, generated_content')
      .eq('id', reportId)
      .single();
      
    if (checkError) {
      console.log('[DEBUG] Report not found:', checkError);
      return NextResponse.json(
        { error: `Report ${reportId} not found in database` },
        { status: 404 }
      );
    }

    // If report is already being processed, return early
    if (existingReport.generated_content?.includes('[PROCESSING IN PROGRESS...]')) {
      console.log('[DEBUG] Report already processing, returning early');
      return NextResponse.json({
        success: true,
        message: 'Report generation already in progress',
        reportId: reportId
      });
    }

    console.log('[DEBUG] Setting initial processing status...');
    // Set initial processing status
    const { error: initialUpdateError } = await supabase
      .from('reports')
      .update({ 
        generated_content: 'Starting report generation...\n\n[PROCESSING IN PROGRESS...]'
      })
      .eq('id', reportId);

    if (initialUpdateError) {
      console.log('[DEBUG] Error setting initial status:', initialUpdateError);
      throw initialUpdateError;
    }

    console.log('[DEBUG] Starting synchronous report processing...');
    // Process the report synchronously instead of in background
    try {
      await processReportAsync(bulletPoints, contractName, location, reportId, images, projectId);
      console.log('[DEBUG] Report processing completed successfully');
    } catch (error: any) {
      console.error('[DEBUG] Error during report processing:', error);
      // Update the report with the error
      await supabase
        .from('reports')
        .update({ 
          generated_content: `Error generating report: ${error.message}\n\nPlease try again or contact support if the issue persists.`
        })
        .eq('id', reportId);
      
      return NextResponse.json(
        { error: 'Report generation failed' },
        { status: 500 }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`[DEBUG] POST request completed successfully in ${totalTime}ms`);
    return NextResponse.json({
      success: true,
      message: 'Report generation completed successfully',
      reportId: reportId
    });
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[DEBUG] POST request error after ${totalTime}ms:`, error);
    return NextResponse.json(
      { error: 'Invalid request format or server error' },
      { status: 500 }
    );
  }
}

async function processReportAsync(bulletPoints: string, contractName: string, location: string, reportId: string, images: any[], projectId: string) {
  const startTime = Date.now();
  console.log(`[DEBUG] processReportAsync started at ${new Date().toISOString()} for report ${reportId}`);
  
  try {
    console.log('[DEBUG] Verifying report exists in database...');
    // First, verify the report exists in the database
    const { data: existingReport, error: checkError } = await supabase
      .from('reports')
      .select('id, generated_content')
      .eq('id', reportId)
      .single();
      
    if (checkError) {
      console.log('[DEBUG] Report not found in processReportAsync:', checkError);
      throw new Error(`Report ${reportId} not found in database`);
    }

    console.log('[DEBUG] Processing images...');
    // Use images passed in the request body
    let imagesToUse: (ReportImage)[] = [];
    
    if (images && images.length > 0) {
      // Limit images for Vercel serverless environment
      if (images.length > 20) {
        console.log(`[DEBUG] Too many images (${images.length}) for Vercel serverless. Limiting to 20.`);
        imagesToUse = images.slice(0, 20);
      } else {
        imagesToUse = images;
      }
    } else {
      console.log('[DEBUG] No images to process');
      return;
    }

    console.log(`[DEBUG] Processing ${imagesToUse.length} images...`);

    // Status is already set in the main POST function

    // Resize images for AI processing
    console.log('[DEBUG] Starting image resizing...');
    const resizedImages = await Promise.all(
      imagesToUse.map(async (img, index) => {
        console.log(`[DEBUG] Resizing image ${index + 1}/${imagesToUse.length}...`);
        try {
          const resizedUrl = await resizeImageForAI(img.url, 1600, 1600, 0.85);
          console.log(`[DEBUG] Image ${index + 1} resized successfully`);
          return { ...img, url: resizedUrl };
        } catch (error) {
          console.error(`[DEBUG] Error resizing image ${index + 1}:`, error);
          // Fallback to original URL
          return img;
        }
      })
    );

    console.log('[DEBUG] All images resized, updating status...');
    // Update status
    const { error: updateError2 } = await supabase
      .from('reports')
      .update({ 
        generated_content: `Images resized (${resizedImages.length}). Starting batch processing...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);
      
    if (updateError2) {
      console.log('[DEBUG] Error updating status after image resize:', updateError2);
      throw updateError2;
    }

    console.log('[DEBUG] Splitting images into chunks...');
    // Split the images into smaller chunks for Vercel serverless environment
    const imageChunks = chunk(resizedImages, 1); // Process 1 image at a time for faster processing
    const batchResponses: string[] = [];

    console.log(`[DEBUG] Created ${imageChunks.length} chunks of 1 image each`);

    // Set up the initial conversation with system prompt and instructions
    const baseMessages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: photoWritingPrompt ,
      },
    ];

    // Process each batch
    for (let i = 0; i < imageChunks.length; i++) {
      const batchStartTime = Date.now();
      const currentChunk = imageChunks[i];
      
      console.log(`[DEBUG] Processing batch ${i + 1}/${imageChunks.length} with ${currentChunk.length} images...`);
      
      // Update status in database with progress percentage and timing info
      const progressPercent = Math.round(((i + 1) / imageChunks.length) * 100);
      const startTime = new Date().toISOString();
      const { error: updateErrorBatch } = await supabase
        .from('reports')
        .update({ 
          generated_content: `Processing batch ${i + 1}/${imageChunks.length} (${currentChunk.length} images) - ${progressPercent}% complete...\nStarted at: ${startTime}\n\n${batchResponses.join('\n\n')}\n\n[PROCESSING IN PROGRESS...]`
        })
        .eq('id', reportId);
        
      if (updateErrorBatch) {
        console.error(`[DEBUG] Error updating database before batch ${i + 1}:`, updateErrorBatch);
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
                4. **CRITICAL**: Use the EXACT group name provided for each image (e.g., [IMAGE:<image_number>:<GROUP_NAME>]), NOT the tag (OVERVIEW/DEFICIENCY). The group name is the actual category the image belongs to.
                
                # REMEMBER:
                - Use minimal, factual language in accordance with the project specifications or user description.
                - Only mention compliance or effectiveness if specified.
                - Do not include process descriptions unless provided.
                - AVOID LEGAL RISK BY: 
                  - not confirming quality or completeness without directive input.
                  - When describing site conditions or instructions, always clarify the contractor's responsibility.
                  - connect actions to the specification where applicable ("...as per spec", "...is required by spec", etc.).
               `,
        }
      ];

      // Process each image in the batch
      for (let j = 0; j < currentChunk.length; j++) {
        const img = currentChunk[j];
        
        console.log(`[DEBUG] Processing image ${j + 1} in batch ${i + 1}`);
        
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

      const batchMessages: OpenAI.ChatCompletionMessageParam[] = [
        ...baseMessages,
        {
          role: 'user',
          content: contentParts,
        },
      ];

      console.log(`[DEBUG] Calling OpenAI API for batch ${i + 1}`);
      let response;
      try {
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: batchMessages,
          temperature: 0.7,
          max_tokens: 4000, // Reduced for Vercel serverless environment
        }, {
          timeout: 30000, // 30 second timeout per batch (Vercel serverless limit)
        });
        
        const batchTime = Date.now() - batchStartTime;
        console.log(`[DEBUG] OpenAI API call for batch ${i + 1} completed in ${batchTime}ms`);
      } catch (openaiError: any) {
        const batchTime = Date.now() - batchStartTime;
        console.error(`[DEBUG] OpenAI API error in batch ${i + 1} after ${batchTime}ms:`, openaiError);
        
        // Check if it's a timeout or token limit error
        const isTimeout = openaiError.message?.includes('timeout') || 
                         openaiError.code === 'ECONNRESET' ||
                         openaiError.status === 408;
        const isTokenLimit = openaiError.message?.includes('token') || 
                           openaiError.status === 400;
        
        let errorMessage = '';
        if (isTimeout) {
          errorMessage = `Batch ${i + 1} timed out - this is likely due to serverless function limits. Try using fewer images or the Grok model.`;
        } else if (isTokenLimit) {
          errorMessage = `Batch ${i + 1} hit token limit - try using fewer images or shorter descriptions.`;
        } else {
          errorMessage = `Error processing batch ${i + 1}: ${openaiError.message || 'OpenAI API error'}`;
        }
        
        console.log(`[DEBUG] Updating database with error for batch ${i + 1}...`);
        // Update database with detailed error and STOP processing
        const finalErrorContent = `${batchResponses.join('\n\n')}\n\n❌ ${errorMessage}\n\n[PROCESSING FAILED - Please try again with fewer images or use a different model]`;
        await supabase
          .from('reports')
          .update({ 
            generated_content: finalErrorContent
          })
          .eq('id', reportId);
        
        // Stop processing - don't continue with more batches
        console.error(`[DEBUG] Stopping report generation due to error in batch ${i + 1}`);
        return;
      }
    
      const section = response.choices[0]?.message.content || '';
      batchResponses.push(section);
      
      console.log(`[DEBUG] Batch ${i + 1} completed, updating database...`);
      // Update database with the current progress
      const combinedSoFar = batchResponses.join('\n\n');
      const { error: updateErrorAfterBatch } = await supabase
        .from('reports')
        .update({ 
          generated_content: combinedSoFar + '\n\n[PROCESSING IN PROGRESS...]'
        })
        .eq('id', reportId);
        
      if (updateErrorAfterBatch) {
        console.error(`[DEBUG] Error updating database after batch ${i + 1}:`, updateErrorAfterBatch);
      }
    }
    
    console.log('[DEBUG] All batches completed, starting final review...');
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
            text:`IMPORTANT: You must retype the entire report. Do **not** delete or omit any original text. Every part of the draft must remain visible in your rewritten version.

                  Follow all user instructions exactly: ${bulletPoints}

                  The draft report below is composed of ${batchResponses.length} sections. You must:
                  1. **Group observations under appropriate section headers based on their group name tag in the reference bullet point- [IMAGE:<image_number>:<GROUP_NAME>].**
                  2. **Within each group, reorder the observations by their associated image number** (i.e., Photo 2 comes before Photo 4).
                  3. Retain all original content — you are rewriting and reformatting, not summarizing.
                  4. Maintain the original format - do not duplicate any content
                  5. **CRITICAL**: When starting a new subheading, the number in "[IMAGE:<image_number>:<GROUP_NAME>]" must restart from 1, not continue from the previous subheading.

                  Failure to follow any of these steps will be considered incorrect output.

                  Here is the draft report:\n\n${combinedDraft}`
          },
        ],
      },
    ];

    console.log('[DEBUG] Calling OpenAI API for final review...');
    let FinalReportOutput;
    try {
      FinalReportOutput = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: FinalReportMessage,
        temperature: 0.7,
        max_tokens: 3000, // Reduced for Vercel serverless environment
      }, {
        timeout: 45000, // 45 second timeout for final review (Vercel serverless limit)
      });
      
      console.log('[DEBUG] Final review OpenAI API call completed successfully');
    } catch (finalError: any) {
      console.error('[DEBUG] Final review OpenAI API error:', finalError);
      
      // Check if it's a timeout or token limit error
      const isTimeout = finalError.message?.includes('timeout') || 
                       finalError.code === 'ECONNRESET' ||
                       finalError.status === 408;
      const isTokenLimit = finalError.message?.includes('token') || 
                         finalError.status === 400;
      
      let errorMessage = '';
      if (isTimeout) {
        errorMessage = 'Final review timed out - this is likely due to serverless function limits.';
      } else if (isTokenLimit) {
        errorMessage = 'Final review hit token limit - report is too large for processing.';
      } else {
        errorMessage = `Final review failed: ${finalError.message || 'OpenAI API error'}`;
      }
      
      console.log('[DEBUG] Using combined draft as final result with error note...');
      // Use the combined draft as the final result with error note
      const finalReport = combinedDraft + `\n\n⚠️ ${errorMessage}\n\n[Note: Report content is complete but final formatting failed. You may need to manually format the report.]`;
      
      await supabase
        .from('reports')
        .update({ generated_content: finalReport })
        .eq('id', reportId);
      
      return; // Exit successfully with partial result
    }

    const finalReport = FinalReportOutput.choices[0]?.message.content || '';

    console.log('[DEBUG] Updating database with final content...');
    // Update the database with the final content
    const { error: finalUpdateError } = await supabase
      .from('reports')
      .update({ generated_content: finalReport })
      .eq('id', reportId);
      
    if (finalUpdateError) {
      console.error('[DEBUG] Error updating database with final content:', finalUpdateError);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[DEBUG] processReportAsync completed successfully in ${totalTime}ms`);

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[DEBUG] Error in async processing after ${totalTime}ms:`, error);
    
    // Provide more specific error messages
    let errorMessage = '';
    if (error.message?.includes('timeout')) {
      errorMessage = 'Report generation timed out due to serverless function limits. Try using fewer images or the Grok model.';
    } else if (error.message?.includes('memory')) {
      errorMessage = 'Report generation failed due to memory limits. Try using fewer images.';
    } else if (error.message?.includes('token')) {
      errorMessage = 'Report generation failed due to token limits. Try using fewer images or shorter descriptions.';
    } else {
      errorMessage = `Error generating report: ${error.message}\n\nPlease try again with fewer images or use a different model.`;
    }
    
    console.log('[DEBUG] Updating database with error...');
    // Update database with detailed error
    await supabase
      .from('reports')
      .update({ 
        generated_content: `❌ ${errorMessage}\n\n[PROCESSING FAILED - Please try again with fewer images or use the Grok model]`
      })
      .eq('id', reportId);
  }
}