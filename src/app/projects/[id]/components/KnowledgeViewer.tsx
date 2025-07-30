'use client';
import { useState } from 'react';
import MultipleFileUploadModal from './MultipleFileUploadModal';

interface KnowledgeDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: 'spec' | 'building_code';
  file_size: number;
  uploaded_at: string;
  processed?: boolean;
  processed_at?: string;
  chunks_count?: number;
  processing_error?: string;
}

interface ParsedChunk {
  content: string;
  sectionTitle?: string;
  chunkIndex: number;
}

interface KnowledgeViewerProps {
  documents: KnowledgeDocument[];
  selectedDocument: KnowledgeDocument | null;
  parsedChunks: ParsedChunk[];
  loadingChunks: boolean;
  showChunks: boolean;
  onDeleteDocument: (document: KnowledgeDocument) => void;
  onCloseChunks: () => void;
  formatFileSize: (bytes: number) => string;
  formatDate: (dateString: string) => string;
  onSpecUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBuildingCodeUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  uploadError: string | null;
  uploadSuccess: string | null;
  projectId: string;
  // Multiple file upload props
  handleMultipleFileUpload?: (files: File[], uploadType: 'spec' | 'building_code') => Promise<void>;
  multipleUploadProgress?: {
    current: number;
    total: number;
    currentFileName: string;
    isProcessing: boolean;
  } | null;
  showMultipleUploadModal?: boolean;
  setShowMultipleUploadModal?: (show: boolean) => void;
}

export default function KnowledgeViewer({
  documents,
  selectedDocument,
  parsedChunks,
  loadingChunks,
  showChunks,
  onDeleteDocument,
  onCloseChunks,
  formatFileSize,
  formatDate,
  onSpecUpload,
  onBuildingCodeUpload,
  uploading,
  uploadError,
  uploadSuccess,
  projectId,
  // Multiple file upload props
  handleMultipleFileUpload,
  multipleUploadProgress,
  showMultipleUploadModal = false,
  setShowMultipleUploadModal
}: KnowledgeViewerProps) {
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);





  if (documents.length === 0) {
    return (
      <>
        <div className="card" style={{ marginBottom: "2rem" }}>
        <div className="card-body">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem', opacity: 0.6 }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-text-lighter)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 style={{ marginBottom: "0.5rem", color: "var(--color-text)" }}>No Knowledge Documents</h3>
            <p style={{ marginBottom: "1rem" }} className="text-secondary">
              Upload project specifications and building codes to enhance AI knowledge for this project.
            </p>
            
            {/* Upload buttons for empty state */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '300px', margin: '0 auto' }}>
              {uploadError && (
                <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                  {uploadError}
                </div>
              )}
              
              {uploadSuccess && (
                <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
                  {uploadSuccess}
                </div>
              )}
              
              {/* <div> TO BE TAKEDN OUT LATER !!!
                <input
                  type="file"
                  accept=".docx"
                  style={{ display: 'none' }}
                  id="spec-upload-empty"
                  onChange={onSpecUpload}
                  disabled={uploading}
                />
                <label 
                  htmlFor="spec-upload-empty" 
                  className={`btn btn-secondary ${uploading ? 'disabled' : ''}`} 
                  style={{ width: '100%' }}
                >
                  {uploading ? 'Uploading...' : '📋 Upload Specification'}
                </label>
              </div>
              <div>
                <input
                  type="file"
                  accept=".docx"
                  style={{ display: 'none' }}
                  id="building-codes-upload-empty"
                  onChange={onBuildingCodeUpload}
                  disabled={uploading}
                />
                <label 
                  htmlFor="building-codes-upload-empty" 
                  className={`btn btn-secondary ${uploading ? 'disabled' : ''}`} 
                  style={{ width: '100%' }}
                >
                  {uploading ? 'Uploading...' : '🏗️ Upload Building Codes'}
                </label>
              </div> */}
              
              {/* Multiple file upload option */}
              <div>
                <button
                  onClick={() => setShowMultipleUploadModal?.(true)}
                  className={`btn btn-primary ${uploading ? 'disabled' : ''}`} 
                  style={{ 
                    width: '100%',
                    position: 'relative'
                  }}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span style={{ opacity: 0.7 }}>📁 Processing Multiple Files...</span>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        right: '1rem',
                        transform: 'translateY(-50%)',
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid currentColor',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    </>
                  ) : (
                    '📁 Upload Files To AI Knowledge'
                  )}
                </button>
              </div>
            </div>
            
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-lighter)", marginTop: "1rem" }}>
              <div style={{ marginBottom: "0.5rem" }}>📋 Specifications • 🏗️ Building Codes • 🤖 AI Enhancement</div>
            </div>
          </div>
        </div>
      </div>

      {/* Multiple File Upload Progress Overlay */}
      {multipleUploadProgress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Animated Loading Icon */}
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 1.5rem',
              position: 'relative'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #2b579a',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '1.5rem'
              }}>
                📁
              </div>
            </div>
            
            <h3 style={{ 
              marginBottom: '1rem', 
              fontSize: '1.2rem',
              color: 'var(--color-text)'
            }}>
              Uploading Multiple Files
            </h3>
            
            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#f3f3f3',
              borderRadius: '4px',
              marginBottom: '1rem',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(multipleUploadProgress.current / multipleUploadProgress.total) * 100}%`,
                height: '100%',
                backgroundColor: '#2b579a',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            {/* Progress Text */}
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ 
                fontSize: '1rem', 
                fontWeight: '600',
                color: 'var(--color-primary)'
              }}>
                {multipleUploadProgress.current}
              </span>
              <span style={{ fontSize: '1rem', color: 'var(--color-text-lighter)' }}>
                {' '}of {multipleUploadProgress.total} files
              </span>
            </div>
            
            {/* Current File Name */}
            {multipleUploadProgress.currentFileName && (
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-lighter)',
                marginBottom: '1rem',
                padding: '0.5rem',
                backgroundColor: 'var(--color-background-hover)',
                borderRadius: '4px',
                border: '1px solid var(--color-border)'
              }}>
                📄 Currently uploading: <strong>{multipleUploadProgress.currentFileName}</strong>
              </div>
            )}
            
            {/* Status Message */}
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-lighter)',
              fontStyle: 'italic'
            }}>
              {multipleUploadProgress.isProcessing ? 'Processing and generating embeddings...' : 'Preparing upload...'}
            </div>
          </div>
        </div>
      )}

      {/* Multiple file upload modal */}
      {showMultipleUploadModal && setShowMultipleUploadModal && handleMultipleFileUpload && (
        <MultipleFileUploadModal
          isOpen={showMultipleUploadModal}
          onClose={() => setShowMultipleUploadModal(false)}
          onUpload={handleMultipleFileUpload}
          loading={uploading}
          progress={multipleUploadProgress ? 
            `Processing ${multipleUploadProgress.current}/${multipleUploadProgress.total}: ${multipleUploadProgress.currentFileName}` : 
            ''
          }
        />
      )}
      </>
    );
  }

  return (
    <>
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div className="card-body">
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: isExpanded ? "1.5rem" : "0",
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setIsExpanded(!isExpanded)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                width: '20px', 
                height: '20px', 
                opacity: 0.8,
                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s ease'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-primary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div style={{ width: '24px', height: '24px', opacity: 0.8 }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-primary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 style={{ margin: 0, color: "var(--color-text)" }}>Knowledge Documents ({documents.length})</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: "0.875rem", color: "var(--color-text-lighter)" }}>
                AI-Enhanced Project Knowledge
              </div>
              {/* Upload buttons in header */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="file"
                  accept=".docx"
                  style={{ display: 'none' }}
                  id="spec-upload-header"
                  onChange={onSpecUpload}
                  disabled={uploading}
                />
                {/* <label TO BE TAKEN OUT LATER !!!  - ALONG WITH ITS CORRESPONDING CODE
                  htmlFor="spec-upload-header" 
                  className={`btn btn-secondary btn-sm ${uploading ? 'disabled' : ''}`}
                  style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                >
                  {uploading ? '⏳' : '📋 Spec'}
                </label> */}
                {/* <input
                  type="file"
                  accept=".docx"
                  style={{ display: 'none' }}
                  id="building-codes-upload-header"
                  onChange={onBuildingCodeUpload}
                  disabled={uploading}
                />
                <label 
                  htmlFor="building-codes-upload-header" 
                  className={`btn btn-secondary btn-sm ${uploading ? 'disabled' : ''}`}
                  style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                >
                  {uploading ? '⏳' : '🏗️ Codes'}
                </label> */}
                
                {/* Multiple file upload button */}
                <button
                  onClick={() => setShowMultipleUploadModal?.(true)}
                  className={`btn btn-primary btn-sm ${uploading ? 'disabled' : ''}`}
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.5rem 0.75rem',
                    position: 'relative'
                  }}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span style={{ opacity: 0.7 }}>📁</span>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        right: '0.25rem',
                        transform: 'translateY(-50%)',
                        width: '12px',
                        height: '12px',
                        border: '2px solid transparent',
                        borderTop: '2px solid currentColor',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
                

              </div>
            </div>
          </div>
          
          {/* Collapsible Content */}
          {isExpanded && (
            <div style={{ 
              transition: 'all 0.3s ease',
              opacity: isExpanded ? 1 : 0,
              maxHeight: isExpanded ? 'none' : '0',
              overflow: 'hidden'
            }}>
              {/* Upload status messages */}
              {uploadError && (
                <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                  {uploadError}
                </div>
              )}
              
              {uploadSuccess && (
                <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
                  {uploadSuccess}
                </div>
              )}
              
              {/* Documents List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: showChunks ? '2rem' : '0' }}>
            {documents.map((doc) => (
              <div key={doc.id} style={{ 
                border: '1px solid var(--color-border)', 
                borderRadius: '6px', 
                padding: '0.75rem',
                backgroundColor: 'var(--color-background)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-background-hover)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.backgroundColor = 'var(--color-background)';
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    {/* Single line with all info */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      fontSize: "0.75rem",
                      color: "var(--color-text-lighter)"
                    }}>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '8px',
                        backgroundColor: doc.file_type === 'spec' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: doc.file_type === 'spec' ? 'rgb(59, 130, 246)' : 'rgb(34, 197, 94)',
                        border: `1px solid ${doc.file_type === 'spec' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
                        whiteSpace: 'nowrap'
                      }}>
                        {doc.file_type === 'spec' ? '📋 Spec' : '🏗️ Code'}
                      </span>
                      
                      <span style={{ 
                        fontWeight: 600, 
                        color: "var(--color-text)",
                        fontSize: '0.8rem',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {doc.file_name}
                      </span>
                      
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                        📏 {formatFileSize(doc.file_size)}
                      </span>
                      
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                        📅 {formatDate(doc.uploaded_at)}
                      </span>
                      
                      {/* Processing Status */}
                      {doc.processed === true && (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          color: 'var(--color-success)',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          whiteSpace: 'nowrap'
                        }}>
                          ✅ ({doc.chunks_count || 0})
                        </span>
                      )}
                      {doc.processed === false && doc.processing_error && (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          color: 'var(--color-danger)',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          whiteSpace: 'nowrap'
                        }}>
                          ❌ Error
                        </span>
                      )}
                      {doc.processed === false && !doc.processing_error && (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          color: 'var(--color-warning)',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          whiteSpace: 'nowrap'
                        }}>
                          ⏳
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.75rem' }}>
                    <button
                      onClick={() => onDeleteDocument(doc)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: 'transparent',
                        color: 'var(--color-danger)',
                        border: '1px solid var(--color-danger)',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        minWidth: '60px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-danger)';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-danger)';
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Processing Error Details */}
                {doc.processed === false && doc.processing_error && doc.processing_error.length > 0 && (
                  <div style={{ 
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                      color: 'var(--color-danger)',
                      fontWeight: 500
                    }}>
                      ⚠️ Processing Error
                    </div>
                    <div style={{ 
                      color: 'var(--color-text)',
                      fontSize: '0.8rem',
                      lineHeight: '1.4'
                    }}>
                      {doc.processing_error}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
            </div>
          )}

          {/* Chunks Viewer */}
          {showChunks && selectedDocument && (
            <div style={{ 
              border: '1px solid var(--color-border)', 
              borderRadius: '8px', 
              padding: '1.5rem',
              backgroundColor: 'var(--color-background)',
              marginTop: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '20px', height: '20px', opacity: 0.8 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-primary)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h4 style={{ 
                    margin: 0, 
                    fontWeight: 600, 
                    color: "var(--color-text)",
                    fontSize: '1.1rem'
                  }}>
                    Parsed Chunks: {selectedDocument.file_name}
                  </h4>
                </div>
                <button
                  onClick={onCloseChunks}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.25rem',
                    color: 'var(--color-text-lighter)',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text)';
                    e.currentTarget.style.backgroundColor = 'var(--color-background-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-lighter)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{ 
                fontSize: "0.875rem", 
                color: "var(--color-text-lighter)",
                marginBottom: '1.5rem',
                padding: '0.75rem',
                backgroundColor: 'var(--color-background-hover)',
                borderRadius: '6px',
                border: '1px solid var(--color-border)'
              }}>
                <span style={{ fontWeight: 500 }}>📊 Analysis:</span> {parsedChunks.length} chunks extracted • Click on any chunk to view full content
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {parsedChunks.map((chunk, index) => (
                  <div
                    key={index}
                    style={{
                      border: selectedChunk === index ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      backgroundColor: selectedChunk === index ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-background)'
                    }}
                    onClick={() => setSelectedChunk(selectedChunk === index ? null : index)}
                    onMouseEnter={(e) => {
                      if (selectedChunk !== index) {
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--color-background-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedChunk !== index) {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.backgroundColor = 'var(--color-background)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: 600, 
                        color: "var(--color-text)",
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        📄 Chunk {chunk.chunkIndex}
                      </span>
                      <span style={{ 
                        fontSize: "0.75rem", 
                        color: "var(--color-text-lighter)",
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'var(--color-background-hover)',
                        borderRadius: '4px'
                      }}>
                        {chunk.content.length} characters
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '0.875rem', color: "var(--color-text)" }}>
                      {selectedChunk === index ? (
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          maxHeight: '400px', 
                          overflowY: 'auto',
                          lineHeight: '1.6',
                          padding: '1rem',
                          backgroundColor: 'var(--color-background-hover)',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border)'
                        }}>
                          {chunk.content}
                        </div>
                      ) : (
                        <div style={{ 
                          lineHeight: '1.5',
                          color: 'var(--color-text-lighter)'
                        }}>
                          {chunk.content.substring(0, 200)}
                          {chunk.content.length > 200 && (
                            <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>... (click to expand)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Multiple File Upload Progress Overlay */}
      {multipleUploadProgress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Animated Loading Icon */}
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 1.5rem',
              position: 'relative'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #2b579a',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '1.5rem'
              }}>
                📁
              </div>
            </div>
            
            <h3 style={{ 
              marginBottom: '1rem', 
              fontSize: '1.2rem',
              color: 'var(--color-text)'
            }}>
              Uploading Multiple Files
            </h3>
            
            {/* Progress Bar */}
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#f3f3f3',
              borderRadius: '4px',
              marginBottom: '1rem',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(multipleUploadProgress.current / multipleUploadProgress.total) * 100}%`,
                height: '100%',
                backgroundColor: '#2b579a',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            {/* Progress Text */}
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ 
                fontSize: '1rem', 
                fontWeight: '600',
                color: 'var(--color-primary)'
              }}>
                {multipleUploadProgress.current}
              </span>
              <span style={{ fontSize: '1rem', color: 'var(--color-text-lighter)' }}>
                {' '}of {multipleUploadProgress.total} files
              </span>
            </div>
            
            {/* Current File Name */}
            {multipleUploadProgress.currentFileName && (
              <div style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-lighter)',
                marginBottom: '1rem',
                padding: '0.5rem',
                backgroundColor: 'var(--color-background-hover)',
                borderRadius: '4px',
                border: '1px solid var(--color-border)'
              }}>
                📄 Currently uploading: <strong>{multipleUploadProgress.currentFileName}</strong>
              </div>
            )}
            
            {/* Status Message */}
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-lighter)',
              fontStyle: 'italic'
            }}>
              {multipleUploadProgress.isProcessing ? 'Processing and generating embeddings...' : 'Preparing upload...'}
            </div>
          </div>
        </div>
      )}



      {/* Multiple file upload modal */}
      {showMultipleUploadModal && setShowMultipleUploadModal && handleMultipleFileUpload && (
        <MultipleFileUploadModal
          isOpen={showMultipleUploadModal}
          onClose={() => setShowMultipleUploadModal(false)}
          onUpload={handleMultipleFileUpload}
          loading={uploading}
          progress={multipleUploadProgress ? 
            `Processing ${multipleUploadProgress.current}/${multipleUploadProgress.total}: ${multipleUploadProgress.currentFileName}` : 
            ''
          }
        />
      )}

    </>
  );
} 