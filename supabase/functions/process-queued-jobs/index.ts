import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.28.0'
import { Ungrouped_PhotoWritingPrompt, Ungrouped_GeneralAndSummaryPrompt, Grouped_PhotoWritingPrompt, Grouped_GeneralAndSummaryPrompt, Ungrouped_PhotoWritingRuntimePrompt, Grouped_PhotoWritingRuntimePrompt,Grouped_PhotoWritingSummaryFinalMessage, Ungrouped_PhotoWritingSummaryFinalMessage } from './prompts.ts'

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
        case 'generate_report_grok4':
          result = await processGenerateReportGrok4(supabase, job)
          break
        case 'generate_report_gpt4o':
          result = await processGenerateReportGPT4oJob(supabase, job)
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
    console.log('🔍 Searching for relevant knowledge:', { imageDescription, imageTag })
    
    // Create a search query based on the image description and tag
    const searchQuery = `${imageDescription} ${imageTag}`
    
    // Generate embedding for the query using OpenAI
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!,
    })
    
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: searchQuery,
    })
    
    const queryEmbedding = embeddingResponse.data[0].embedding
    
    // Search in database using cosine similarity
    const { data, error } = await supabase.rpc('search_embeddings', {
      query_embedding: queryEmbedding,
      project_id: projectId,
      match_threshold: 0.5, // Moderate threshold for relevant specs
      match_count: 2 // Limit to 2 most relevant chunks
    })
    
    if (error) {
      console.error('Database search error:', error)
      return ''
    }
    
    const results = data || []
    console.log(`Found ${results.length} relevant knowledge chunks`)
    
    if (results.length === 0) {
      return '' // No relevant knowledge found
    }
    
    // Get additional metadata for results
    const enhancedResults = await Promise.all(
      results.map(async (result: any) => {
        try {
          // Get knowledge document info
          const { data: knowledgeData } = await supabase
            .from('project_knowledge')
            .select('file_name')
            .eq('id', result.knowledge_id)
            .single()
          
          return {
            content: result.content_chunk,
            similarity: result.similarity,
            fileName: knowledgeData?.file_name || 'Unknown file',
            documentSource: result.document_source || 'Unknown Document',
            sectionTitle: result.section_title || 'General Content'
          }
        } catch (error) {
          console.error('Error fetching knowledge metadata:', error)
          return {
            content: result.content_chunk,
            similarity: result.similarity,
            fileName: 'Unknown file',
            documentSource: result.document_source || 'Unknown Document',
            sectionTitle: result.section_title || 'General Content'
          }
        }
      })
    )
    
    // Format the relevant knowledge as context with enhanced citations
    const relevantKnowledge = enhancedResults.map((result: any, index: number) => {
      const similarity = (result.similarity * 100).toFixed(1)
      
      // Create a clean document name (remove file extension and clean up)
      const documentName = result.documentSource
        .replace(/\.[^/.]+$/, '') // Remove file extension
        .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
        .replace(/\b\w/g, (l: string) => l.toUpperCase()) // Title case
      
      // Create citation format that matches the prompt requirements
      const citation = `${documentName} - ${result.sectionTitle}`
      
      return `[Specification ${index + 1} - ${similarity}% relevant from ${citation}]:\n${result.content}`
    }).join('\n\n')
    
    console.log('📋 Relevant knowledge found and formatted')
    return `\n\nRELEVANT SPECIFICATIONS:\n${relevantKnowledge}\n\nIMPORTANT: When referencing these specifications in your observations, use the exact document name and section title provided in the citations above.`
    
  } catch (error) {
    console.error('Error getting relevant knowledge chunks:', error)
    return '' // Return empty string if search fails
  }
}

// Process generate report job
async function processGenerateReportGrok4(supabase: any, job: any): Promise<any> {
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

    // Determine if images are ungrouped (no groups or empty groups)
    const isUngrouped = resizedImages.every(img => 
      !img.group || img.group.length === 0
    )

    // Choose the appropriate prompt based on grouping
    const systemPrompt = isUngrouped ? Ungrouped_PhotoWritingPrompt : Grouped_PhotoWritingPrompt

    // Set up the initial conversation with system prompt
    const baseMessages = [
      {
        role: 'system',
        content: systemPrompt,
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
          text: isUngrouped 
            ? `You are processing Image Batch #${i + 1} of ${imageChunks.length}.` + Ungrouped_PhotoWritingRuntimePrompt
            : `You are processing Image Batch #${i + 1} of ${imageChunks.length}.` + Grouped_PhotoWritingRuntimePrompt
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
          text: isUngrouped
            ? `New Photo - Description: ${img.description || 'No description provided'}, Number: (${img.number || `NO NUMBER: Position in batch ${i * 5 + j + 1}`}), Tag: (${img.tag?.toUpperCase() || 'OVERVIEW'})

${relevantKnowledge ? `The following specifications are relevant to this photo and should be referenced in your observations. Use the exact document name and section title when citing requirements:

${relevantKnowledge}` : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.'}

IMPORTANT: When referencing this image in your observations, use the format [IMAGE:${img.number || (i * 5 + j + 1)}]. Create appropriate section headings based on the content.`
            : `New Photo - Description: ${img.description || 'No description provided'}, Group: (${img.group || 'NO GROUP'}), Number: (${img.number || `NO NUMBER: Position in batch ${i * 5 + j + 1}`}), Tag: (${img.tag?.toUpperCase() || 'OVERVIEW'})

${relevantKnowledge ? `The following specifications are relevant to this photo and should be referenced in your observations. Use the exact document name and section title when citing requirements:

${relevantKnowledge}` : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.'}

IMPORTANT: When referencing this image in your observations, use the EXACT group name "${img.group || 'NO GROUP'}" (not the tag). The correct format is [IMAGE:${img.number || (i * 5 + j + 1)}:${img.group || 'NO GROUP'}].`
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
        response = await grokClient.chat.completions.create({
          model: 'grok-4',
          messages: batchMessages as any,
          temperature: 0.7,
          max_tokens: 10000,
        }, {
          timeout: 120000, // 2 minute timeout per batch
        })
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

    console.log('🎯 Starting final review agent...')

    // Final review step
    const combinedDraft = batchResponses.join('\n\n')

    const FinalReportMessage = [
      {
        role: 'system',
        content: isUngrouped ? Ungrouped_GeneralAndSummaryPrompt : Grouped_GeneralAndSummaryPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:`IMPORTANT: You must retype the entire report. Do **not** delete or omit any original text. Every part of the draft must remain visible in your rewritten version.

                  Follow all user instructions exactly: ${bulletPoints}

                  The draft report below is composed of ${batchResponses.length} sections. You must:
                  ` + (isUngrouped ? Ungrouped_PhotoWritingSummaryFinalMessage : Grouped_PhotoWritingSummaryFinalMessage) +

                  `Here is the draft report:\n\n${combinedDraft}`
          },
        ],
      },
    ]

    let FinalReportOutput
    try {
      console.log('📏 Draft length:', combinedDraft.length, 'characters')
      
      // If the combined draft is too large, skip the final review and use the draft directly
      if (combinedDraft.length > 15000) {
        console.log('⚠️ Draft too large, skipping final review')
        const finalReport = combinedDraft + '\n\n[Note: Report content is complete. Final formatting was skipped due to size.]'
        
        await supabase
          .from('reports')
          .update({ generated_content: finalReport })
          .eq('id', reportId)
        
        return { success: true, message: 'Report generated successfully (large report, formatting skipped)' }
      }
      
      console.log('🎯 Calling Grok API for final review...')
      
      FinalReportOutput = await grokClient.chat.completions.create({
        model: 'grok-4',
        messages: FinalReportMessage as any,
        temperature: 0.7,
        max_tokens: 8000, // Increased token limit
      }, {
        timeout: 240000, // 4 minute timeout for final review
      })
      
      console.log('✅ Final review completed successfully')
    } catch (finalError: any) {
      console.error('❌ Final review error:', finalError.message)
      
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

// GPT-4o report generation function
async function processGenerateReportGPT4oJob(supabase: any, job: any): Promise<any> {
  try {
    const { bulletPoints, contractName, location, reportId, images, projectId } = job.input_data

    console.log('🚀 Starting GPT-4o report generation for job:', job.id)

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!,
    })

    // Set initial processing status
    await supabase
      .from('reports')
      .update({ 
        generated_content: 'Starting GPT-4o report generation...\n\n[PROCESSING IN PROGRESS...]'
      })
      .eq('id', reportId)

    // Resize images for AI processing
    const resizedImages = await Promise.all(
      images.map(async (img: any) => {
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

    // Split images into chunks (1 image per batch for GPT-4o)
    const imageChunks = chunk(resizedImages, 1)
    const batchResponses: string[] = []

    // Determine if images are ungrouped (no groups or empty groups)
    const isUngrouped = resizedImages.every(img => 
      !img.group || img.group.length === 0
    )

    // Choose the appropriate prompt based on grouping
    const systemPrompt = isUngrouped ? Ungrouped_PhotoWritingPrompt : Grouped_PhotoWritingPrompt

    // Set up the initial conversation with system prompt
    const baseMessages = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ]

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
          text: isUngrouped 
            ? `You are processing Image Batch #${i + 1} of ${imageChunks.length}.` + Ungrouped_PhotoWritingRuntimePrompt
            : `You are processing Image Batch #${i + 1} of ${imageChunks.length}.` + Grouped_PhotoWritingRuntimePrompt
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
          text: isUngrouped
            ? `New Photo - Description: ${img.description || 'No description provided'}, Number: (${img.number || `NO NUMBER: Position in batch ${i * 5 + j + 1}`}), Tag: (${img.tag?.toUpperCase() || 'OVERVIEW'})

${relevantKnowledge ? `The following specifications are relevant to this photo and should be referenced in your observations. Use the exact document name and section title when citing requirements:

${relevantKnowledge}` : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.'}

IMPORTANT: When referencing this image in your observations, use the format [IMAGE:${img.number || (i * 5 + j + 1)}]. Create appropriate section headings based on the content.`
            : `New Photo - Description: ${img.description || 'No description provided'}, Group: (${img.group || 'NO GROUP'}), Number: (${img.number || `NO NUMBER: Position in batch ${i * 5 + j + 1}`}), Tag: (${img.tag?.toUpperCase() || 'OVERVIEW'})

${relevantKnowledge ? `The following specifications are relevant to this photo and should be referenced in your observations. Use the exact document name and section title when citing requirements:

${relevantKnowledge}` : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.'}

IMPORTANT: When referencing this image in your observations, use the EXACT group name "${img.group || 'NO GROUP'}" (not the tag). The correct format is [IMAGE:${img.number || (i * 5 + j + 1)}:${img.group || 'NO GROUP'}].`
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
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: batchMessages as any,
          temperature: 0.7,
          max_tokens: 10000,
        }, {
          timeout: 120000, // 2 minute timeout per batch
        })
      } catch (openaiError: any) {
        console.error(`OpenAI API error in batch ${i + 1}:`, openaiError)
        throw new Error(`Error processing batch ${i + 1}: ${openaiError.message || 'OpenAI API timeout or error'}`)
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

    console.log('🎯 Starting GPT-4o final review agent...')

    // Final review step
    const combinedDraft = batchResponses.join('\n\n')

    const FinalReportMessage = [
      {
        role: 'system',
        content: isUngrouped ? Ungrouped_GeneralAndSummaryPrompt : Grouped_GeneralAndSummaryPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:`IMPORTANT: You must retype the entire report. Do **not** delete or omit any original text. Every part of the draft must remain visible in your rewritten version.

                  Follow all user instructions exactly: ${bulletPoints}

                  The draft report below is composed of ${batchResponses.length} sections. You must:
                  ` + (isUngrouped ? Ungrouped_PhotoWritingSummaryFinalMessage : Grouped_PhotoWritingSummaryFinalMessage) + 
                  `Here is the draft report:\n\n${combinedDraft}`
          },
        ],
      },
    ]

    let FinalReportOutput
    try {
      console.log('📏 Draft length:', combinedDraft.length, 'characters')
      
      // If the combined draft is too large, skip the final review and use the draft directly
      if (combinedDraft.length > 15000) {
        console.log('⚠️ Draft too large, skipping final review')
        const finalReport = combinedDraft + '\n\n[Note: Report content is complete. Final formatting was skipped due to size.]'
        
        await supabase
          .from('reports')
          .update({ generated_content: finalReport })
          .eq('id', reportId)
        
        return { success: true, message: 'Report generated successfully (large report, formatting skipped)' }
      }
      
      console.log('🎯 Calling GPT-4o API for final review...')
      
      FinalReportOutput = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: FinalReportMessage as any,
        temperature: 0.7,
        max_tokens: 8000, // Increased token limit
      }, {
        timeout: 240000, // 4 minute timeout for final review
      })
      
      console.log('✅ Final review completed successfully')
    } catch (finalError: any) {
      console.error('❌ Final review error:', finalError.message)
      
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
    console.error('Error in GPT-4o report generation job processing:', error)
    throw error
  }
} 