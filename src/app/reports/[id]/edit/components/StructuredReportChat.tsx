import React, { useEffect, useRef, useState } from 'react';
import { useStructuredChat } from '../hooks/useStructuredChat';
import { Project, Report } from '@/lib/supabase';
import { ReportImage } from '@/types/reportImage';
import { Section, Operation, OperationResult } from '../operations/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Add TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface StructuredReportChatProps {
  reportId: string;
  project: Project | null;
  report: Report | null;
  user: any;
  reportImages: ReportImage[];
  sections: Section[];
  undo: () => Promise<any>;
  redo: () => Promise<any>;
  canUndo: boolean;
  canRedo: boolean;
  onChatComplete: (updatedSections: Section[]) => void;
}

export function StructuredReportChat({
  reportId,
  project,
  report,
  user,
  reportImages,
  sections,
  undo,
  redo,
  canUndo,
  canRedo,
  onChatComplete,
}: StructuredReportChatProps) {
  const {
    chatMessages,
    chatMessage,
    isSendingMessage,
    isInitialized,
    setChatMessage,
    sendChatMessage,
    initializeChat,
    chatContainerRef,
    isLoadingHistory
  } = useStructuredChat(reportId, sections, project, report, user, onChatComplete);

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
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
      }
    }
  }, []);

  // Initialize chat when component mounts
  useEffect(() => {
    if (!isInitialized) {
      initializeChat();
    }
  }, [isInitialized, initializeChat]);

  // Update ref when chatMessage changes
  useEffect(() => {
    chatMessageRef.current = chatMessage;
  }, [chatMessage]);

  // Handle scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
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
      setInterimTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    await sendChatMessage();
    // No longer need to handle updatedSections here, as the state is managed by a different hook.
  };

  useEffect(() => {
    // Runs on mount
  }, []);

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
      {/* Chat Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e0e0e0',
        background: '#f8f9fa'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>AI Assistant</h3>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                console.log('Attempting undo with:', {
                  canUndo,
                });
                undo();
              }}
              disabled={!canUndo}
              style={{
                background: canUndo ? '#E53E3E' : '#718096',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem 1rem',
                color: 'white',
                cursor: canUndo ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 5C2 5 3.5 5 5 5C8.5 5 11 8 11 8M2 5L4 3M2 5L4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Undo
            </button>
            
            <button
              onClick={() => {
                console.log('Attempting redo with:', {
                  canRedo,
                });
                redo();
              }}
              disabled={!canRedo}
              style={{
                background: canRedo ? '#4CAF50' : '#718096',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem 1rem',
                color: 'white',
                cursor: canRedo ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: 'scaleX(-1)' }}>
                <path d="M2 5C2 5 3.5 5 5 5C8.5 5 11 8 11 8M2 5L4 3M2 5L4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Redo
            </button>
          </div>
        </div>

      </div>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {chatMessages.length === 0 && !isLoadingHistory ? (
          <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
            {!isInitialized ? (
              <div>
                <p style={{ fontSize: '1rem' }}>Initializing AI assistant...</p>
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
                <p style={{ fontSize: '1rem' }}>AI assistant ready! Start by asking a question about your report.</p>
                <p style={{ fontSize: '0.9rem', marginTop: '1rem' }}>
                  Examples:
                  <br />
                  "Make the introduction more detailed"
                  <br />
                  "Add a section about safety recommendations"
                  <br />
                  "Improve the conclusion paragraph"
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {chatMessages.map((msg, index) => (
              <div
                key={msg.id || index}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.role === 'user' ? '#0E2841' : '#f0f0f0',
                  color: msg.role === 'user' ? 'white' : 'black',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  wordBreak: 'break-word',
                  lineHeight: '1.5',
                  minWidth: '220px',
                }}
              >
                {React.createElement(
                  ReactMarkdown as any,
                  {
                    remarkPlugins: [remarkGfm],
                    rehypePlugins: [rehypeKatex],
                    components: {},
                    children: msg.content
                  }
                )}
              </div>
            ))}
            {isSendingMessage && (
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
                  Thinking...
                </span>
              </div>
            )}
            {isLoadingHistory && chatMessages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
                    <p style={{ fontSize: '1rem' }}>Loading chat history...</p>
                </div>
            )}
          </>
        )}
      </div>

      {/* Chat Input */}
      <div style={{
        padding: '1.25rem',
        borderTop: '1px solid #e0e0e0',
        background: '#f8f9fa',
        position: 'relative'
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
                handleSendMessage();
              }
            }}
            placeholder={!isInitialized ? 'Initializing AI assistant...' : 'Type your message...'}
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
              disabled={isSendingMessage || !isInitialized}
              style={{
                padding: '0.75rem',
                background: isListening ? '#ff4444' : (isSendingMessage || !isInitialized ? '#ccc' : '#0E2841'),
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isSendingMessage || !isInitialized ? 'not-allowed' : 'pointer',
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
      </div>
    </div>
  );
}
