'use client';
import { useState } from 'react';

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
  projectId
}: KnowledgeViewerProps) {
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTestSearch = async () => {
    if (!testQuery.trim()) return;
    setTesting(true);
    try {
      const res = await fetch('/api/test-embedding-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, query: testQuery, limit: 5 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTestResults(data.results || []);
    } catch (error) {
      console.error('Test search failed:', error);
      setTestResults([]);
    } finally {
      setTesting(false);
    }
  };

  const runDefaultTests = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/test-embedding-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, runDefaultTests: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Log results to console for debugging
      console.log('=== DEFAULT TESTS COMPLETED ===');
      data.testResults.forEach((testResult: any) => {
        if (testResult.success) {
          console.log(`✅ "${testResult.query}": ${testResult.results.length} results`);
        } else {
          console.error(`❌ "${testResult.query}": ${testResult.error}`);
        }
      });
    } catch (error) {
      console.error('Default tests failed:', error);
    } finally {
      setTesting(false);
    }
  };

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
              
              <div>
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
              </div>
            </div>
            
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-lighter)", marginTop: "1rem" }}>
              <div style={{ marginBottom: "0.5rem" }}>📋 Specifications • 🏗️ Building Codes • 🤖 AI Enhancement</div>
            </div>
          </div>
        </div>
      </div>
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
                <label 
                  htmlFor="spec-upload-header" 
                  className={`btn btn-secondary btn-sm ${uploading ? 'disabled' : ''}`}
                  style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                >
                  {uploading ? '⏳' : '📋 Spec'}
                </label>
                <input
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
                </label>
                {/* Test Search Button */}
                <button
                  onClick={() => setShowTestModal(true)}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                  disabled={testing}
                >
                  {testing ? '⏳' : '🧪 Test Search'}
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
                      {/* Processing Status */}
                      {doc.processed === true && (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          color: 'var(--color-success)',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          ✅ Processed
                          {doc.chunks_count && (
                            <span style={{ opacity: 0.7 }}>
                              ({doc.chunks_count} chunks)
                            </span>
                          )}
                        </span>
                      )}
                      {doc.processed === false && doc.processing_error && (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          color: 'var(--color-danger)',
                          fontSize: '0.75rem',
                          fontWeight: 500
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
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          ⏳ Processing...
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
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

      {/* Test Search Modal */}
      {showTestModal && (
        <div className="modal" style={{ display: 'block' }}>
          <div className="modal-content" style={{ maxWidth: '800px', margin: '2rem auto' }}>
            <div className="modal-header">
              <h2>🧪 Test Similarity Search</h2>
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestQuery('');
                  setTestResults([]);
                }}
                className="btn btn-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="card">
                <div className="card-body">
                  <h3 style={{ marginBottom: "1rem" }}>Test Your Knowledge Base</h3>
                  <p style={{ marginBottom: "1rem" }} className="text-secondary">
                    Test how well your documents can answer specific queries using semantic search.
                  </p>
                  
                  {/* Quick Test Buttons */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <h4 style={{ marginBottom: "0.5rem" }}>Quick Tests:</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {[
                        "roof installation requirements",
                        "safety procedures",
                        "material specifications",
                        "quality control standards",
                        "ASTM standards",
                        "building codes"
                      ].map((query) => (
                        <button
                          key={query}
                          onClick={() => setTestQuery(query)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem' }}
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Query Input */}
                  <div style={{ marginBottom: "1rem" }}>
                    <label className="form-label">Custom Query:</label>
                    <input
                      type="text"
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      placeholder="Enter your test query here..."
                      className="form-control"
                      style={{ marginBottom: "0.5rem" }}
                      onKeyPress={(e) => e.key === 'Enter' && handleTestSearch()}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleTestSearch}
                        disabled={!testQuery.trim() || testing}
                        className="btn btn-primary"
                      >
                        {testing ? '⏳ Testing...' : '🔍 Test Query'}
                      </button>
                      <button
                        onClick={runDefaultTests}
                        disabled={testing}
                        className="btn btn-secondary"
                      >
                        {testing ? '⏳ Running...' : '🧪 Run Default Tests'}
                      </button>
                    </div>
                  </div>

                  {/* Test Results */}
                  {testResults.length > 0 && (
                    <div style={{ marginTop: "1.5rem" }}>
                      <h4 style={{ marginBottom: "1rem" }}>Test Results:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {testResults.map((result: any, index: number) => (
                          <div
                            key={index}
                            style={{
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                              padding: '1rem',
                              backgroundColor: 'var(--color-background)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                Result {index + 1}
                              </span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-lighter)' }}>
                                {(result.similarity * 100).toFixed(2)}% similar
                              </span>
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                              {result.content_chunk.substring(0, 300)}
                              {result.content_chunk.length > 300 && '...'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: 'var(--color-background-hover)', borderRadius: '6px' }}>
                    <h4 style={{ marginBottom: "0.5rem" }}>💡 How to Test:</h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                      <li>Click a quick test button or enter your own query</li>
                      <li>Check the browser console for detailed logs</li>
                      <li>Try technical terms from your documents</li>
                      <li>Use synonyms or related concepts</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestQuery('');
                  setTestResults([]);
                }}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 