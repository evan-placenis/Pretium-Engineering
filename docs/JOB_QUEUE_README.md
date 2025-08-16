# Job Queue System for Pretium

This document describes the modular Supabase-based job queue system implemented to handle Vercel timeout issues for long-running tasks like report generation.

## Overview

The job queue system consists of:

1. **Database Schema** - Jobs table with status tracking
2. **Queue Module** - TypeScript functions for job management
3. **Job Processor** - Logic for processing different job types
4. **Supabase Edge Function** - Background worker for processing jobs
5. **API Routes** - Client-side endpoints for job management

## Setup Instructions

### 1. Database Setup

Run the SQL commands in `setup-job-queue.sql` in your Supabase SQL editor:

```sql
-- This will create:
-- - jobs table with all necessary fields
-- - Database functions for job management
-- - Indexes for performance
-- - Triggers for automatic timestamp updates
```

### 2. Environment Variables

Ensure these environment variables are set in your Supabase project:

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Grok API (for report generation)
GROK_API_KEY=your_grok_api_key
```

### 3. Deploy Supabase Edge Function

Deploy the edge function to process queued jobs:

```bash
# Navigate to the supabase directory
cd supabase

# Deploy the function
supabase functions deploy process-queued-jobs
```

## Architecture

### Database Schema

The `jobs` table includes:

- `id` - Unique job identifier
- `status` - Current status (queued, processing, completed, failed)
- `job_type` - Type of job (generate_report, process_images, export_document)
- `input_data` - JSON data for the job
- `output_data` - JSON result from job processing
- `error` - Error message if job failed
- `created_at`, `updated_at` - Timestamps
- `started_at`, `completed_at` - Processing timestamps
- `retry_count`, `max_retries` - Retry logic
- `priority` - Job priority (higher numbers = higher priority)

### Queue Module (`src/lib/queue.ts`)

Provides client-side functions:

```typescript
// Enqueue a new job
const result = await enqueueJob("generate_report", inputData, options);

// Check job status
const status = await getJobStatus(jobId);

// Wait for job completion
const result = await waitForJobCompletion(jobId);
```

### Job Processor (`src/lib/job-processor.ts`)

Contains the logic for processing different job types:

- `generate_report` - Report generation using Grok AI
- `process_images` - Image processing (TODO)
- `export_document` - Document export (TODO)

### Edge Function (`supabase/functions/process-queued-jobs/`)

Background worker that:

1. Fetches the next queued job
2. Marks it as processing
3. Executes the job logic
4. Updates the job status and result

## Usage Examples

### Enqueueing a Report Generation Job

```typescript
import { enqueueJob } from '@/lib/queue';

const result = await enqueueJob('generate_report', {
  bulletPoints: 'User instructions for report',
  contractName: 'Contract Name',
  location: 'Project Location',
  reportId: 'report-uuid',
  images: [...], // Array of image objects
  projectId: 'project-uuid'
}, {
  priority: 0,
  max_retries: 3
});

if (result.success) {
  console.log('Job queued with ID:', result.jobId);
}
```

### Checking Job Status

```typescript
import { getJobStatus } from "@/lib/queue";

const result = await getJobStatus(jobId);

if (result.job) {
  switch (result.job.status) {
    case "queued":
      console.log("Job is waiting to be processed");
      break;
    case "processing":
      console.log("Job is currently being processed");
      break;
    case "completed":
      console.log("Job completed successfully");
      console.log("Result:", result.job.output_data);
      break;
    case "failed":
      console.log("Job failed:", result.job.error);
      break;
  }
}
```

### Polling for Job Completion

```typescript
import { waitForJobCompletion } from "@/lib/queue";

const result = await waitForJobCompletion(jobId, 2000, 300000);

if (result.job) {
  console.log("Job completed:", result.job.output_data);
} else if (result.error) {
  console.log("Job failed or timed out:", result.error);
}
```

## API Endpoints

### POST `/api/models/archive/generate-report-oldGrok`

Enqueues a report generation job instead of processing directly.

**Request Body:**

```json
{
  "bulletPoints": "User instructions",
  "contractName": "Contract Name",
  "location": "Project Location",
  "reportId": "report-uuid",
  "images": [...],
  "projectId": "project-uuid"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Report generation job queued successfully",
  "jobId": "job-uuid",
  "reportId": "report-uuid"
}
```

### GET `/api/jobs/[id]`

Get the status of a specific job.

**Response:**

```json
{
  "success": true,
  "job": {
    "id": "job-uuid",
    "status": "completed",
    "job_type": "generate_report",
    "input_data": {...},
    "output_data": {...},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:05:00Z",
    "completed_at": "2024-01-01T00:05:00Z"
  }
}
```

## Monitoring and Management

### Database Functions

The system includes several database functions for management:

```sql
-- Get next job to process
SELECT * FROM get_next_job();

-- Mark job as processing
SELECT mark_job_processing('job-uuid');

-- Mark job as completed
SELECT mark_job_completed('job-uuid', '{"result": "success"}');

-- Mark job as failed
SELECT mark_job_failed('job-uuid', 'Error message');

-- Retry failed jobs
SELECT retry_failed_jobs();

-- Clean up old completed jobs
SELECT cleanup_old_jobs(30); -- Keep jobs for 30 days
```

### Job Status Monitoring

You can monitor job statuses with SQL queries:

```sql
-- View all jobs
SELECT * FROM jobs ORDER BY created_at DESC;

-- View failed jobs
SELECT * FROM jobs WHERE status = 'failed';

-- View jobs currently processing
SELECT * FROM jobs WHERE status = 'processing';

-- View job statistics
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM jobs
GROUP BY status;
```

## Error Handling

The system includes comprehensive error handling:

1. **Retry Logic** - Failed jobs are automatically retried up to `max_retries` times
2. **Timeout Handling** - Jobs that take too long are marked as failed
3. **Database Consistency** - Jobs are properly marked as processing to prevent duplicate processing
4. **Graceful Degradation** - If the final formatting step fails, the report is still saved with partial formatting

## Scaling Considerations

1. **Multiple Workers** - The edge function can be called by multiple workers simultaneously
2. **Job Priority** - Higher priority jobs are processed first
3. **Batch Processing** - Large jobs are broken into smaller batches
4. **Resource Management** - Images are resized to reduce memory usage

## Troubleshooting

### Common Issues

1. **Jobs stuck in processing**

   - Check if the edge function is running
   - Verify environment variables are set correctly
   - Check Supabase logs for errors

2. **Jobs failing repeatedly**

   - Check the error message in the `error` field
   - Verify API keys and external service availability
   - Check if input data is valid

3. **Slow job processing**
   - Consider increasing priority for urgent jobs
   - Check if there are too many jobs in the queue
   - Monitor external API response times

### Debugging

Enable detailed logging by checking:

- Supabase function logs
- Application console logs
- Database job status and error fields

## Future Enhancements

1. **Webhook Notifications** - Send notifications when jobs complete
2. **Job Scheduling** - Schedule jobs to run at specific times
3. **Job Dependencies** - Chain jobs that depend on each other
4. **Progress Tracking** - More detailed progress updates during processing
5. **Job Cancellation** - Allow users to cancel running jobs
