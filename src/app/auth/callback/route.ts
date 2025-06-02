import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const requestUrl = new URL(req.url);
    const code = requestUrl.searchParams.get('code');
    
    if (code) {
      const supabase = createRouteHandlerClient({ cookies });
      
      console.log('Callback route: Exchanging code for session');
      await supabase.auth.exchangeCodeForSession(code);
      console.log('Callback route: Session exchange successful');
    }
    
    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL('/dashboard', req.url));
  } catch (error) {
    console.error('Callback route error:', error);
    return NextResponse.redirect(new URL('/auth/login?error=callback_failed', req.url));
  }
} 

//This is an auth callback handler for supabase