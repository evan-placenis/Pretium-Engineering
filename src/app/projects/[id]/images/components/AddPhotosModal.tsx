'use client';

import { useState } from 'react';

interface AddPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], dateTaken: string, useFilenameAsDescription: boolean) => void;
  groupName: string;
  loading?: boolean;
  progress?: string;
}

export default function AddPhotosModal({ 
  isOpen, 
  onClose, 
  onUpload, 
  groupName,
  loading = false,
  progress = ''
}: AddPhotosModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dateTaken, setDateTaken] = useState('');
  const [useFilenameAsDescription, setUseFilenameAsDescription] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;
    
    onUpload(selectedFiles, dateTaken, useFilenameAsDescription);
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setDateTaken('');
    setUseFilenameAsDescription(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ margin: 0, color: 'var(--color-text)' }}>
            Add Photos to "{groupName}"
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* File Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: 'var(--color-text)'
            }}>
              Select Photos:
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--color-border)',
                borderRadius: '0.25rem',
                fontSize: '1rem'
              }}
              required
            />
            {selectedFiles.length > 0 && (
              <p style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.875rem', 
                color: 'var(--color-text-secondary)' 
              }}>
                Selected {selectedFiles.length} photo{selectedFiles.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Date Taken */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: 'var(--color-text)'
            }}>
              Date Taken:
            </label>
            <input
              type="date"
              value={dateTaken}
              onChange={(e) => setDateTaken(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--color-border)',
                borderRadius: '0.25rem',
                fontSize: '1rem'
              }}
              required
            />
          </div>

          {/* Use Filename as Description Option */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={useFilenameAsDescription}
                onChange={(e) => setUseFilenameAsDescription(e.target.checked)}
                style={{ width: '1rem', height: '1rem' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                Use image filename as description
              </span>
            </label>
          </div>

          {/* Progress Display */}
          {loading && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '0.25rem',
              textAlign: 'center'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #2b579a',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem auto'
              }} />
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <p style={{ margin: 0, color: 'var(--color-text)' }}>
                {progress || 'Uploading photos...'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || selectedFiles.length === 0}
            >
              {loading ? 'Uploading...' : `Add ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 