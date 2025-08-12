import React, { useRef, useEffect, useState } from 'react';
import { useChatMessages } from '@/app/reports/[id]/edit/archive_old_chat/chat-utils';
import { Project, Report, ReportImage } from '@/lib/supabase';

// Add TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

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
  
  // Voice-to-text functionality
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const chatMessageRef = useRef<string>('');

  // Check if speech recognition is supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSpeechSupported(!!SpeechRecognition);
      
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          if (finalTranscript) {
            const currentMessage = chatMessageRef.current;
            setChatMessage(currentMessage + (currentMessage ? ' ' : '') + finalTranscript);
            setInterimTranscript('');
          } else if (interimTranscript) {
            setInterimTranscript(interimTranscript);
          }
        };
        
        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
        
        recognitionRef.current.onend = () => {
          // Only stop listening if user manually stopped it
          // Don't automatically stop for continuous mode
        };
      }
    }
  }, []);

  const toggleListening = () => {
    if (!isSpeechSupported || !recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      // Clear any existing interim transcript when starting
      setInterimTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

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

  // Update ref when chatMessage changes
  useEffect(() => {
    chatMessageRef.current = chatMessage;
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
        {/* Interim Transcript Display */}
        {isListening && interimTranscript && (
          <div style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            background: '#f0f8ff',
            border: '1px solid #b3d9ff',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#0066cc',
            fontStyle: 'italic'
          }}>
            🎤 <strong>Listening:</strong> {interimTranscript}
          </div>
        )}
        
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
          
          {/* Microphone Button */}
          {isSpeechSupported && (
            <button
              onClick={toggleListening}
              disabled={isSendingMessage}
              style={{
                padding: '0.75rem',
                background: isListening ? '#ff4444' : (isSendingMessage ? '#ccc' : '#0E2841'),
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isSendingMessage ? 'not-allowed' : 'pointer',
                fontSize: '1.2rem',
                height: '40px',
                width: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              title={isListening ? 'Stop recording' : 'Start voice input'}
            >
              {isListening ? (
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'white',
                  transform: 'scale(1.2)',
                  transition: 'transform 0.3s ease'
                }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
            </button>
          )}
          
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