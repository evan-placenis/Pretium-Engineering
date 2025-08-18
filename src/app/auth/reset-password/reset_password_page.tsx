'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorDescription = searchParams.get('error_description');
    if (errorDescription) {
      setError(errorDescription);
    }
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Supabase automatically handles the session from the reset link's token
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setMessage('Your password has been reset successfully. You can now sign in with your new password.');
      // Optionally, redirect to login after a delay
      setTimeout(() => {
        router.push('/auth/login');
      }, 5000);

    } catch (error: any) {
      setError(error.message || 'An error occurred. The reset link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loading-container">
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="card-body">
          <h2 style={{ textAlign: 'center' }}>Reset Your Password</h2>
          
          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          
          {!message && (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="Enter new password"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  placeholder="Confirm new password"
                  disabled={loading}
                />
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link href="/auth/login">
               <span className="text-sm text-blue-600 hover:underline">Back to Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
