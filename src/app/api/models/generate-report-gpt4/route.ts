import { NextRequest, NextResponse } from 'next/server';
import { enqueueJob } from '@/lib/queue';

export async function POST(request: Request) {
  try {
    // Validate environment variables
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { bulletPoints, contractName, location, reportId, images, projectId } = body;

    if (!bulletPoints || !reportId || !projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: bulletPoints, reportId, or projectId' },
        { status: 400 }
      );
    }

    // Enqueue the job instead of processing directly
    const enqueueResult = await enqueueJob('generate_report_gpt4o', {
      bulletPoints,
      contractName,
      location,
      reportId,
      images,
      projectId
    }, {
      priority: 0,
      max_retries: 3
    });

    if (!enqueueResult.success) {
      return NextResponse.json(
        { error: `Failed to enqueue job: ${enqueueResult.error}` },
        { status: 500 }
      );
    }

    // Immediately trigger the job processor
    try {
      console.log('🔄 Attempting to trigger job processor immediately...');
      const triggerUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/trigger-job-processor`;
      console.log('📍 Trigger URL:', triggerUrl);
      
      const response = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        }
      });

      console.log('📡 Trigger response status:', response.status, response.statusText);

      if (!response.ok) {
        console.warn('⚠️ Failed to trigger job processor immediately, but job is queued');
        console.warn('📊 Response details:', {
          status: response.status,
          statusText: response.statusText,
          url: triggerUrl
        });
      } else {
        const result = await response.json().catch(() => ({}));
        console.log('✅ Job processor triggered successfully');
        console.log('📋 Trigger result:', result);
      }
    } catch (error: any) {
      console.warn('❌ Failed to trigger job processor immediately, but job is queued:', error);
      console.warn('🔍 Error details:', {
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        name: error?.name || 'Unknown error type'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Report generation job queued successfully',
      jobId: enqueueResult.jobId,
      reportId: reportId
    });

  } catch (error: any) {
    console.error('Error enqueueing report generation job:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while enqueueing the job' },
      { status: 500 }
    );
  }
}
