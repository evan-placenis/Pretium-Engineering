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
      mode, // 'brief' or 'elaborate'
      requestId // Unique request ID for tracking
    } = body;

    console.log(`🚀 API: Processing report generation request`, {
      requestId,
      reportId,
      projectId,
      selectedModel,
      mode,
      imageCount: imagesWithNumbering?.length || 0
    });

    // Validate required fields
    if (!reportId || !projectId || !selectedModel || !mode) {
      return NextResponse.json(
        { error: 'Missing required fields: reportId, projectId, selectedModel, mode' },
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
      mode // Pass the user's mode selection
    });

    // Immediately trigger the job processor (fire-and-forget)
    const triggerUrl = process.env.NEXT_PUBLIC_TRIGGER_PROCESSOR_URL || 'https://w7cf4bvaq3l3glpwze5ehcxeiq0ywcgh.lambda-url.ca-central-1.on.aws/';
    
    fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(() => {
      console.log('✅ Job processor triggered successfully');
    }).catch((error) => {
      console.error('❌ Failed to trigger job processor:', error);
    });

    return NextResponse.json({
      success: true,
      jobId: job.jobId,
      message: `Report generation job enqueued with ${mode} mode using ${selectedModel}`,
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