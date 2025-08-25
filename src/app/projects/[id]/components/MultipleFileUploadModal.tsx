'use client';
import { useState, useRef } from 'react';

interface MultipleFileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], uploadType: 'spec' | 'building_code') => void;
  loading?: boolean;
  progress?: string;
}

export default function MultipleFileUploadModal({ 
  isOpen, 
  onClose, 
  onUpload, 
  loading = false, 
  progress = '' 
}: MultipleFileUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadType, setUploadType] = useState<'spec' | 'building_code'>('spec');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter(file => file.name.toLowerCase().endsWith('.docx'));
      setSelectedFiles(validFiles);
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles, uploadType);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setUploadType('spec');
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
          <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>📁 Upload Files To AI Knowledge</h2>
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
            File Type
          </label>
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as 'spec' | 'building_code')}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid var(--color-border)',
              borderRadius: '0.25rem',
              backgroundColor: 'white'
            }}
            disabled={loading}
          >
            <option value="spec">📋 Specification</option>
            <option value="building_code">🏗️ Building Code</option>
          </select>
          <p style={{ 
            fontSize: '0.75rem', 
            color: 'var(--color-text-secondary)', 
            marginTop: '0.25rem' 
          }}>
            Choose the type of documents you're uploading. This helps organize your knowledge base.
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '500',
            color: 'var(--color-text)'
          }}>
            Select Files
          </label>
          <div style={{ position: 'relative' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '500',
                color: 'white',
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.6 : 1
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#1e4d72';
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                }
              }}
            >
              Choose Files
            </button>
            {selectedFiles.length > 0 && (
              <span style={{
                marginLeft: '1rem',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)'
              }}>
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <p style={{ 
            fontSize: '0.75rem', 
            color: 'var(--color-text-secondary)', 
            marginTop: '0.25rem' 
          }}>
            Select multiple .docx files to upload. Files will be processed and added to your AI knowledge base.
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
                      📄 {file.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {formatFileSize(file.size)}
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
              {progress || 'Processing files...'}
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
            {loading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
} 