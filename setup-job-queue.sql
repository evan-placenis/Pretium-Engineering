-- Job Queue Database Setup for Pretium
-- Run this in your Supabase SQL editor

-- 1. Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  job_type TEXT NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  priority INTEGER DEFAULT 0
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority DESC, created_at ASC);

-- 3. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Create function to get next job to process
CREATE OR REPLACE FUNCTION get_next_job()
RETURNS TABLE (
  id UUID,
  job_type TEXT,
  input_data JSONB,
  retry_count INTEGER,
  max_retries INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.job_type,
    j.input_data,
    j.retry_count,
    j.max_retries
  FROM jobs j
  WHERE j.status = 'queued'
    AND j.retry_count < j.max_retries
  ORDER BY j.priority DESC, j.created_at ASC
  LIMIT 1;
END;
$$;

-- 6. Create function to mark job as processing
CREATE OR REPLACE FUNCTION mark_job_processing(job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE jobs 
  SET 
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = job_id 
    AND status = 'queued';
  
  RETURN FOUND;
END;
$$;

-- 7. Create function to mark job as completed
CREATE OR REPLACE FUNCTION mark_job_completed(job_id UUID, output_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE jobs 
  SET 
    status = 'completed',
    output_data = mark_job_completed.output_data,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = job_id;
  
  RETURN FOUND;
END;
$$;

-- 8. Create function to mark job as failed
CREATE OR REPLACE FUNCTION mark_job_failed(job_id UUID, error_message TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE jobs 
  SET 
    status = 'failed',
    error = mark_job_failed.error_message,
    retry_count = retry_count + 1,
    updated_at = NOW()
  WHERE id = job_id;
  
  RETURN FOUND;
END;
$$;

-- 9. Create function to retry failed jobs
CREATE OR REPLACE FUNCTION retry_failed_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  retry_count INTEGER;
BEGIN
  UPDATE jobs 
  SET 
    status = 'queued',
    error = NULL,
    updated_at = NOW()
  WHERE status = 'failed' 
    AND retry_count < max_retries;
  
  GET DIAGNOSTICS retry_count = ROW_COUNT;
  RETURN retry_count;
END;
$$;

-- 10. Create function to clean up old completed jobs (optional)
CREATE OR REPLACE FUNCTION cleanup_old_jobs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM jobs 
  WHERE status = 'completed' 
    AND created_at < NOW() - INTERVAL '1 day' * days_to_keep;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 11. Verify the setup
SELECT 'Job queue database setup completed successfully!' as status; 