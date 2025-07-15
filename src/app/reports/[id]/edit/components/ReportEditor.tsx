import React, { useRef, useState, useEffect } from 'react';
import { PreviewWithControls } from './PreviewWithControls';

interface ReportEditorProps {
  content: string | null;
  setContent: (content: string) => void;
  isStreaming: boolean;
  streamingStatus: string;
  processedContent: string;
  error: string | null;
  showChat?: boolean;
}


export const ReportEditor: React.FC<ReportEditorProps> = ({
  content,
  setContent,
  isStreaming,
  streamingStatus,
  processedContent,
  error,
  showChat = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editMode, setEditMode] = useState<'preview' | 'edit' | 'split'>('preview');
  const [isCentered, setIsCentered] = useState(false);
  const [showSplitClosedAlert, setShowSplitClosedAlert] = useState(false);

  // Handle scroll position for centering
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      // Start transitioning after 100px of scroll
      setIsCentered(scrollPosition > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-switch to preview mode when chat is shown in split view
  useEffect(() => {
    if (showChat && editMode === 'split') {
      setEditMode('preview');
      setShowSplitClosedAlert(true);
      // Auto-hide alert after 4 seconds
      setTimeout(() => {
        setShowSplitClosedAlert(false);
      }, 4000);
    }
  }, [showChat, editMode]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && editMode !== 'preview') {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(800, textareaRef.current.scrollHeight)}px`;
    }
  }, [content, editMode]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isStreaming) {
      setContent(e.target.value);
    }
  };

  const handleImagePlus = (imageId: number, groupName: string) => {
    console.log('Plus clicked for image:', imageId, 'group:', groupName);
    // Placeholder for plus button functionality
  };

  const handleImageMinus = (imageId: number, groupName: string) => {
    console.log('Minus clicked for image:', imageId, 'group:', groupName);
    // Placeholder for minus button functionality
  };

  const renderEditMode = () => {
    switch (editMode) {
      case 'edit':
        return (
          <div style={{
            width: '65%',
            height: 'auto',
            margin: '0 auto 2rem auto',
            padding: '1in',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#666',
              marginBottom: '1rem',
              padding: '0.5rem',
              background: '#f8f9fa',
              borderRadius: '4px'
            }}>
              <strong>Edit Mode:</strong> Edit the raw content. Use [IMAGE:1:group] tags to reference images.
            </div>
            <textarea
              ref={textareaRef}
              value={content || ''}
              onChange={handleContentChange}
              disabled={isStreaming}
              style={{
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
                color: '#333',
                background: 'transparent',
                cursor: isStreaming ? 'wait' : 'text'
              }}
              placeholder="Enter your report content here..."
            />
          </div>
        );
      
      case 'split':
        return (
          <div style={{ position: 'relative', width: '100%' }}>
            {/* Editable Raw Text Panel - Fixed Position */}
            <div style={{
              position: 'fixed',
              left: '5rem',
              top: isCentered ? '45%' : '20rem',
              width: 'calc(50% - 4rem)',
              height: isCentered ? 'calc(90vh)' : 'calc(100vh - 20rem)',
              background: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '1rem',
              transform: isCentered ? 'translateY(-40%)' : 'none',
              transition: 'top 0.3s ease-out, transform 0.3s ease-out, height 0.3s ease-out'
            }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#666',
                marginBottom: '0.5rem',
                padding: '0.5rem',
                background: '#f8f9fa',
                borderRadius: '2px',
                flexShrink: 0
              }}>
                <strong>Edit Raw Text:</strong> Edit the raw content with [IMAGE:1:group] tags.
              </div>
              <textarea
                ref={textareaRef}
                value={content || ''}
                onChange={handleContentChange}
                disabled={isStreaming}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '11pt',
                  lineHeight: '1.4',
                  padding: '0',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'break-word',
                  color: '#333',
                  background: 'transparent',
                  cursor: isStreaming ? 'wait' : 'text',
                  overflowY: 'auto'
                }}
                placeholder="Enter your report content here..."
              />
            </div>
            
            {/* Preview Panel - Normal Page Scroll */}
            <div style={{
              marginLeft: '50%',
              width: '50%',
              minHeight: '100vh',
              background: 'white',
              padding: '0.5in'
            }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#666',
                marginBottom: '1rem',
                padding: '0.5rem',
                background: '#f8f9fa',
                borderRadius: '4px'
              }}>
                <strong>Preview:</strong> How your content will appear in the final document.
              </div>
              <div style={{ opacity: isStreaming && !content ? 0.3 : 1 }}>
                <PreviewWithControls
                  htmlContent={processedContent}
                  onImagePlus={handleImagePlus}
                  onImageMinus={handleImageMinus}
                />
              </div>
            </div>
          </div>
        );
      
      default: // preview mode
        return (
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
                  opacity: isStreaming && !content ? 0.3 : 1,
                }}
              >
                <PreviewWithControls
                  htmlContent={processedContent}
                  onImagePlus={handleImagePlus}
                  onImageMinus={handleImageMinus}
                />
              </div>
              
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
            </div>
          </div>
        );
    }
  };

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

      {showSplitClosedAlert && (
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          background: '#d1ecf1',
          color: '#0c5460',
          borderRadius: '0.25rem',
          border: '1px solid #bee5eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Split view was closed to make room for the chat panel. You can reopen split view after closing the chat.</span>
          <button
            onClick={() => setShowSplitClosedAlert(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0c5460',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.5rem'
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Edit Mode Toggle */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '0.5rem',
        background: '#f8f9fa',
        borderRadius: '4px',
        marginBottom: '1rem',
        border: '1px solid #dee2e6'
      }}>
        <button
          onClick={() => setEditMode('preview')}
          style={{
            background: editMode === 'preview' ? '#007bff' : '#e9ecef',
            color: editMode === 'preview' ? 'white' : '#495057',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: editMode === 'preview' ? '600' : '400'
          }}
        >
          Preview
        </button>
        <button
          onClick={() => setEditMode('edit')}
          style={{
            background: editMode === 'edit' ? '#007bff' : '#e9ecef',
            color: editMode === 'edit' ? 'white' : '#495057',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: editMode === 'edit' ? '600' : '400'
          }}
        >
          Edit Raw Text
        </button>
        <button
          onClick={() => setEditMode('split')}
          style={{
            background: editMode === 'split' ? '#007bff' : '#e9ecef',
            color: editMode === 'split' ? 'white' : '#495057',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: editMode === 'split' ? '600' : '400'
          }}
        >
          Split View
        </button>
      </div>
      
      {renderEditMode()}
    </div>
  );
}; 