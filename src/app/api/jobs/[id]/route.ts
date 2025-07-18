import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/queue';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const result = await getJobStatus(jobId);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    if (!result.job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: result.job
    });

  } catch (error: any) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while getting job status' },
      { status: 500 }
    );
  }
} 