import React, { useRef, useEffect, useState } from 'react';
import { useEnhancedChat, EmbeddingSearchResult } from '../hooks/useEnhancedChat';
import { Project, Report, ReportImage } from '@/lib/supabase';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface EnhancedReportChatProps {
  reportId: string;
  content: string | null;
  project: Project | null;
  report: Report | null;
  user: any;
  reportImages: ReportImage[];
  setContent: (content: string) => void;
}

const EmbeddingResultsPanel: React.FC<{
  results: EmbeddingSearchResult[];
  isVisible: boolean;
  onToggle: () => void;
  onSearch: (query: string) => void;
  isSearching: boolean;
}> = ({ results, isVisible, onToggle, onSearch, isSearching }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      right: 0,
      width: '400px',
      maxHeight: '500px',
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e0e0e0',
        background: '#f8f9fa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h4 style={{ margin: 0, fontSize: '1rem' }}>Project Knowledge</h4>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search project knowledge..."
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              style={{
                padding: '0.5rem 1rem',
                background: isSearching || !searchQuery.trim() ? '#ccc' : '#0E2841',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {isSearching ? '🔍' : 'Search'}
            </button>
          </div>
        </div>

        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              <p style={{ fontSize: '0.9rem' }}>No relevant knowledge found.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Try searching for specific terms like "roofing", "foundation", or "building codes".
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    color: '#333'
                  }}>
                    {result.content.length > 200 
                      ? `${result.content.substring(0, 200)}...`
                      : result.content
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const EnhancedReportChat: React.FC<EnhancedReportChatProps> = ({
  reportId,
  content,
  project,
  report,
  user,
  reportImages,
  setContent
}) => {
  const {
    chatMessages,
    chatMessage,
    isSendingMessage,
    isSearchingEmbeddings,
    embeddingResults,
    showEmbeddingResults,
    isInitialized,
    setChatMessage,
    sendChatMessage,
    searchEmbeddings,
    toggleEmbeddingResults,
    initializeChat,
    chatContainerRef
  } = useEnhancedChat(reportId, content || '', project, report, user, reportImages);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isCentered, setIsCentered] = useState(false);

  // Initialize chat when component loads
  useEffect(() => {
    if (project?.id && !isInitialized) {
      initializeChat();
    }
  }, [project?.id, isInitialized, initializeChat]);

  // Handle scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      // Start transitioning after 100px of scroll
      setIsCentered(scrollPosition > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [chatMessage]);

  // Handle sending chat message and updating content
  const handleSendMessage = async () => {
    const updatedContent = await sendChatMessage();
    if (updatedContent) {
      console.log('Updating report content with AI changes');
      setContent(updatedContent);
    }
  };

  return (
    <div style={{
      width: '500px',
      height: 'calc(100vh - 180px)',
      display: 'flex',
      flexDirection: 'column',
      background: 'white',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      overflow: 'hidden',
      position: 'fixed',
      right: '2rem',
      top: isCentered ? '50%' : '180px',
      transform: isCentered ? 'translateY(-45%)' : 'none',
      transition: 'top 0.3s ease-out, transform 0.3s ease-out',
      zIndex: 100
    }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e0e0e0',
        background: '#f8f9fa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Enhanced Chat Assistant</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={toggleEmbeddingResults}
            style={{
              padding: '0.5rem 0.75rem',
              background: showEmbeddingResults ? '#0E2841' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            📚 Knowledge
          </button>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }} ref={chatContainerRef}>
        {chatMessages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
            {!isInitialized ? (
              <div>
                <p style={{ fontSize: '1rem' }}>Initializing enhanced chat assistant...</p>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '0.5rem', 
                  marginTop: '1rem' 
                }}>
                  <span style={{ animation: 'typing-dot 1s infinite' }}>•</span>
                  <span style={{ animation: 'typing-dot 1s infinite 0.2s' }}>•</span>
                  <span style={{ animation: 'typing-dot 1s infinite 0.4s' }}>•</span>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '1rem' }}>Enhanced chat assistant ready! Start by asking a question about your report.</p>
                <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
                  Examples:
                  <br />
                  "Make the introduction more detailed"
                  <br />
                  "Add a section about safety recommendations"
                  <br />
                  "What building codes apply to this project?"
                  <br />
                  "Check specifications for roofing requirements"
                  <br />
                  "Summarize the current report sections"
                  <br />
                  "Improve the conclusion paragraph"
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {chatMessages.map((msg: ChatMessage, index: number) => (
              <div
                key={index}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.role === 'user' ? '#0E2841' : '#f0f0f0',
                  color: msg.role === 'user' ? 'white' : 'black',
                  padding: '1rem',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  wordBreak: 'break-word',
                  lineHeight: '1.5'
                }}
              >
                {msg.content}
              </div>
            ))}
            {(isSendingMessage || isSearchingEmbeddings) && (
              <div style={{
                alignSelf: 'flex-start',
                background: '#f0f0f0',
                padding: '1rem',
                borderRadius: '12px',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center'
              }}>
                <span style={{ animation: 'typing-dot 1s infinite' }}>•</span>
                <span style={{ animation: 'typing-dot 1s infinite 0.2s' }}>•</span>
                <span style={{ animation: 'typing-dot 1s infinite 0.4s' }}>•</span>
                <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                  {isSearchingEmbeddings ? 'Searching knowledge base...' : 'Thinking...'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{
        padding: '1.25rem',
        borderTop: '1px solid #e0e0e0',
        background: '#f8f9fa',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-end'
        }}>
          <textarea
            ref={textareaRef}
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={!isInitialized ? 'Initializing chat assistant...' : 'Type your message...'}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '8px',
              fontSize: '0.95rem',
              resize: 'none',
              minHeight: '40px',
              maxHeight: '150px',
              overflowY: 'auto',
              lineHeight: '1.5',
              fontFamily: 'inherit'
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={isSendingMessage || !chatMessage.trim() || !isInitialized}
            style={{
              padding: '0.75rem 1.25rem',
              background: isSendingMessage || !chatMessage.trim() || !isInitialized ? '#ccc' : '#0E2841',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isSendingMessage || !chatMessage.trim() || !isInitialized ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              height: '40px',
              whiteSpace: 'nowrap',
              fontWeight: '500'
            }}
          >
            {!isInitialized ? 'Initializing...' : isSendingMessage ? 'Sending...' : 'Send'}
          </button>
        </div>

        <EmbeddingResultsPanel
          results={embeddingResults}
          isVisible={showEmbeddingResults}
          onToggle={toggleEmbeddingResults}
          onSearch={searchEmbeddings}
          isSearching={isSearchingEmbeddings}
        />
      </div>
    </div>
  );
}; 