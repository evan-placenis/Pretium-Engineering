import React, { useRef } from 'react';

interface ReportEditorProps {
  content: string | null;
  setContent: (content: string) => void;
  isStreaming: boolean;
  streamingStatus: string;
  processedContent: string;
  error: string | null;
}

export const ReportEditor: React.FC<ReportEditorProps> = ({
  content,
  setContent,
  isStreaming,
  streamingStatus,
  processedContent,
  error
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div style={{ 
      flex: 1, 
      background: 'white',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      minHeight: 'calc(100vh - 200px)'
    }}>
      {error && (
        <div style={{ 
          padding: '0.5rem', 
          marginBottom: '1rem', 
          background: '#f8d7da', 
          color: '#721c24', 
          borderRadius: '0.25rem' 
        }}>
          {error}
        </div>
      )}
      
      <div style={{
        maxWidth: '11in',
        minHeight: '11in',
        height: 'auto',
        margin: '0 auto 2rem auto',
        padding: '1in',
        background: 'white',
        position: 'relative'
      }} className="word-document-page">
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Display processed content with images */}
          <div 
            style={{
              width: '100%',
              minHeight: '800px',
              fontFamily: 'Times New Roman, serif',
              fontSize: '12pt',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              color: '#333',
              textAlign: 'left',
              opacity: isStreaming && !content ? 0.3 : 1
            }}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
          
          {/* Loading Overlay for Streaming */}
          {isStreaming && !content && (
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 5,
              minHeight: "400px"
            }}>
              <div style={{
                width: "60px",
                height: "60px",
                border: "5px solid #f3f3f3",
                borderTop: "5px solid #2b579a",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                marginBottom: "1rem"
              }} />
              <p style={{ fontSize: "1.125rem", fontWeight: 500, marginBottom: "0.5rem" }}>
                Generating Your Report
              </p>
              <p style={{ color: "#666", maxWidth: "400px", textAlign: "center", fontSize: "0.875rem" }}>
                {streamingStatus || 'Initializing AI generation...'}
              </p>
              <p style={{ color: "#888", fontSize: "0.75rem", marginTop: "1rem", textAlign: "center" }}>
                This may take 2-3 minutes. Content will appear as sections are completed.
              </p>
            </div>
          )}
          
          {/* Hidden textarea for editing */}
          <textarea
            ref={textareaRef}
            value={content || ''}
            onChange={(e) => {
              if (!isStreaming) {
                setContent(e.target.value);
                // Auto-expand immediately on input
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }
            }}
            disabled={isStreaming}
            className="word-editor-textarea"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              minHeight: '800px',
              height: 'auto',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'Times New Roman, serif',
              fontSize: '12pt',
              lineHeight: '1.6',
              padding: '0',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              overflow: 'hidden',
              color: 'transparent',
              background: 'transparent',
              zIndex: 2,
              cursor: isStreaming ? 'wait' : 'text'
            }}
          />
        </div>
      </div>
    </div>
  );
}; 