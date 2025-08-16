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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  // Don't show navigation on auth pages or edit report page
  if (pathname.startsWith('/auth/') || pathname.includes('/edit')) {
    return <>{children}</>;
  }

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
    // Dashboard is never highlighted
    if (path === '/dashboard') {
      return false;
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
      <nav className="navbar" key={user ? user.id : 'no-user'}>
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