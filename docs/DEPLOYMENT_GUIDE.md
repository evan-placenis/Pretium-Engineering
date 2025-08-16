# Deployment Guide - Job Queue System

## 🚀 **Step 1: Deploy Supabase Edge Function**

### Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### Login to Supabase

```bash
supabase login
```

### Link your project

```bash
cd pretium
supabase link --project-ref YOUR_PROJECT_REF
```

### Deploy the edge function

```bash
supabase functions deploy process-queued-jobs
```

## 🔧 **Step 2: Set Environment Variables**

### In your Supabase Dashboard:

1. Go to Settings → API
2. Copy your project URL and anon key
3. Go to Settings → Edge Functions
4. Add these environment variables:

```bash
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROK_API_KEY=your_grok_api_key
```

### In your local .env.local:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROK_API_KEY=your_grok_api_key
```

## 🧪 **Step 3: Test the System**

### Test 1: Check if jobs table exists

```sql
-- Run this in Supabase SQL editor
SELECT * FROM jobs LIMIT 1;
```

### Test 2: Test job enqueueing

```bash
# Start your Next.js app
npm run dev
```

Then make a POST request to your API:

```bash
curl -X POST http://localhost:3000/api/models/archive/generate-report-oldGrok \
  -H "Content-Type: application/json" \
  -d '{
    "bulletPoints": "Test report generation",
    "contractName": "Test Contract",
    "location": "Test Location",
    "reportId": "test-report-id",
    "projectId": "test-project-id",
    "images": []
  }'
```

### Test 3: Check job status

```bash
# Replace JOB_ID with the ID returned from step 2
curl http://localhost:3000/api/jobs/JOB_ID
```

## 📊 **Step 4: Monitor Jobs**

### Check jobs in Supabase Dashboard:

```sql
-- View all jobs
SELECT * FROM jobs ORDER BY created_at DESC;

-- View queued jobs
SELECT * FROM jobs WHERE status = 'queued';

-- View processing jobs
SELECT * FROM jobs WHERE status = 'processing';

-- View completed jobs
SELECT * FROM jobs WHERE status = 'completed';

-- View failed jobs
SELECT * FROM jobs WHERE status = 'failed';
```

### Check edge function logs:

```bash
supabase functions logs process-queued-jobs
```

## 🔍 **Step 5: Debugging**

### If jobs aren't processing:

1. **Check edge function logs:**

   ```bash
   supabase functions logs process-queued-jobs --follow
   ```

2. **Test edge function manually:**

   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-queued-jobs \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "apikey: YOUR_ANON_KEY"
   ```

3. **Check environment variables:**
   ```bash
   supabase functions list
   ```

### If jobs are stuck:

```sql
-- Reset stuck jobs
UPDATE jobs
SET status = 'queued', error = NULL
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

## ✅ **Step 6: Verify Everything Works**

### Expected Flow:

1. **User hits "Generate Report"** → Job gets queued
2. **API immediately triggers processor** → Job starts processing
3. **Job status changes** → queued → processing → completed
4. **Report gets generated** → Saved to database

### Success Indicators:

- ✅ Jobs appear in `jobs` table
- ✅ Job status changes from 'queued' to 'processing' to 'completed'
- ✅ Reports get generated content
- ✅ No Vercel timeouts

## 🐛 **Common Issues & Solutions**

### Issue: "Function not found"

**Solution:** Deploy the function again

```bash
supabase functions deploy process-queued-jobs
```

### Issue: "Environment variable not found"

**Solution:** Check edge function environment variables in Supabase dashboard

### Issue: "Jobs stuck in processing"

**Solution:** Check edge function logs and reset if needed

### Issue: "Database connection failed"

**Solution:** Verify SUPABASE_URL and service role key

## 📈 **Monitoring in Production**

### Set up alerts:

```sql
-- Check for stuck jobs every 5 minutes
SELECT COUNT(*) as stuck_jobs
FROM jobs
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

### Monitor job success rate:

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

## 🎯 **Next Steps**

1. **Deploy to production** using the same steps
2. **Set up monitoring** for job failures
3. **Add more job types** (chat, export, etc.)
4. **Optimize performance** based on usage patterns

Your queue system should now be fully operational! 🚀
