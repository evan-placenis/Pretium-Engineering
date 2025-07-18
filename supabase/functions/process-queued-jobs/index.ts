import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.28.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get next job to process
    const { data: nextJobData, error: getJobError } = await supabase
      .rpc('get_next_job')

    if (getJobError) {
      throw new Error(`Error getting next job: ${getJobError.message}`)
    }

    if (!nextJobData || nextJobData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No jobs to process',
          processed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Get the full job details
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', nextJobData[0].id)
      .single()

    if (jobError) {
      throw new Error(`Error getting job details: ${jobError.message}`)
    }

    const job = jobData

    // Mark job as processing
    const { data: processingResult, error: processingError } = await supabase
      .rpc('mark_job_processing', { job_id: job.id })

    if (processingError) {
      throw new Error(`Error marking job as processing: ${processingError.message}`)
    }

    if (!processingResult) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Job already being processed by another worker',
          processed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Process the job based on its type
    let result: any
    let error: string | null = null

    try {
      switch (job.job_type) {
        case 'generate_report':
          result = await processGenerateReportJob(supabase, job)
          break
        case 'process_images':
          error = 'Image processing job type not yet implemented'
          break
        case 'export_document':
          error = 'Document export job type not yet implemented'
          break
        default:
          error = `Unknown job type: ${job.job_type}`
      }
    } catch (processError: any) {
      error = processError.message
    }

    // Mark job as completed or failed
    if (error) {
      await supabase.rpc('mark_job_failed', { 
        job_id: job.id, 
        error_message: error 
      })
    } else {
      await supabase.rpc('mark_job_completed', { 
        job_id: job.id, 
        output_data: result 
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: error ? 'Job failed' : 'Job completed successfully',
        jobId: job.id,
        error: error || null,
        processed: 1
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('Error in process-queued-jobs function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Helper function to chunk array
function chunk<T>(array: T[], size: number): T[][] {
  const chunked: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size))
  }
  return chunked
}

// Helper function to resize image
async function resizeImageForAI(imageUrl: string, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.8): Promise<string> {
  try {
    // Fetch the original image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    // For Deno, we'll use a simpler approach - just return the original URL
    // In production, you might want to use a different image processing library
    return imageUrl
    
  } catch (error) {
    console.error('Error resizing image:', error)
    return imageUrl
  }
}

// Helper function to get relevant knowledge chunks for an image
async function getRelevantKnowledgeChunks(supabase: any, projectId: string, imageDescription: string, imageTag: string): Promise<string> {
  try {
    // This is a simplified version - in production you'd want to implement the full embedding search
    const searchQuery = `${imageDescription}`
    
    // For now, return empty string - you can implement the full embedding search here
    return ''
    
  } catch (error) {
    console.error('Error getting relevant knowledge chunks:', error)
    return ''
  }
}

// Photo writing prompt
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
`

// General and summary prompt
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
`

// Process generate report job
async function processGenerateReportJob(supabase: any, job: any): Promise<any> {
  const { bulletPoints, contractName, location, reportId, images, projectId } = job.input_data

  try {
    // Verify the report exists
    const { data: existingReport, error: checkError } = await supabase
      .from('reports')
      .select('id, generated_content')
      .eq('id', reportId)
      .single()
      
    if (checkError) {
      throw new Error(`Report ${reportId} not found in database`)
    }

    // Set initial processing status
    await supabase
      .from('reports')
      .update({ 
        generated_content: 'Starting report generation...\n\n[PROCESSING IN PROGRESS...]'
      })
      .eq('id', reportId)

    // Use images from input data
    let imagesToUse: any[] = []
    if (images && images.length > 0) {
      imagesToUse = images
    } else {
      throw new Error('No images provided for report generation')
    }

    // Resize images for AI processing
    const resizedImages = await Promise.all(
      imagesToUse.map(async (img: any) => {
        const resizedUrl = await resizeImageForAI(img.url, 1600, 1600, 0.85)
        return { ...img, url: resizedUrl }
      })
    )

    // Update status
    await supabase
      .from('reports')
      .update({ 
        generated_content: `Images resized (${resizedImages.length}). Starting batch processing...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId)

    // Split the images into chunks
    const imageChunks = chunk(resizedImages, 5)
    const batchResponses: string[] = []

    // Set up the initial conversation with system prompt
    const baseMessages = [
      {
        role: 'system',
        content: photoWritingPrompt,
      },
    ]

    // Initialize Grok client
    const grokClient = new OpenAI({
      apiKey: Deno.env.get('GROK_API_KEY')!,
      baseURL: "https://api.x.ai/v1",
      timeout: 360000,
    })

    // Process each batch
    for (let i = 0; i < imageChunks.length; i++) {
      const currentChunk = imageChunks[i]
      
      // Update status in database
      await supabase
        .from('reports')
        .update({ 
          generated_content: `Processing batch ${i + 1}/${imageChunks.length} (${currentChunk.length} images)...\n\n${batchResponses.join('\n\n')}\n\n[PROCESSING IN PROGRESS...]`
        })
        .eq('id', reportId)

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
      ]

      // Process each image in the batch
      for (let j = 0; j < currentChunk.length; j++) {
        const img = currentChunk[j]
        
        // Get relevant knowledge chunks for this image
        const relevantKnowledge = await getRelevantKnowledgeChunks(supabase, projectId, img.description || '', img.tag || 'OVERVIEW')
        
        // Add image description with knowledge context
        contentParts.push({
          type: 'text',
          text: `New Photo - Description: ${img.description || 'No description provided'}, Group: (${img.group || 'NO GROUP'}), Number: (${img.number || `NO NUMBER: Position in batch ${i * 5 + j + 1}`}), Tag: (${img.tag?.toUpperCase() || 'OVERVIEW'})

${relevantKnowledge ? `The following specifications are relevant to this photo and should be referenced in your observations. Use the exact document name and section title when citing requirements:

${relevantKnowledge}` : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.'}

IMPORTANT: When referencing this image in your observations, use the EXACT group name "${img.group || 'NO GROUP'}" (not the tag). The correct format is [IMAGE:${img.number || (i * 5 + j + 1)}:${img.group || 'NO GROUP'}].`,
        })
        
        // Add image
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: img.url,
            detail: 'auto',
          },
        })
      }

      const batchMessages = [
        ...baseMessages,
        {
          role: 'user',
          content: contentParts,
        },
      ]

      let response
      try {
        console.log(`Processing Grok batch ${i + 1}/${imageChunks.length} with ${currentChunk.length} images`)
        response = await grokClient.chat.completions.create({
          model: 'grok-4',
          messages: batchMessages as any,
          temperature: 0.7,
          max_tokens: 10000,
        }, {
          timeout: 120000, // 2 minute timeout per batch
        })
        console.log(`Grok batch ${i + 1} completed successfully`)
      } catch (grokError: any) {
        console.error(`Grok API error in batch ${i + 1}:`, grokError)
        throw new Error(`Error processing batch ${i + 1}: ${grokError.message || 'Grok API timeout or error'}`)
      }
      
      const section = response.choices[0]?.message?.content || ''
      batchResponses.push(section)
      
      // Update database with the current progress
      const combinedSoFar = batchResponses.join('\n\n')
      await supabase
        .from('reports')
        .update({ 
          generated_content: combinedSoFar + '\n\n[PROCESSING IN PROGRESS...]'
        })
        .eq('id', reportId)
    }
    
    // Update status
    await supabase
      .from('reports')
      .update({ 
        generated_content: batchResponses.join('\n\n') + '\n\nStarting final review...\n\n[PROCESSING IN PROGRESS...]'
      })
      .eq('id', reportId)

    // Final review step
    const combinedDraft = batchResponses.join('\n\n')

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
    ]

    let FinalReportOutput
    try {
      console.log('Starting Grok final review step')
      FinalReportOutput = await grokClient.chat.completions.create({
        model: 'grok-4',
        messages: FinalReportMessage as any,
        temperature: 0.7,
        max_tokens: 4000,
      }, {
        timeout: 180000, // 3 minute timeout for final review
      })
      console.log('Grok final review completed successfully')
    } catch (finalError: any) {
      console.error('Final review Grok API error:', finalError)
      
      // If final review fails, use the combined draft as the final result
      const finalReport = combinedDraft + '\n\n[Note: Final formatting step failed due to API timeout. Report content is complete but may need manual formatting.]'
      
      await supabase
        .from('reports')
        .update({ generated_content: finalReport })
        .eq('id', reportId)
      
      return { success: true, message: 'Report generated with partial formatting' }
    }
    
    const finalReport = FinalReportOutput.choices[0]?.message?.content || ''

    // Update the database with the final content
    const { error: finalUpdateError } = await supabase
      .from('reports')
      .update({ generated_content: finalReport })
      .eq('id', reportId)
      
    if (finalUpdateError) {
      console.error('Error updating database with final content:', finalUpdateError)
      throw new Error(`Failed to save final report: ${finalUpdateError.message}`)
    }

    console.log('Final report successfully saved to database')
    return { success: true, message: 'Report generated successfully' }

  } catch (error: any) {
    console.error('Error in generate report job processing:', error)
    throw error
  }
} 