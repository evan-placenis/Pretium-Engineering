import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { processGenerateReportWithNewGenerator } from './report-job-handler.ts'

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
          result = await processGenerateReportWithNewGenerator(supabase, job)
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
