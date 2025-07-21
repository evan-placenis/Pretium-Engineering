'use client';
import { useState, useRef } from 'react';

interface UploadPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], dateTaken: string, useFilenameAsDescription: boolean) => void;
  loading?: boolean;
  progress?: string;
}

export default function UploadPhotoModal({ 
  isOpen, 
  onClose, 
  onUpload, 
  loading = false, 
  progress = '' 
}: UploadPhotoModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dateTaken, setDateTaken] = useState<string>('');
  const [useFilenameAsDescription, setUseFilenameAsDescription] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter(file => file.type.startsWith('image/'));
      setSelectedFiles(validFiles);
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles, dateTaken, useFilenameAsDescription);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setDateTaken('');
    setUseFilenameAsDescription(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFilenameWithoutExtension = (filename: string) => {
    return filename.replace(/\.[^/.]+$/, '');
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
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>Upload Photos</h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666',
              padding: '0.25rem'
            }}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '500',
            color: 'var(--color-text)'
          }}>
            Date Taken
          </label>
          <input
            type="date"
            value={dateTaken}
            onChange={(e) => setDateTaken(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid var(--color-border)',
              borderRadius: '0.25rem',
              marginBottom: '1rem'
            }}
            disabled={loading}
          />
          <p style={{ 
            fontSize: '0.75rem', 
            color: 'var(--color-text-secondary)', 
            marginTop: '0.25rem' 
          }}>
            Select the date when these photos were taken. This will be used as the creation date for organizing your photos chronologically.
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '500',
            color: 'var(--color-text)'
          }}>
            Select Photos
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid var(--color-border)',
              borderRadius: '0.25rem',
              backgroundColor: 'white'
            }}
            disabled={loading}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            color: 'var(--color-text)'
          }}>
            <input
              type="checkbox"
              checked={useFilenameAsDescription}
              onChange={(e) => setUseFilenameAsDescription(e.target.checked)}
              disabled={loading}
              style={{
                width: '1rem',
                height: '1rem',
                cursor: 'pointer'
              }}
            />
            <span style={{ fontWeight: '500' }}>
              Use filename as description
            </span>
          </label>
          <p style={{ 
            fontSize: '0.75rem', 
            color: 'var(--color-text-secondary)', 
            marginTop: '0.25rem',
            marginLeft: '1.5rem'
          }}>
            Automatically set the image description to the filename (without extension). Useful for photos with descriptive names.
          </p>
        </div>

        {selectedFiles.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.75rem', color: 'var(--color-text)' }}>
              Selected Files ({selectedFiles.length})
            </h4>
            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid var(--color-border)',
              borderRadius: '0.25rem',
              padding: '0.75rem'
            }}>
              {selectedFiles.map((file, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: index < selectedFiles.length - 1 ? '1px solid #eee' : 'none'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {formatFileSize(file.size)}
                      {useFilenameAsDescription && (
                        <span style={{ marginLeft: '0.5rem', color: '#2563eb' }}>
                          → "{getFilenameWithoutExtension(file.name)}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleClose}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            className="btn btn-primary"
            disabled={loading || selectedFiles.length === 0}
          >
            {loading ? 'Uploading...' : `Upload ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
} 