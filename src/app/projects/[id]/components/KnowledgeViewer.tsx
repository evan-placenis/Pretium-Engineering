'use client';
import { useState } from 'react';

interface KnowledgeDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: 'spec' | 'building_code';
  file_size: number;
  uploaded_at: string;
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
  onTestDocument: (document: KnowledgeDocument) => void;
  onDeleteDocument: (document: KnowledgeDocument) => void;
  onCloseChunks: () => void;
  formatFileSize: (bytes: number) => string;
  formatDate: (dateString: string) => string;
}

export default function KnowledgeViewer({
  documents,
  selectedDocument,
  parsedChunks,
  loadingChunks,
  showChunks,
  onTestDocument,
  onDeleteDocument,
  onCloseChunks,
  formatFileSize,
  formatDate
}: KnowledgeViewerProps) {
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);

  if (documents.length === 0) {
    return (
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
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-lighter)" }}>
              <div style={{ marginBottom: "0.5rem" }}>📋 Specifications • 🏗️ Building Codes • 🤖 AI Enhancement</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: "2rem" }}>
      <div className="card-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: "1.5rem" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '24px', height: '24px', opacity: 0.8 }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-primary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 style={{ margin: 0, color: "var(--color-text)" }}>Knowledge Documents ({documents.length})</h3>
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-text-lighter)" }}>
            AI-Enhanced Project Knowledge
          </div>
        </div>
        
        {/* Documents List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: showChunks ? '2rem' : '0' }}>
          {documents.map((doc) => (
            <div key={doc.id} style={{ 
              border: '1px solid var(--color-border)', 
              borderRadius: '8px', 
              padding: '1rem',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '12px',
                      backgroundColor: doc.file_type === 'spec' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                      color: doc.file_type === 'spec' ? 'rgb(59, 130, 246)' : 'rgb(34, 197, 94)',
                      border: `1px solid ${doc.file_type === 'spec' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
                    }}>
                      {doc.file_type === 'spec' ? '📋 Specification' : '🏗️ Building Code'}
                    </span>
                    <h4 style={{ 
                      margin: 0, 
                      fontWeight: 600, 
                      color: "var(--color-text)",
                      fontSize: '1rem'
                    }}>
                      {doc.file_name}
                    </h4>
                  </div>
                  <div style={{ 
                    fontSize: "0.875rem", 
                    color: "var(--color-text-lighter)",
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      📏 {formatFileSize(doc.file_size)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      📅 {formatDate(doc.uploaded_at)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => onTestDocument(doc)}
                    disabled={loadingChunks}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: loadingChunks ? 'not-allowed' : 'pointer',
                      opacity: loadingChunks ? 0.6 : 1,
                      transition: 'all 0.2s ease',
                      minWidth: '120px'
                    }}
                    onMouseEnter={(e) => {
                      if (!loadingChunks) {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loadingChunks) {
                        e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                      }
                    }}
                  >
                    {loadingChunks && selectedDocument?.id === doc.id ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        Parsing...
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🔍 Test Parsing
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => onDeleteDocument(doc)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'transparent',
                      color: 'var(--color-danger)',
                      border: '1px solid var(--color-danger)',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '80px'
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
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

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
  );
} 