'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, Project, Report, ChatMessage, ReportImage } from '@/lib/supabase';
import { createWordDocumentWithImages} from '@/lib/word-utils';
import { useChatMessages } from '@/lib/chat-utils';

/**
 * Process content and replace [IMAGE:X] placeholders with HTML for display
 */
const processContentWithImages = (rawContent: string, images: ReportImage[]): string => {
  let processed = rawContent;
  
  // Replace [IMAGE:X] placeholders with two-column layout
  images.forEach((img, index) => {
    const placeholder = `[IMAGE:${index + 1}]`;
    
    // Find the placeholder and the text around it
    const placeholderRegex = new RegExp(`([^\\n]*?)\\s*\\[IMAGE:${index + 1}\\]`, 'g');
    
    const imageHtml = `
<div style="display: flex; margin: 0.25rem 0; gap: 1rem; align-items: flex-start;">
  <div style="flex: 1; padding-right: 1rem;">
    $1
  </div>
  <div style="flex: 1; text-align: center;">
    <img src="${img.url}" alt="${img.description || 'Report image'}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
    <p style="font-size: 0.75rem; color: #666; margin: 0; font-style: italic;">
      Photo ${index + 1}: ${img.description || 'No description available'}
    </p>
  </div>
</div>`;
    
    // Replace the pattern with the two-column layout
    processed = processed.replace(placeholderRegex, imageHtml);
    
    // Also handle case where placeholder is on its own line
    const standaloneRegex = new RegExp(`\\[IMAGE:${index + 1}\\]`, 'g');
    const standaloneImageHtml = `
<div style="display: flex; margin: 0.25rem 0; gap: 1rem; align-items: flex-start;">
  <div style="flex: 1;">
    <!-- Text content appears here -->
  </div>
  <div style="flex: 1; text-align: center;">
    <img src="${img.url}" alt="${img.description || 'Report image'}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.25rem;" />
    <p style="font-size: 0.75rem; color: #666; margin: 0; font-style: italic;">
      Photo ${index + 1}: ${img.description || 'No description available'}
    </p>
  </div>
</div>`;
    
    processed = processed.replace(standaloneRegex, standaloneImageHtml);
  });
  
  return processed;
};

export default function ReportEditor() {
  const [report, setReport] = useState<Report | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [content, setContent] = useState('');
  const [reportImages, setReportImages] = useState<ReportImage[]>([]);
  const [processedContent, setProcessedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use the chat hook
  const {
    chatMessages,
    chatMessage,
    isSendingMessage,
    setChatMessage,
    sendChatMessage: originalSendChatMessage,
    chatContainerRef
  } = useChatMessages(reportId, content, project, report, user);


  // Add global style for better text wrapping
  useEffect(() => {
    // Add a class to the document body for better styling
    document.body.classList.add('word-editor-page');
    
    return () => {
      // Clean up when component unmounts
      document.body.classList.remove('word-editor-page');
    };
  }, []);

  // Process content when report images or content changes
  useEffect(() => {
    if (content && reportImages.length > 0) {
      const processed = processContentWithImages(content, reportImages);
      setProcessedContent(processed);
    } else {
      setProcessedContent(content);
    }
  }, [content, reportImages]);

  // Check if user is authenticated
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

        // Fetch report images
        const { data: imagesData, error: imagesError } = await supabase
          .from('report_images')
          .select('*')
          .eq('report_id', reportId);

        if (imagesError) {
          console.error('Error fetching report images:', imagesError);
        } else {
          setReportImages(imagesData || []);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(error.message);
      }
    };

    checkAuth();
    fetchData();
  }, [reportId, router]);

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
                  const filename = `${project?.project_name || 'Report'}_${new Date().toISOString().split('T')[0]}.docx`;
                  
                  // Use the new Word document function with actual images
                  await createWordDocumentWithImages(content, reportImages, filename, project);
                  
                  setDownloadStatus('Downloaded!');
                  // Clear status after delay
                  setTimeout(() => {
                    setDownloadStatus('');
                  }, 3000);
                } catch (error) {
                  console.error('Error generating Word document:', error);
                  setDownloadStatus('Error downloading');
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
                  textAlign: 'left'
                }}
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />
              
              {/* Hidden textarea for editing */}
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
                  zIndex: 2
                }}
              />
              
    
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
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey} //&& sendChatMessage()}
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
                //onClick={sendChatMessage}
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


