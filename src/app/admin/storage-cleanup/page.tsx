'use client';

import { useState } from 'react';
import { 
  wipeAllImageBuckets, 
  wipeAllStorageBuckets, 
  getStorageStats,
  wipeStorageBucket,
  type StorageCleanupResult 
} from '@/hooks/storage-cleanup';
import { Toast } from '@/components/feedback';

export default function StorageCleanupPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ [bucketName: string]: { fileCount: number } }>({});
  const [results, setResults] = useState<StorageCleanupResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const bucketStats = await getStorageStats();
      setStats(bucketStats);
    } catch (err: any) {
      setError('Failed to load storage stats: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWipeImageBuckets = async () => {
          if (!confirm('⚠️ WARNING: This will permanently delete ALL files from project-images bucket. This action cannot be undone!\n\nAre you sure you want to continue?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResults([]);
      
      const cleanupResults = await wipeAllImageBuckets();
      setResults(cleanupResults);
      
      const totalDeleted = cleanupResults.reduce((sum, result) => sum + result.filesDeleted, 0);
      setSuccessMessage(`Successfully deleted ${totalDeleted} files from image buckets`);
      
      // Refresh stats
      await loadStats();
    } catch (err: any) {
      setError('Failed to wipe image buckets: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWipeAllBuckets = async () => {
          if (!confirm('⚠️ WARNING: This will permanently delete ALL files from ALL storage buckets (project-images and project-knowledge). This action cannot be undone!\n\nAre you sure you want to continue?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResults([]);
      
      const cleanupResults = await wipeAllStorageBuckets();
      setResults(cleanupResults);
      
      const totalDeleted = cleanupResults.reduce((sum, result) => sum + result.filesDeleted, 0);
      setSuccessMessage(`Successfully deleted ${totalDeleted} files from all buckets`);
      
      // Refresh stats
      await loadStats();
    } catch (err: any) {
      setError('Failed to wipe all buckets: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWipeSpecificBucket = async (bucketName: string) => {
    if (!confirm(`⚠️ WARNING: This will permanently delete ALL files from the ${bucketName} bucket. This action cannot be undone!\n\nAre you sure you want to continue?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResults([]);
      
      const result = await wipeStorageBucket(bucketName);
      setResults([result]);
      
      if (result.success) {
        setSuccessMessage(`Successfully deleted ${result.filesDeleted} files from ${bucketName}`);
      } else {
        setError(`Failed to wipe ${bucketName}: ${result.errors.join(', ')}`);
      }
      
      // Refresh stats
      await loadStats();
    } catch (err: any) {
      setError(`Failed to wipe ${bucketName}: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: 'var(--color-primary)' }}>
        Storage Bucket Cleanup
      </h1>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-body">
          <h3 style={{ marginBottom: '1rem' }}>Storage Statistics</h3>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button
              onClick={loadStats}
              disabled={loading}
              className="btn btn-secondary"
            >
              {loading ? 'Loading...' : 'Refresh Stats'}
            </button>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {Object.entries(stats).map(([bucketName, stat]) => (
              <div key={bucketName} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '1rem',
                border: '1px solid var(--color-border)',
                borderRadius: '0.25rem',
                backgroundColor: 'var(--color-bg-card)'
              }}>
                <div>
                  <strong>{bucketName}</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {stat.fileCount} files
                  </div>
                </div>
                <button
                  onClick={() => handleWipeSpecificBucket(bucketName)}
                  disabled={loading || stat.fileCount === 0}
                  className="btn btn-danger btn-sm"
                >
                  Wipe Bucket
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-body">
          <h3 style={{ marginBottom: '1rem' }}>Bulk Operations</h3>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleWipeImageBuckets}
              disabled={loading}
              className="btn btn-warning"
            >
              {loading ? 'Processing...' : 'Wipe All Image Buckets'}
            </button>
            
            <button
              onClick={handleWipeAllBuckets}
              disabled={loading}
              className="btn btn-danger"
            >
              {loading ? 'Processing...' : 'Wipe ALL Storage Buckets'}
            </button>
          </div>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '1rem' }}>
            <strong>⚠️ Warning:</strong> These operations will permanently delete all files from the specified storage buckets. 
            This action cannot be undone and will break any existing references to these files in your application.
          </p>
        </div>
      </div>

      {results.length > 0 && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: '1rem' }}>Cleanup Results</h3>
            
            {results.map((result, index) => (
              <div key={index} style={{ 
                marginBottom: '1rem',
                padding: '1rem',
                border: '1px solid var(--color-border)',
                borderRadius: '0.25rem',
                backgroundColor: result.success ? 'var(--color-bg-card)' : '#fee'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>{result.bucketName}</strong>
                  <span style={{ 
                    color: result.success ? 'green' : 'red',
                    fontWeight: '500'
                  }}>
                    {result.success ? '✓ Success' : '✗ Failed'}
                  </span>
                </div>
                
                <div style={{ fontSize: '0.875rem' }}>
                  Files deleted: {result.filesDeleted}
                </div>
                
                {result.errors.length > 0 && (
                  <div style={{ fontSize: '0.875rem', color: 'red', marginTop: '0.5rem' }}>
                    Errors: {result.errors.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Toast message={error} type="error" />
      <Toast message={successMessage} type="success" />
    </div>
  );
} 