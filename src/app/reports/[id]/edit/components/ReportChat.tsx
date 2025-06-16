import React, { useRef, useEffect, useState } from 'react';
import { useChatMessages } from '@/lib/chat-utils';
import { Project, Report, ReportImage } from '@/lib/supabase';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ReportChatProps {
  reportId: string;
  content: string | null;
  project: Project | null;
  report: Report | null;
  user: any;
  reportImages: ReportImage[];
}

export const ReportChat: React.FC<ReportChatProps> = ({
  reportId,
  content,
  project,
  report,
  user,
  reportImages
}) => {
  const {
    chatMessages,
    chatMessage,
    isSendingMessage,
    setChatMessage,
    sendChatMessage
  } = useChatMessages(reportId, content || '', project, report, user, reportImages);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isCentered, setIsCentered] = useState(false);

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
        background: '#f8f9fa'
      }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Chat Assistant</h3>
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        {chatMessages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
            <p style={{ fontSize: '1rem' }}>No messages yet. Start by asking a question about your report.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
              Examples:
              <br />
              "Make the introduction more detailed"
              <br />
              "Add a section about safety recommendations"
              <br />
              "Reformat the conclusion to be more concise"
            </p>
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
            {isSendingMessage && (
              <div style={{
                alignSelf: 'flex-start',
                background: '#f0f0f0',
                padding: '1rem',
                borderRadius: '12px',
                display: 'flex',
                gap: '0.5rem'
              }}>
                <span style={{ animation: 'typing-dot 1s infinite' }}>•</span>
                <span style={{ animation: 'typing-dot 1s infinite 0.2s' }}>•</span>
                <span style={{ animation: 'typing-dot 1s infinite 0.4s' }}>•</span>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{
        padding: '1.25rem',
        borderTop: '1px solid #e0e0e0',
        background: '#f8f9fa'
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
                sendChatMessage();
              }
            }}
            placeholder="Type your message..."
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
            onClick={sendChatMessage}
            disabled={isSendingMessage || !chatMessage.trim()}
            style={{
              padding: '0.75rem 1.25rem',
              background: isSendingMessage || !chatMessage.trim() ? '#ccc' : '#0E2841',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isSendingMessage || !chatMessage.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              height: '40px',
              whiteSpace: 'nowrap',
              fontWeight: '500'
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}; 