import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Skip auth for the callback route immediately
  if (req.nextUrl.pathname === '/auth/callback') {
    console.log('Middleware: Skipping for auth callback route');
    return res;
  }
  
  // Create Supabase client
  const supabase = createMiddlewareClient({ req, res });
  
  // Get current path for debugging
  const currentPath = req.nextUrl.pathname;
  console.log(`Middleware running for path: ${currentPath}`);
  
  try {
    // Explicitly refresh session
    const { data: { session } } = await supabase.auth.getSession();
    console.log(`Auth state: ${session ? 'Authenticated' : 'Not authenticated'}`);
    
    // Auth routes logic (login, signup)
    const isAuthRoute = req.nextUrl.pathname.startsWith('/auth');
    
    // If trying to access auth routes (login/signup) but already authenticated
    if (isAuthRoute && session) {
      console.log('User is authenticated but trying to access auth route, redirecting to dashboard');
      const redirectUrl = new URL('/dashboard', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    // If trying to access protected routes but not authenticated
    const isProtectedRoute = 
      req.nextUrl.pathname.startsWith('/dashboard') || 
      req.nextUrl.pathname.startsWith('/reports') ||
      req.nextUrl.pathname.startsWith('/buildings');
    
    if (isProtectedRoute && !session) {
      console.log('User is not authenticated but trying to access protected route, redirecting to login');
      const redirectUrl = new URL('/auth/login', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    
    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth/callback).*)'],
};

//This is a middleware for supabase - it helps handle authentication state
