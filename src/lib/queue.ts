import { createServerSupabaseClient } from './supabase';

// Job types
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type JobType = 'generate_report_grok4' | 'generate_report_gpt4o' | 'generate_report' | 'process_images' | 'export_document';

export interface Job {
  id: string;
  status: JobStatus;
  job_type: JobType;
  input_data: any;
  output_data?: any;
  error?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
  max_retries: number;
  priority: number;
}

export interface EnqueueJobOptions {
  priority?: number;
  max_retries?: number;
}

// Client-side function to enqueue a job
export async function enqueueJob(
  jobType: JobType,
  inputData: any,
  options: EnqueueJobOptions = {}
): Promise<{ jobId: string; success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        job_type: jobType,
        input_data: inputData,
        priority: options.priority || 0,
        max_retries: options.max_retries || 3,
        status: 'queued'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error enqueueing job:', error);
      return {
        jobId: '',
        success: false,
        error: error.message
      };
    }

    return {
      jobId: data.id,
      success: true
    };
  } catch (error: any) {
    console.error('Error enqueueing job:', error);
    return {
      jobId: '',
      success: false,
      error: error.message
    };
  }
}

// Function to get job status
export async function getJobStatus(jobId: string): Promise<{ job?: Job; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return { error: error.message };
    }

    return { job: data as Job };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Function to get next job to process
export async function getNextJob(): Promise<{ job?: Job; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    
    // Use the database function to get the next job
    const { data, error } = await supabase
      .rpc('get_next_job');

    if (error) {
      return { error: error.message };
    }

    if (!data || data.length === 0) {
      return {}; // No jobs available
    }

    // Get the full job details
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', data[0].id)
      .single();

    if (jobError) {
      return { error: jobError.message };
    }

    return { job: jobData as Job };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Function to mark job as processing
export async function markJobProcessing(jobId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .rpc('mark_job_processing', { job_id: jobId });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Function to mark job as completed
export async function markJobCompleted(jobId: string, outputData: any): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .rpc('mark_job_completed', { 
        job_id: jobId, 
        output_data: outputData 
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Function to mark job as failed
export async function markJobFailed(jobId: string, errorMessage: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .rpc('mark_job_failed', { 
        job_id: jobId, 
        error_message: errorMessage 
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Function to retry failed jobs
export async function retryFailedJobs(): Promise<{ retryCount: number; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .rpc('retry_failed_jobs');

    if (error) {
      return { retryCount: 0, error: error.message };
    }

    return { retryCount: data || 0 };
  } catch (error: any) {
    return { retryCount: 0, error: error.message };
  }
}

// Function to clean up old completed jobs
export async function cleanupOldJobs(daysToKeep: number = 30): Promise<{ deletedCount: number; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .rpc('cleanup_old_jobs', { days_to_keep: daysToKeep });

    if (error) {
      return { deletedCount: 0, error: error.message };
    }

    return { deletedCount: data || 0 };
  } catch (error: any) {
    return { deletedCount: 0, error: error.message };
  }
}

// Polling function to wait for job completion
export async function waitForJobCompletion(
  jobId: string, 
  pollInterval: number = 2000, 
  timeout: number = 900000  // Increased to 15 minutes to match Lambda timeout
): Promise<{ job?: Job; error?: string }> {
  const startTime = Date.now();
  let pollCount = 0;
  
  // Starting job polling
  
  while (Date.now() - startTime < timeout) {
    pollCount++;
    const result = await getJobStatus(jobId);
    
    if (result.error) {
      console.error(`❌ Error polling job ${jobId}:`, result.error);
      return result;
    }
    
    if (result.job) {
      // Job status update
      
      if (result.job.status === 'completed') {
        // Job completed
        return { job: result.job };
      }
      
      if (result.job.status === 'failed') {
        // Job failed
        return { 
          job: result.job, 
          error: result.job.error || 'Job failed' 
        };
      }
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  // Job polling timed out
  return { error: 'Job completion timeout' };
} 