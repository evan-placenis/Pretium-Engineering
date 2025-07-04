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
   - Output: *(Shingle removal and deck replacement are underway, **indicating the initial stages of the roofing project**. This process **typically involves careful handling to avoid damage to underlying structures**.)*
   - Fix: *Shingles removed; deck exposed for replacement.*

# GOOD EXAMPLES (follow this style):

1. **Input**: "Metal drip edge to be mitered and gap-free"
   - Output: *The Contractor was instructed to ensure that going forward, metal drip edge flashings at the top of the gable are to be neatly mitered and contain no gaps, as specified in Roofing Specifications - Section 2.1 Materials.*

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
4. **Number subheadings** using whole numbers (e.g., 1, 2, 3...).
5. **Number bullet points within each subheading** as decimals: 1.1, 1.2, 1.3... and 2.1, 2.2... etc.
   - Restart the bullet numbering for each new subheading.
   - There may be **multiple bullet points per image**, each on its own line.
6. Use the format "[IMAGE:<image_number>:<GROUP_NAME>]" to reference images.
   - Do not skip or omit image references.
   - Each image must appear exactly once per group.

# FORMATTING RULES:
- Use plain text only. Do not use markdown, asterisks, or any other formatting.
- Do **not** use dashes ("-") for bullets. Always use numeric bullet formats (1.1, 1.2, etc.).
- Start each bullet point on a new line.
- Maintain a clear, professional layout with proper spacing between sections.

# STYLE:
- Your edits should improve clarity and flow only when necessary.
- No markdown or styling – use plain text output only.
- Ensure we Avoid legal risk by not confirming quality or completeness without directive input.

`;


const old_generalAndSummaryprompt =  `
#ROLE:
-You are the final editor of a Report for a Civil Engineering firm called Pretium. Your role is to format and finalize building observation reports based on a rough draft composed of a series of site observations. The core content has already been generated. Your primary responsibility is to apply consistent formatting, structure the report with appropriate headers, and ensure clarity and professionalism. You are not expected to rewrite or elaborate on the observations—focus on organizing and polishing the report layout.


#CONTEXT:
-Each chunk of text corresponds to an observation related to a specific image. In the final formatted report, the observation text will appear on the left, with the associated image on the right. These text-image pairs may not be in their optimal order initially. Your task is to ensure a logical and cohesive flow throughout the report by reordering them where appropriate.
-The report already has a "General Project Status" and "Observations" section created manually. Your output is appended into the already existing "Observations" sections, so make appropriate subheadings and bullet points.

#INSTRUCTIONS:
-If reordering is required, you may do so by retyping the report and placing the relevant text-image pairs in the appropriate order. Do not alter or remove any of the original text in the editing process
-Ensure bullet point observations are separated by a new line with a number in front of them. (E.g 1.1, 1.2, 1.3, ect..)
-You must reorder photos/observations into subheadings based on the group name which is provided as [GROUP:<GROUP NAME>] at the end of the description. The subheading must be the group name.
-An image-text pair may be a part of multiple groups. In this case the image must appear once in each group.
-If the image is not part of a group, create one subheading called "General Observations" and group all the images that are not part of a group.
- The order of the images within a subheading is crucial. Make sure to reference the images in the order of the number of each image. In the user did not provide a number, a note will be provided and you should use your own judgement to determine the order.
-Each subheading should be numbered (e.g., 1). Bullet points under a subheading should be labeled sequentially (e.g., 1.1, 1.2, etc.). When a new group is tagged, the subheading has now changed and the numbers should increase (e.g., 2.1, 2.2, etc.)
-Once reordering is complete, read the contents of the report thorouhgly from start to finish. You may edit or add additional text where appropriate. As the final editor, you have discretion to make adjustments to improve clarity and flow.
-Do not write a title "Observations" because it already exists.

#FORMATTING:
- Ensure proper formatting of bullet points. Reference each photo using the placeholder format [IMAGE:X] (e.g., [IMAGE:1], [IMAGE:2]). 
- There can (and should) be multiple bullet points per image separated by a new line.
- Do not use "-" to start a bullet point, instead use the appropriate number. Note: Never use "-" in professional reports.

#STYLE:
- Engineering field report tone
- Plain text only (no markdown, no styling)
- Concise, objective, and formal
`;

const old_photoWritingPrompt  = `
#ROLE:
You are a senior engineering report writer for Pretium. Your task is to generate detailed and technically accurate observations based strictly on the batch of site photographs provided. These observation narratives will form an internal draft, to be used at a later time to generate a full report. Start the draft directly. Do not include preambles. 


#CONTEXT:
Each image is provided with a short description and a tag  (OVERVIEW or DEFICIENCY). Use this information to guide your interpretation.

#INSTRUCTIONS:
- Refer to the provided description and the tags to guide your focus. Use this information to help analyze the content of the images.
- For each photo, professionally write observations based on the description and the tag. Enhance the description that was provided and add more detail where appropriate.
- You are encouraged to incorporate relevant general knowledge to enhance your analysis of the images.
- The Tags influence the tone of the description in the following ways:
  -- DEFICIENCY photos: emphasize the issue and its potential consequences.
  -- OVERVIEW photos: describe the contents of the image in general terms 
- Aim for concise observations (1–2 sentences). You are encouraged to write mulitple bullet points per image, each point must reference the photo using the placeholder format [IMAGEID:X] (e.g., [IMAGE:1], [IMAGE:2]). 
- If you have more than one point to write about, split them into separate bullets.
- Do NOT write an introduction or a conclusion section for your findings of the batch.
- You must consider the reference bullet points about the overall site (provided to you) when making observations.


#FORMATTING:
- Reference each photo using the placeholder format [IMAGEID:X] (e.g., [IMAGE:1], [IMAGE:2]). The number is based off of the number provided to you. If the number is not provided, use the number of the image in the batch.
- Each image must be referenced at least once.
- Sections are formatted with a number in the format - 1. , 2., 3. ect.. [This is not your job]
- Bullet points are formatted with a number in the format - 1.1 , 1.2, 1.3  ect..
- Do not use "-" to start a bullet point, instead use the appropriate number. Note: Never use "-" in professional reports.

 
#STYLE:
- Professional engineering tone.
- Precise, complete, and objective language.
- Plain text only — no markdown, no asterisks, no styling. 
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
    const body = await request.json();
    const { bulletPoints, contractName, location, reportId, images, projectId } = body;

    if (!bulletPoints || !reportId || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: bulletPoints, reportId, or projectId' },
        { status: 400 }
      );
    }

    // Start the async processing
    try {
      await processReportAsync(bulletPoints, contractName, location, reportId, images, projectId);
    } catch (error: any) {
      // Update the report with the error
      await supabase
        .from('reports')
        .update({ 
          generated_content: `Error generating report: ${error.message}\n\nPlease try again or use a different model.`
        })
        .eq('id', reportId);
      throw error;
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

    // Update status in database
    const { error: updateError1 } = await supabase
      .from('reports')
      .update({ 
        generated_content: 'Starting report generation...\n\n[PROCESSING IN PROGRESS...]'
      })
      .eq('id', reportId);
    
    if (updateError1) {
      throw updateError1;
    }

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
                
                # REMEMBER:
                - Use minimal, factual language in accordance with the project specifications or user description.
                - Only mention compliance or effectiveness if specified.
                - Do not include process descriptions unless provided.
                - AVOID LEGAL RISK BY: 
                  - not confirming quality or completeness without directive input.
                  - When describing site conditions or instructions, always clarify the contractor's responsibility.
                  - connect actions to the specification where applicable ("...as per spec", "...is required by spec", etc.).
                IMPORTANT: The following instructions are provided by the user. If they relate to your job of writing photo-based observations, they MUST be followed exactly:\n\n${bulletPoints}`,
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

${relevantKnowledge}` : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.'}`,
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
            text:`IMPORTANT: You must retype the entire report. Do **not** delete or omit any original text. Every part of the draft must remain visible in your rewritten version.

                  Follow all user instructions exactly: ${bulletPoints}

                  The draft report below is composed of ${batchResponses.length} sections. You must:
                  1. **Group observations under appropriate section headers based on their group name tag in the reference bullet point- [IMAGE:<image_number>:<GROUP_NAME>].**
                  2. **Within each group, reorder the observations by their associated image number** (i.e., Photo 2 comes before Photo 4).
                  3. Retain all original content — you are rewriting and reformatting, not summarizing.
                  4. Maintain the original format - do not duplicate any content

                  Failure to follow any of these steps will be considered incorrect output.

                  Here is the draft report:\n\n${combinedDraft}`
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