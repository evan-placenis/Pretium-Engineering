'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, Project, Report, ChatMessage } from '@/lib/supabase';
import { textToSimpleWordDocument, generateWordDocument } from '@/lib/word-utils';

export default function ReportEditor() {
  const [report, setReport] = useState<Report | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Add global style for better text wrapping
  useEffect(() => {
    // Add a class to the document body for better styling
    document.body.classList.add('word-editor-page');
    
    return () => {
      // Clean up when component unmounts
      document.body.classList.remove('word-editor-page');
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    };

    const fetchData = async () => {
      if (!reportId) return;

      try {
        // Fetch report
        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (reportError) throw reportError;
        if (!reportData) throw new Error('Report not found');

        setReport(reportData);
        setContent(reportData.generated_content);

        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', reportData.project_id)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch chat messages
        const { data: chatData, error: chatError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('report_id', reportId)
          .order('created_at', { ascending: true });

        if (chatError) {
          console.error('Error fetching chat messages:', chatError);
        } else {
          setChatMessages(chatData || []);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(error.message);
      }
    };

    checkAuth();
    fetchData();

    // Set up real-time subscription for chat messages
    const chatSubscription = supabase
      .channel(`report-chat-${reportId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `report_id=eq.${reportId}`
      }, (payload) => {
        setChatMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatSubscription);
    };
  }, [reportId, router]);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Focus textarea and adjust height on initial load and when content changes
  useEffect(() => {
    const adjustAndShow = () => {
      if (textareaRef.current) {
        // Reset and adjust the height
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.max(800, textareaRef.current.scrollHeight)}px`;
        
        // Focus and then immediately blur to show all content without keeping focus
        textareaRef.current.focus();
        textareaRef.current.blur();
      }
    };

    // Wait for component to fully render
    const timer = setTimeout(adjustAndShow, 200);

    return () => clearTimeout(timer);
  }, [report, content]);

  const saveReport = async () => {
    if (!report) return;
    
    setIsSaving(true);
    setSaveStatus('Saving...');
    
    try {
      const { error } = await supabase
        .from('reports')
        .update({ 
          generated_content: content,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);
      
      if (error) throw error;
      setSaveStatus('Saved');
      
      // Reset save status after 3 seconds
      setTimeout(() => {
        setSaveStatus('');
      }, 3000);
    } catch (error: any) {
      console.error('Error saving report:', error);
      setSaveStatus('Failed to save');
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !user || !reportId) return;
    
    setIsSendingMessage(true);
    
    try {
      // Save user message
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          report_id: reportId,
          content: chatMessage,
          role: 'user'
        });
      
      if (userMsgError) throw userMsgError;
      
      // Clear input
      setChatMessage('');
      
      // Call API to get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          message: chatMessage,
          reportContent: content,
          projectName: project?.name,
          bulletPoints: report?.bullet_points
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get chat response');
      }
      
      const data = await response.json();
      
      // Save assistant message
      const { error: assistantMsgError } = await supabase
        .from('chat_messages')
        .insert({
          report_id: reportId,
          content: data.message,
          role: 'assistant'
        });
      
      if (assistantMsgError) throw assistantMsgError;
      
      // Update content if there's a suggestion
      if (data.updatedContent) {
        setContent(data.updatedContent);
        saveReport();
      }
    } catch (error: any) {
      console.error('Error in chat:', error);
      setError(error.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (!report || !project) {
    return (
      <div className="loading-container">
        <p className="text-secondary">Loading report...</p>
      </div>
    );
  }

  return (
    <div className="editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' , marginTop: "4rem"}}>
      {/* Top Navigation Bar with Word-like styling */}
      <div style={{
        background: '#2b579a',
        color: 'white',
        padding: '0.5rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: "1200px", width: "100%", margin: "0 auto", paddingLeft: "0.5rem", paddingRight: "0.5rem" }}>

          <div>
            <button onClick={() => router.push(`/projects/${project.id}`)} 
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              Back to Project
            </button>
          </div>
          <div>
            <button 
              onClick={saveReport}
              disabled={isSaving}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'white', 
                cursor: 'pointer',
                opacity: isSaving ? 0.7 : 1
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            {saveStatus && <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>{saveStatus}</span>}
          </div>
          <div style={{ marginLeft: '1rem' }}>
            <button 
              onClick={async () => {
                try {
                  setIsDownloading(true);
                  setDownloadStatus('Preparing document...');
                  
                  // Generate a filename
                  const filename = `${project?.name || 'Report'}_${new Date().toISOString().split('T')[0]}.docx`;
                  
                  // Generate and download the Word document
                  await textToSimpleWordDocument(content, filename);
                  
                  setDownloadStatus('Downloaded!');
                  // Clear status after delay
                  setTimeout(() => {
                    setDownloadStatus('');
                  }, 3000);
                } catch (error) {
                  console.error('Error generating Word document:', error);
                  setDownloadStatus('Error downloading');
                  
                  // Fallback to simple approach if the library fails
                  const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${project?.name || 'Report'}.docx`;
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }, 0);
                } finally {
                  setIsDownloading(false);
                }
              }}
              disabled={isDownloading}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'white', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                opacity: isDownloading ? 0.7 : 1
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {isDownloading ? 'Downloading...' : 'Download Word'}
            </button>
            {downloadStatus && <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>{downloadStatus}</span>}
          </div>


          
          
          
          <div style={{ marginLeft: 'auto' }}>
            <button 
              onClick={() => setShowChat(!showChat)}
              style={{ 
                background: 'transparent', 
                border: '1px solid white', 
                color: 'white', 
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                cursor: 'pointer'
              }}
            >
              {showChat ? 'Hide Chat' : 'Show Chat'}
            </button>
          </div>
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        maxWidth: "1200px", 
        width: "100%", 
        margin: "0 auto", 
        paddingLeft: "0.5rem", 
        paddingRight: "0.5rem",
        fontSize: '1.5rem',
        fontWeight: '600',
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
      }}>
        <div style={{ 
          flex: 1, 
          textAlign: 'center',
          paddingBottom: '0.25rem'
        }}>AI Output</div>
        <div style={{ 
          flex: 1, 
          textAlign: 'right',
          paddingBottom: '0.25rem'
        }}>AI Chat</div>
      </div>


      {/* Main content area */}
      <div style={{ 
        display: 'flex', 
        height: 'calc(100vh - 100px)',
        overflow: 'hidden',
        background: '#f5f5f5'
      }}>
        {/* Document editor */}
        <div className="word-editor-container" style={{ 
          flex: showChat ? '3' : '1',
          transition: 'flex 0.3s ease',
          background: '#f5f5f5'
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
            maxWidth: '8.5in', 
            minHeight: '11in',
            height: 'auto',
            margin: '0 auto 2rem auto',
            padding: '1in',
            background: 'white',
            position: 'relative'
          }} className="word-document-page">
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  // Auto-expand immediately on input
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                className="word-editor-textarea"
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
                  overflow: 'hidden',
                  color: '#333',
                  textAlign: 'left'
                }}
              />
              
              {/* Page break indicators - dynamically create based on content height */}
              <div style={{ position: 'absolute', left: '0', right: '0', top: '11in', height: '12px' }} className="word-page-breaks">
                Page 1 end - Page 2 start
              </div>
              <div style={{ position: 'absolute', left: '0', right: '0', top: '22in', height: '12px' }} className="word-page-breaks">
                Page 2 end - Page 3 start
              </div>
              <div style={{ position: 'absolute', left: '0', right: '0', top: '33in', height: '12px' }} className="word-page-breaks">
                Page 3 end - Page 4 start
              </div>
              <div style={{ position: 'absolute', left: '0', right: '0', top: '44in', height: '12px' }} className="word-page-breaks">
                Page 4 end - Page 5 start
              </div>
            </div>
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div style={{ 
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #e0e0e0',
            background: '#f9f9f9',
            height: '100%',
            maxWidth: '350px'
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>
              <h3 style={{ margin: 0 }}>Report Assistant</h3>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
                Ask questions or request changes to your report
              </p>
            </div>
            
            {/* Chat messages */}
            <div 
              ref={chatContainerRef}
              style={{ 
                flex: '1', 
                overflowY: 'auto',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#666', marginTop: '2rem' }}>
                  <p>No messages yet. Start by asking a question about your report.</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
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
                chatMessages.map((msg, index) => (
                  <div 
                    key={index}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      maxWidth: '85%',
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.role === 'user' ? '#dcf8c6' : '#f0f0f0',
                      wordBreak: 'break-word'
                    }}
                  >
                    {msg.content}
                  </div>
                ))
              )}
            </div>
            
            {/* Chat input */}
            <div style={{ 
              padding: '1rem', 
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '0.5rem'
            }}>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                placeholder="Ask a question or request changes..."
                style={{
                  flex: '1',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '1rem',
                  outline: 'none'
                }}
                disabled={isSendingMessage}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatMessage.trim() || isSendingMessage}
                style={{
                  background: '#2b579a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  opacity: !chatMessage.trim() || isSendingMessage ? 0.7 : 1
                }}
              >
                <svg width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 