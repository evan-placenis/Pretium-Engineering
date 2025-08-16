import { createServerSupabaseClient } from '../lib/supabase';
import { Job, markJobProcessing, markJobCompleted, markJobFailed, getNextJob } from './queue';

// Main job processor function
export async function processJob(job: Job): Promise<void> {
  try {
    // Mark job as processing
    const processingResult = await markJobProcessing(job.id);
    if (!processingResult.success) {
      throw new Error(`Failed to mark job as processing: ${processingResult.error}`);
    }

    // Process based on job type
    switch (job.job_type) {
      case 'generate_report_grok4':
      case 'generate_report_gpt4o':
        // These jobs are processed by the Supabase edge function
        // Just mark as queued for edge function processing
        await markJobCompleted(job.id, { 
          success: true, 
          message: 'Job queued for edge function processing' 
        });
        break;
      case 'process_images':
        // TODO: Implement image processing job
        throw new Error('Image processing job type not yet implemented');
      case 'export_document':
        // TODO: Implement document export job
        throw new Error('Document export job type not yet implemented');
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

  } catch (error: any) {
    console.error(`Error processing job ${job.id}:`, error);
    
    // Mark job as failed
    await markJobFailed(job.id, error.message);
    throw error;
  }
}

// Function to process all queued jobs
export async function processQueuedJobs(): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  while (true) {
    try {
      // Get next job
      const result = await getNextJob();
      
      if (result.error) {
        errors.push(`Error getting next job: ${result.error}`);
        break;
      }

      if (!result.job) {
        // No more jobs to process
        break;
      }

      // Process the job
      await processJob(result.job);
      processed++;

    } catch (error: any) {
      console.error('Error in job processing loop:', error);
      errors.push(error.message);
      
      // Continue with next job instead of breaking
      continue;
    }
  }

  return { processed, errors };
} 