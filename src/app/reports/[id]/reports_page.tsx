'use client';
//page to view individal report
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Project, Report, ChatMessage } from '@/lib/supabase';

interface ReportViewProps {
  id: string;
}

export default function ReportView({ id }: ReportViewProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [images, setImages] = useState<{ url: string; description: string }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReportAndProject = async () => {
      if (!id) {
        console.error('No report ID provided');
        setError('Invalid report ID');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      // Fetch report
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*, projects(*)')
        .eq('id', id)
        .single();
      
      if (reportError) {
        console.error('Error fetching report:', reportError);
        setError('Failed to load report. Please try again.');
        setLoading(false);
        return;
      }

      if (!reportData) {
        console.error('No report data found for ID:', id);
        setError('Report not found');
        setLoading(false);
        return;
      }
      
      setReport(reportData);
      if (reportData.projects) {
        setProject(reportData.projects);
      }
      
      // Fetch report images
      const { data: imagesData } = await supabase
        .from('report_images')
        .select('url, description')
        .eq('report_id', id);

      if (imagesData) {
        console.log('Raw image data:', imagesData);
        // Get the signed URLs for the images
        const imagesWithUrls = await Promise.all(
          imagesData.map(async (image) => {
            // Generate a signed URL that's valid for 8 hours
            const { data, error } = await supabase.storage
              .from('reports-images')
              .createSignedUrl(image.url, 60 * 60 * 8); // 8 hours in seconds

            if (error) {
              console.error('Error generating signed URL:', error);
              return image;
            }

            console.log('Generated signed URL:', data.signedUrl);
            return {
              ...image,
              url: data.signedUrl
            };
          })
        );
        console.log('Final images with URLs:', imagesWithUrls);
        setImages(imagesWithUrls);
      }
      
      // Fetch chat messages
      await fetchMessages();
      setLoading(false);
    };

    fetchReportAndProject();
  }, [id]);

  const fetchMessages = async () => {
    const { data: messagesData, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('report_id', id)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    } else {
      setMessages(messagesData || []);
    }
  };

  useEffect(() => {
    // Scroll to bottom when messages change
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !report) return;
    
    setSendingMessage(true);
    
    // Add user message to database
    const userMessage = {
      report_id: id,
      content: newMessage,
      role: 'user' as const,
    };
    
    try {
      // Insert user message
      const { error: userMessageError } = await supabase
        .from('chat_messages')
        .insert([userMessage]);
      
      if (userMessageError) throw userMessageError;
      
      // Clear input
      setNewMessage('');
      
      // Call OpenAI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId: id,
          message: newMessage,
          report: report,
          projectName: project?.name,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }
      
      const data = await response.json();
      
      // Insert AI response
      const aiMessage = {
        report_id: id,
        content: data.reply,
        role: 'assistant' as const,
      };
      
      const { error: aiMessageError } = await supabase
        .from('chat_messages')
        .insert([aiMessage]);
      
      if (aiMessageError) throw aiMessageError;
      
      // Refresh messages
      await fetchMessages();
    } catch (error: any) {
      console.error('Error in chat interaction:', error);
      setError(error.message || 'An error occurred during the chat interaction');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleExportWord = async () => {
    if (!report) return;
    
    try {
      const response = await fetch(`/api/export-word?reportId=${id}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export report to Word');
      }
      
      // Get the blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Report_${project?.name || 'Project'}_${new Date().toISOString().split('T')[0]}.docx`;
      
      // Append to the document and trigger the download
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error exporting to Word:', error);
      setError(error.message || 'An error occurred during export');
    }
  };

  const handleDeleteReport = async () => {
    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    setDeleteLoading(true);
    try {
      // Delete associated chat messages first
      const { error: chatError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('report_id', id);

      if (chatError) throw chatError;

      // Delete associated images from storage
      const { data: images } = await supabase
        .from('report_images')
        .select('url')
        .eq('report_id', id);

      if (images) {
        const deletePromises = images.map(image => 
          supabase.storage
            .from('reports-images')
            .remove([image.url])
        );
        await Promise.all(deletePromises);
      }

      // Delete image records
      const { error: imageError } = await supabase
        .from('report_images')
        .delete()
        .eq('report_id', id);

      if (imageError) throw imageError;

      // Finally, delete the report
      const { error: reportError } = await supabase
        .from('reports')
        .delete()
        .eq('id', id);

      if (reportError) throw reportError;

      // Redirect to project page
      if (project) {
        router.push(`/projects/${project.id}`);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      setError('Failed to delete report. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container loading-container">
        <p className="text-secondary">Loading report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container loading-container">
        <p className="text-secondary">Report not found</p>
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      <div className="container page-content">
        <header style={{ marginBottom: "2rem" }}>
          <div style={{ marginBottom: "0.5rem", display: "flex" }}>
            {project && (
              <Link
                href={`/projects/${project.id}`}
                className="text-accent"
                style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}
              >
                ← Back to Project
              </Link>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h1>
              Report for {project?.name || 'Project'}
            </h1>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleExportWord}
                className="btn btn-primary"
              >
                Export to Word
              </button>
              <Link
                href={`/reports/${id}/edit`}
                className="btn btn-secondary"
              >
                Edit Report
              </Link>
              <button
                onClick={handleDeleteReport}
                disabled={deleteLoading}
                className="btn btn-danger"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Report'}
              </button>
            </div>
          </div>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }} className="text-secondary">
            Created on {new Date(report.created_at).toLocaleString()}
          </p>
        </header>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.875rem" }}>{error}</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridGap: "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="card">
              <div className="card-body">
                <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: "600" }}>Generated Report</h2>
                <div className="prose" style={{ whiteSpace: "pre-wrap" }}>
                  {report.generated_content.split('\n').map((line, index) => {
                    if (line.startsWith('IMAGE:')) {
                      const imageUrl = line.replace('IMAGE:', '').trim();
                      const image = images.find(img => img.url === imageUrl);
                      console.log('Found image:', { imageUrl, image }); // Debug log
                      return (
                        <div key={index} style={{ margin: '1rem 0' }}>
                          <img 
                            src={imageUrl}
                            alt={image?.description || 'Report image'}
                            style={{ 
                              maxWidth: '100%', 
                              height: 'auto',
                              borderRadius: '0.5rem',
                              marginBottom: image?.description ? '0.5rem' : 0
                            }}
                            onError={(e) => {
                              console.error('Image failed to load:', imageUrl);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          {image?.description && (
                            <p style={{ 
                              fontSize: "0.875rem",
                              color: "var(--color-text-light)",
                              margin: 0
                            }}>
                              {image.description}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return <div key={index}>{line}</div>;
                  })}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: "600" }}>Original Bullet Points</h2>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {report.bullet_points}
                </div>
              </div>
            </div>

            {images.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: "600" }}>Report Images</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
                    {images.map((image, index) => (
                      <div key={index} className="image-container">
                        <img 
                          src={image.url} 
                          alt={image.description || `Report image ${index + 1}`}
                          style={{ 
                            width: '100%', 
                            height: '200px', 
                            objectFit: 'cover',
                            borderRadius: '0.5rem'
                          }}
                        />
                        {image.description && (
                          <p style={{ 
                            marginTop: "0.5rem", 
                            fontSize: "0.875rem",
                            color: "var(--color-text-light)"
                          }}>
                            {image.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 