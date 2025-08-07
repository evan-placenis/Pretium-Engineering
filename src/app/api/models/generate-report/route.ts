import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enqueueJob } from '@/lib/queue';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bulletPoints,
      projectId,
      contractName,
      location,
      reportId,
      imagesWithNumbering,
      groupOrder,
      selectedModel,
      isUngroupedMode,
      reportStyle, // 'brief' or 'elaborate'
      executionStrategy, // 'batched-parallel' or 'batched-parallel-with-parallel-summary'
      requestId // Unique request ID for tracking
    } = body;

    console.log(`🚀 API: Processing report generation request`, {
      requestId,
      reportId,
      projectId,
      selectedModel,
      reportStyle,
      executionStrategy,
      imageCount: imagesWithNumbering?.length || 0
    });

    // Validate required fields
    if (!reportId || !projectId || !selectedModel || !reportStyle || !executionStrategy) {
      return NextResponse.json(
        { error: 'Missing required fields: reportId, projectId, selectedModel, reportStyle, executionStrategy' },
        { status: 400 }
      );
    }

    // Enqueue the unified report generation job
    const job = await enqueueJob('generate_report', {
      bulletPoints,
      projectId,
      contractName,
      location,
      reportId,
      imagesWithNumbering,
      groupOrder,
      selectedModel,
      isUngroupedMode,
      reportStyle, // Pass the user's report style selection
      executionStrategy // Pass the user's execution strategy selection
    });

    // Trigger the job processor immediately
    const triggerUrl = process.env.NEXT_PUBLIC_TRIGGER_PROCESSOR_URL || 'https://w7cf4bvaq3l3glpwze5ehcxeiq0ywcgh.lambda-url.ca-central-1.on.aws/';
    
    console.log('🚀 Triggering job processor at:', triggerUrl);
    
    // Fire and forget - the trigger processor handles the rest
    fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(() => {
      console.log('✅ Job processor trigger sent successfully');
    }).catch((error) => {
      console.error('❌ Failed to trigger job processor:', error);
    });

    return NextResponse.json({
      success: true,
      jobId: job.jobId,
      message: `Report generation job enqueued with ${reportStyle} style and ${executionStrategy} execution using ${selectedModel}`,
      requestId: requestId
    });

  } catch (error: any) {
    console.error('Error enqueuing report generation job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enqueue report generation job' },
      { status: 500 }
    );
  }
} 