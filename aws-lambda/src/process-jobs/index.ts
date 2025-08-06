import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { processGenerateReportWithNewGenerator } from './report-job-handler';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: 'ok'
    };
  }

  try {
    
    // Get environment variables
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get next job to process
    const { data: nextJobData, error: getJobError } = await supabase
      .rpc('get_next_job');

    if (getJobError) {
      throw new Error(`Error getting next job: ${getJobError.message}`);
    }

    if (!nextJobData || nextJobData.length === 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'No jobs to process',
          processed: 0
        })
      };
    }

    // Get the full job details
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', nextJobData[0].id)
      .single();

    if (jobError) {
      throw new Error(`Error getting job details: ${jobError.message}`);
    }

    const job = jobData;

    // Mark job as processing
    const { data: processingResult, error: processingError } = await supabase
      .rpc('mark_job_processing', { job_id: job.id });

    if (processingError) {
      throw new Error(`Error marking job as processing: ${processingError.message}`);
    }

    if (!processingResult) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Job already being processed by another worker',
          processed: 0
        })
      };
    }

    // Process the job based on its type
    let result: any;
    let error: string | null = null;

    try {
      switch (job.job_type) {
        case 'generate_report':
          result = await processGenerateReportWithNewGenerator(supabase, job);
          break;
        default:
          error = `Unknown job type: ${job.job_type}`;
      }
    } catch (processError: any) {
      error = processError.message;
    }

    // Mark job as completed or failed
    if (error) {
      await supabase.rpc('mark_job_failed', {
        job_id: job.id,
        error_message: error
      });
    } else {
      await supabase.rpc('mark_job_completed', {
        job_id: job.id,
        output_data: result
      });
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: error ? 'Job failed' : 'Job completed successfully',
        jobId: job.id,
        error: error || null,
        processed: 1
      })
    };

  } catch (error: any) {
    console.error('Error in process-jobs function:', error);

    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}; 