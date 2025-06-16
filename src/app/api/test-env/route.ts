import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Check environment variables without exposing their values
    const envCheck = {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV
    };

    // Test Supabase connection
    const { data, error } = await supabase
      .from('reports')
      .select('id')
      .limit(1);

    return NextResponse.json({
      success: true,
      environment: envCheck,
      database: {
        connected: !error,
        error: error ? error.message : null
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 