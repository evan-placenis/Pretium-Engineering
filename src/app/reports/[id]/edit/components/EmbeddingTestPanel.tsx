import React, { useState } from 'react';
import { Project } from '@/lib/supabase';

interface EmbeddingTestPanelProps {
  project: Project | null;
  onClose: () => void;
}

export const EmbeddingTestPanel: React.FC<EmbeddingTestPanelProps> = ({ project, onClose }) => {
  const [testQuery, setTestQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTestSearch = async () => {
    if (!project?.id || !testQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    
    try {
      const response = await fetch('/api/search-project-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          query: testQuery,
          limit: 5
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results || []);
      console.log('Test search results:', data);
    } catch (error: any) {
      console.error('Test search failed:', error);
      setError(error.message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  if (!project) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '2rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        maxWidth: '600px',
        width: '90%'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3>No Project Available</h3>
          <p>Cannot test embeddings without a project context.</p>
          <button onClick={onClose} style={{
            padding: '0.5rem 1rem',
            background: '#0E2841',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '2rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1000,
      maxWidth: '800px',
      width: '90%',
      maxHeight: '80vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '1rem'
      }}>
        <h3 style={{ margin: 0 }}>Embedding Search Test</h3>
        <button onClick={onClose} style={{
          background: 'none',
          border: 'none',
          fontSize: '1.5rem',
          cursor: 'pointer',
          color: '#666'
        }}>
          ✕
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
          Project: <strong>{project.project_name}</strong>
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Enter search query (e.g., 'roofing requirements', 'foundation specs')"
            style={{
              flex: 1,
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '0.9rem'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTestSearch();
              }
            }}
          />
          <button
            onClick={handleTestSearch}
            disabled={isSearching || !testQuery.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              background: isSearching || !testQuery.trim() ? '#ccc' : '#0E2841',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSearching || !testQuery.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '0.75rem',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          Error: {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
            {isSearching ? (
              <p>Searching project knowledge...</p>
            ) : (
              <p>No results yet. Try searching for terms like "roofing", "foundation", or "building codes".</p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>
              Found {results.length} relevant results:
            </div>
            {results.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: '1rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  background: '#fafafa'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    {result.fileName}
                  </span>
                  <span style={{
                    fontSize: '0.8rem',
                    color: '#0E2841',
                    fontWeight: '600'
                  }}>
                    {(result.similarity * 100).toFixed(1)}% match
                  </span>
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  lineHeight: '1.4',
                  color: '#333',
                  whiteSpace: 'pre-wrap'
                }}>
                  {result.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 