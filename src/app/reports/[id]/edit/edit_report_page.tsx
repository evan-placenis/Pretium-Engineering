'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, Project, Report, ChatMessage, ReportImage } from '@/lib/supabase';
import { createWordDocumentWithImages} from '@/lib/word-utils';
import { useChatMessages } from '@/lib/chat-utils';

/**
 * Process content to create mixed layout: full-width for text without images, 2-column for sections with images
 * Each image is placed directly beside the paragraph that references it
 */
const processContentWithImages = (rawContent: string, images: ReportImage[]): string => {
  if (images.length === 0) {
    return `<div style="white-space: pre-wrap; line-height: 1.6;">${rawContent}</div>`;
  }

  // Split content into paragraphs and process each one
  const paragraphs = rawContent.split(/\n\s*\n/);
  
  return paragraphs.map(paragraph => {
    const imageMatches = paragraph.match(/\[IMAGE:(\d+)\]/g);
    
    if (!imageMatches) {
      // Full-width paragraph with no images
      return `<div style="white-space: pre-wrap; line-height: 1.6; margin-bottom: 1.5rem;">${paragraph}</div>`;
    }
    
    // Process paragraph with images - create one row per image reference
    const imageNumbers = imageMatches.map(match => {
      return parseInt(match.match(/\d+/)?.[0] || '0');
    });
    
    // For paragraphs with multiple images, we'll show the text with each image separately
    if (imageNumbers.length === 1) {
      // Single image case - simple two column layout
      const imageNum = imageNumbers[0];
      const img = images[imageNum - 1];
      const cleanedText = paragraph.replace(/\s*\[IMAGE:\d+\]/g, '');
      
      if (!img) {
        return `<div style="white-space: pre-wrap; line-height: 1.6; margin-bottom: 1.5rem;">${cleanedText}</div>`;
      }
      
      return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start; margin-bottom: 2rem;">
          <div style="white-space: pre-wrap; line-height: 1.6;">
            ${cleanedText}
          </div>
          <div style="text-align: center;">
            <img src="${img.url}" alt="${img.description || 'Report image'}" 
                 style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.5rem;" />
            <p style="font-size: 0.75rem; color: #666; margin: 0; font-style: italic; text-align: left;">
              <strong>Photo ${imageNum}:</strong> ${img.description || 'No description available'}
            </p>
          </div>
        </div>
      `;
    } else {
      // Multiple images case - stack them more compactly
      const cleanedText = paragraph.replace(/\s*\[IMAGE:\d+\]/g, '');
      const validImages = imageNumbers
        .map(num => ({ num, img: images[num - 1] }))
        .filter(({ img }) => img);
      
      if (validImages.length === 0) {
        return `<div style="white-space: pre-wrap; line-height: 1.6; margin-bottom: 1.5rem;">${cleanedText}</div>`;
      }
      
      return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start; margin-bottom: 2rem;">
          <div style="white-space: pre-wrap; line-height: 1.6;">
            ${cleanedText}
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${validImages.map(({ num, img }) => `
              <div style="text-align: center;">
                <img src="${img.url}" alt="${img.description || 'Report image'}" 
                     style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.3rem;" />
                <p style="font-size: 0.7rem; color: #666; margin: 0; font-style: italic; text-align: left;">
                  <strong>Photo ${num}:</strong> ${img.description || 'No description available'}
                </p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }).join('');
};

export default function ReportEditor() {
  const [report, setReport] = useState<Report | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [content, setContent] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [reportImages, setReportImages] = useState<ReportImage[]>([]);
  const [processedContent, setProcessedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [streamingSections, setStreamingSections] = useState<string[]>([]);
  const [combinedDraft, setCombinedDraft] = useState('');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const reportId = params.id as string;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Use the chat hook
  const {
    chatMessages,
    chatMessage,
    isSendingMessage,
    setChatMessage,
    sendChatMessage: originalSendChatMessage,
    chatContainerRef
  } = useChatMessages(reportId, content, project, report, user, reportImages);

  // Enhanced send chat message that handles content updates
  const sendChatMessage = async () => {
    const updatedContent = await originalSendChatMessage();
    if (updatedContent) {
      // Update the report content if the AI provided changes
      setContent(updatedContent);
      console.log('Updated report content from chat response');
    }
  };


  // Add global style for better text wrapping and animations
  useEffect(() => {
    // Add a class to the document body for better styling
    document.body.classList.add('word-editor-page');
    
    // Add CSS animation for typing dots and streaming indicator
    const style = document.createElement('style');
    style.textContent = `
      @keyframes typing-dot {
        0%, 60%, 100% {
          opacity: 0.3;
          transform: scale(0.8);
        }
        30% {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes pulse {
        0% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.5;
          transform: scale(1.2);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      // Clean up when component unmounts
      document.body.classList.remove('word-editor-page');
      document.head.removeChild(style);
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

  // Check if user is authenticated and handle streaming
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
        setReportTitle(reportData.title || '');
        setDeliveredAt(reportData.delivered_at || '');

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

        // Check if we should start streaming
        const isStreamingMode = searchParams.get('streaming') === 'true';
        const modelUsed = searchParams.get('model');
        
        if (isStreamingMode) {
          console.log('Starting streaming mode for report:', reportId);
          startStreaming(reportId, modelUsed);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(error.message);
      }
    };

    checkAuth();
    fetchData();

    // Cleanup streaming connection on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [reportId, router, searchParams]);

  // Start streaming connection
  const startStreaming = (reportId: string, model: string | null) => {
    setIsStreaming(true);
    setStreamingStatus('Connecting to AI model...');
    setStreamingSections([]);
    setCombinedDraft('');

    // EventSource doesn't support POST, so we need to trigger the stream differently
    // The streaming should already be started from the new report page
    // Here we just need to listen for database updates and show progress
    pollForUpdates(reportId);
  };

    // Poll for database updates during streaming
  const pollForUpdates = async (reportId: string) => {
    let pollCount = 0;
    const maxPolls = 180; // 3 minutes max
    
    console.log('Starting polling for report:', reportId);
    
    const pollInterval = setInterval(async () => {
      try {
        pollCount++;
        console.log(`Polling attempt ${pollCount}/${maxPolls} for report ${reportId}`);
        
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          setIsStreaming(false);
          setStreamingStatus('Generation timeout - please refresh and try again');
          setError('Report generation timed out');
          return;
        }

        // Test database connection first
        console.log('Testing database connection...');
        const { data: testData, error: testError } = await supabase
          .from('reports')
          .select('id')
          .limit(1);
          
        if (testError) {
          console.error('Database connection test failed:', testError);
          console.error('Error details:', {
            code: testError.code,
            message: testError.message,
            details: testError.details,
            hint: testError.hint
          });
          return;
        }
        console.log('Database connection test successful');

        // Fetch the current report content
        console.log('Fetching report content from database...');
        const { data: reportData, error } = await supabase
          .from('reports')
          .select('generated_content, updated_at')
          .eq('id', reportId)
          .single();

        if (error) {
          console.error('Error polling for updates:', error);
          console.error('Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          return;
        }

        console.log('Database response:', {
          hasData: !!reportData,
          contentLength: reportData?.generated_content?.length || 0,
          updatedAt: reportData?.updated_at
        });

        if (reportData?.generated_content) {
          const currentContent = reportData.generated_content;
          console.log('Poll result - content length:', currentContent.length, 'has processing marker:', currentContent.includes('[PROCESSING IN PROGRESS...]'));
          
          // Update content regardless (even if still processing)
          setContent(currentContent);
          
          // Check if generation is complete (no longer has "PROCESSING IN PROGRESS")
          if (!currentContent.includes('[PROCESSING IN PROGRESS...]')) {
            // Generation is complete
            console.log('Generation complete - stopping polling');
            setIsStreaming(false);
            setStreamingStatus('Report generation complete!');
            clearInterval(pollInterval);
            
            // Clear URL parameters
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('streaming');
            newUrl.searchParams.delete('model');
            window.history.replaceState({}, '', newUrl.toString());
            
            setTimeout(() => {
              setStreamingStatus('');
            }, 3000);
          } else {
            // Still processing, update status based on content
            if (currentContent.includes('Starting report generation')) {
              setStreamingStatus('Initializing generation...');
            } else if (currentContent.includes('Images resized')) {
              setStreamingStatus('Images processed, generating content...');
            } else if (currentContent.includes('Processing batch')) {
              const batchMatch = currentContent.match(/Processing batch (\d+)\/(\d+)/);
              if (batchMatch) {
                setStreamingStatus(`Processing batch ${batchMatch[1]} of ${batchMatch[2]}...`);
              } else {
                setStreamingStatus('Generating report sections...');
              }
            } else if (currentContent.includes('Starting final review')) {
              setStreamingStatus('Reviewing and polishing report...');
            } else {
              setStreamingStatus('Generating report content...');
            }
          }
        } else {
          console.log('No content yet in database');
          setStreamingStatus('Waiting for generation to start...');
        }
      } catch (error) {
        console.error('Error during polling:', error);
      }
    }, 2000); // Poll every 2 seconds

    // Store interval reference for cleanup
    eventSourceRef.current = { close: () => clearInterval(pollInterval) } as any;
  };

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
          title: reportTitle.trim() || null,
          delivered_at: deliveredAt || null,
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
              disabled={isSaving || isStreaming}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'white', 
                cursor: 'pointer',
                opacity: (isSaving || isStreaming) ? 0.7 : 1
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            {saveStatus && <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>{saveStatus}</span>}
          </div>
          {isStreaming && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#4CAF50',
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
              <span style={{ fontSize: '0.875rem' }}>{streamingStatus}</span>
            </div>
          )}
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

      {/* Report Details Section */}
      <div style={{ 
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        padding: '1rem',
        display: 'flex',
        gap: '2rem',
        alignItems: 'center',
        maxWidth: "1200px", 
        width: "100%", 
        margin: "0 auto"
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            marginBottom: '0.25rem',
            color: '#374151'
          }}>
            Report Title
          </label>
          <input
            type="text"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Enter report title..."
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.25rem',
              backgroundColor: 'white'
            }}
            disabled={isStreaming}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            marginBottom: '0.25rem',
            color: '#374151'
          }}>
            Delivered Date
          </label>
          <input
            type="date"
            value={deliveredAt ? deliveredAt.split('T')[0] : ''}
            onChange={(e) => setDeliveredAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.25rem',
              backgroundColor: 'white'
            }}
            disabled={isStreaming}
          />
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
                value={content}
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
                <>
                  {chatMessages.map((msg, index) => (
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
                  ))}
                  
                  {/* AI thinking animation */}
                  {isSendingMessage && (
                    <div 
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        maxWidth: '85%',
                        alignSelf: 'flex-start',
                        background: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <div 
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#666',
                            animation: 'typing-dot 1.4s infinite ease-in-out',
                            animationDelay: '0s'
                          }}
                        />
                        <div 
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#666',
                            animation: 'typing-dot 1.4s infinite ease-in-out',
                            animationDelay: '0.2s'
                          }}
                        />
                        <div 
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#666',
                            animation: 'typing-dot 1.4s infinite ease-in-out',
                            animationDelay: '0.4s'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.875rem', color: '#666', fontStyle: 'italic' }}>
                        AI is thinking...
                      </span>
                    </div>
                  )}
                </>
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


