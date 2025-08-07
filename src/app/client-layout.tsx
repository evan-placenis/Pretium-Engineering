'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Memoized session check to prevent excessive calls
  const checkUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else if (!pathname.startsWith('/auth/')) {
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Error checking session:', error);
      if (!pathname.startsWith('/auth/')) {
        router.push('/auth/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    // Only check session once on mount, not on every pathname change
    checkUser();

    // Set up auth state listener to handle auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
          if (!pathname.startsWith('/auth/')) {
            router.push('/auth/login');
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    );

    // Cleanup subscription
    return () => subscription.unsubscribe();
  }, []); // Empty dependency array - only run once on mount

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
      router.push('/auth/login');
    }
  };

  // Don't show navigation on auth pages or edit report page
  if (pathname.startsWith('/auth/') || pathname.includes('/edit')) {
    return <>{children}</>;
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="card">
          <div className="card-body">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to check if a path is active
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    if (path === '/references') {
      return pathname === '/references';
    }
    if (path === '/projects') {
      return pathname.startsWith('/projects/') || pathname === '/projects';
    }
    return false;
  };

  return (
    <>
      <nav className="navbar">
        <div className="container navbar-container">
          <div className="navbar-brand">
            <span>Pretium</span>
            <small>Engineering Reports</small>
          </div>
          <div className="navbar-links">
            <Link 
              href="/dashboard" 
              className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}
            >
              Dashboard
            </Link>

            {user && (
              <button onClick={handleSignOut} className="btn btn-secondary">
                Sign Out
              </button>
            )}
          </div>
        </div>
      </nav>

      <main>
        {children}
      </main>
    </>
  );
} 