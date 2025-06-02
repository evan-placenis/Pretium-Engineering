'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // TEMPORARY: Skip session check and redirect directly to dashboard
    console.log('Homepage: Authentication temporarily disabled, redirecting to dashboard');
    window.location.href = '/dashboard';
    
    /* Original session check (disabled temporarily)
    const checkSession = async () => {
      console.log('Homepage: Checking session');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('Homepage: Session found, redirecting to dashboard');
        window.location.href = '/dashboard';
      } else {
        console.log('Homepage: No session found, redirecting to login');
        window.location.href = '/auth/login';
      }
    };

    checkSession();
    */
  }, [router]);

  return (
    <div className="loading-container">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ 
          position: 'relative', 
          display: 'inline-block',
          margin: '0 auto 1.5rem'
        }}>
          <div style={{ 
            position: 'absolute', 
            inset: '-4px', 
            borderRadius: 'var(--radius-lg)', 
            background: 'linear-gradient(to right, var(--color-primary), var(--color-primary-light))', 
            opacity: 0.75, 
            filter: 'blur(8px)' 
          }}></div>
          <div style={{ 
            position: 'relative', 
            background: 'white',
            padding: '1.5rem 2rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0' }}>Pretium</h1>
          </div>
        </div>
        <p style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--color-text-light)', marginBottom: '2rem' }}>
          Engineering Report Automation
        </p>
        
        <div className="loading-dots">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-lighter)' }}>
          Redirecting to Dashboard...
        </p>
      </div>
    </div>
  );
} 