'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else if (!pathname.startsWith('/auth/')) {
        router.push('/auth/login');
      }
    };

    checkUser();
  }, [pathname, router]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
      router.push('/auth/login');
    }
  };

  // Don't show navigation on auth pages
  if (pathname.startsWith('/auth/')) {
    return <>{children}</>;
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