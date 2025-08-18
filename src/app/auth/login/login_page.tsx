'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [cooldownTime, setCooldownTime] = useState(0);
  const lastAttemptTime = useRef<number>(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check for error from callback
  useEffect(() => {
    const callbackError = searchParams.get('error');
    if (callbackError === 'callback_failed') {
      setError('Authentication failed. Please try again.');
    }
  }, [searchParams]);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setTimeout(() => {
        setCooldownTime(cooldownTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTime]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTime.current;
    
    // Prevent rapid attempts (minimum 2 seconds between attempts)
    if (timeSinceLastAttempt < 2000) {
      setError('Please wait a moment before trying again.');
      return;
    }
    
    // If we have too many attempts, enforce cooldown
    if (attemptCount >= 5 && cooldownTime > 0) {
      setError(`Too many login attempts. Please wait ${cooldownTime} seconds before trying again.`);
      return;
    }
    
    setLoading(true);
    setError(null);
    lastAttemptTime.current = now;
    setAttemptCount(prev => prev + 1);

    try {
      // Use Supabase to sign in with email/password
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Handle rate limiting specifically
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          setCooldownTime(60); // 1 minute cooldown
          setError('Too many login attempts. Please wait 1 minute before trying again.');
        } else {
          throw error;
        }
        return;
      }
      
      // Reset attempt count on success
      setAttemptCount(0);
      setCooldownTime(0);
      
      // On successful authentication, redirect to dashboard
      console.log('Login successful, redirecting...');
      router.push('/dashboard');
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle different types of errors
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        setCooldownTime(60);
        setError('Too many login attempts. Please wait 1 minute before trying again.');
      } else if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials.');
      } else {
        setError(error.message || 'An error occurred during login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loading-container">
      <div className="card" style={{ maxWidth: "400px", width: "100%" }}>
        <div className="card-body">
          <h2 style={{ textAlign: "center" }}>Sign in to your account</h2>
          
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Email address"
                disabled={loading || cooldownTime > 0}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Password"
                disabled={loading || cooldownTime > 0}
              />
            </div>

            <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
              <Link href="/auth/forgot-password">
                <span className="text-sm text-blue-600 hover:underline">Forgot your password?</span>
              </Link>
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <button
                type="submit"
                disabled={loading || cooldownTime > 0}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                {loading ? 'Signing in...' : 
                 cooldownTime > 0 ? `Wait ${cooldownTime}s...` : 'Sign in'}
              </button>
            </div>
          </form>
          
          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <p className="text-secondary">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 