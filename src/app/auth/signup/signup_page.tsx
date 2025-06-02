'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      
      // Success message
      alert('Check your email for the confirmation link!');
    } catch (error: any) {
      setError(error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loading-container">
      <div className="card" style={{ maxWidth: "400px", width: "100%" }}>
        <div className="card-body">
          <h2 style={{ textAlign: "center" }}>Create an account</h2>
          
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSignUp}>
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Password"
              />
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                {loading ? 'Signing up...' : 'Sign up'}
              </button>
            </div>
          </form>
          
          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <p className="text-secondary">
              Already have an account?{' '}
              <Link href="/auth/login">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 