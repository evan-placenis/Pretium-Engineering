'use client';
//page to create a new report - fullscreen bullet points entry
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, Project } from '@/lib/supabase';
import Link from 'next/link';
import { Document, Packer, Paragraph, ImageRun, HeadingLevel, AlignmentType } from 'docx';

// Define available models and their corresponding API routes
const AVAILABLE_MODELS = [
  { id: 'advanced-streaming', name: 'Advanced Model (Streaming)', route: '/api/models/generate-report-advanced-stream', streamRoute: '/api/models/generate-report-advanced-stream', description: 'Real-time generation with live updates', supportsStreaming: true },
  { id: 'advanced', name: 'Advanced Model (Standard)', route: '/api/models/generate-report-advanced', description: 'Higher quality, slower processing', supportsStreaming: false },
  { id: 'lightweight', name: 'Lightweight Model', route: '/api/models/generate-report-lite', description: 'Faster processing, basic quality', supportsStreaming: false },
  { id: 'custom', name: 'Custom Fine-tuned', route: '/api/models/generate-report-custom', description: 'Your fine-tuned model', supportsStreaming: false },
  { id: 'standard', name: 'Standard Model', route: '/api/generate-report-simple', description: 'Balanced performance and speed', supportsStreaming: false },
];

export default function NewReport() {
  const [project, setProject] = useState<Project | null>(null);
  const [bulletPoints, setBulletPoints] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [allImages, setAllImages] = useState<{ id: string; url: string; tag: 'overview' | 'deficiency' | null; description: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');
  const reportId = searchParams.get('reportId');
  const selectedImageIds = searchParams.get('selected_images');

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    };

    const fetchProject = async () => {
      if (!projectId) {
        router.push('/dashboard');
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error || !data) {
        console.error('Error fetching project:', error);
        router.push('/dashboard');
        return;
      }

      setProject(data);
    };

    getUser();
    fetchProject();
  }, [projectId, router]);

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showModelDropdown) {
        const target = event.target as Element;
        const dropdown = target.closest('[data-dropdown="model-selector"]');
        if (!dropdown) {
          setShowModelDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelDropdown]);

  // Load selected images when returning from image selection
  useEffect(() => {
    const loadSelectedImages = async () => {
      if (!selectedImageIds || !projectId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const imageIds = selectedImageIds.split(',');
        const { data, error } = await supabase
          .from('project_images')
          .select('*')
          .in('id', imageIds);
          
        if (error) throw error;
        
        setAllImages(prev => {
          // Avoid duplicates by id
          const newImages = (data || []).filter(img => !prev.some(existing => existing.id === img.id));
          return [...prev, ...newImages];
        });
        
        // Clear the URL parameter after loading
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('selected_images');
        window.history.replaceState({}, '', newUrl.toString());
        
      } catch (error: any) {
        setError('Failed to load selected images: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadSelectedImages();
  }, [selectedImageIds, projectId]);



  const handleImportProjectImages = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('project_images')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Avoid duplicates by id
      setAllImages(prev => ([
        ...prev,
        ...((data || []).filter(img => !prev.some(existing => existing.id === img.id)))
      ]));
    } catch (error: any) {
      setError('Failed to load project images: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!bulletPoints.trim()) {
      setError('Please enter some bullet points to generate a report');
      return;
    }

    if (allImages.length === 0) {
      setError('Please add at least one image to the report');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Starting report generation with:', {
        bulletPoints,
        projectName: project?.project_name,
        uploadedImagesCount: allImages.length,
      });

      // Save the initial report data to the database first
      const { error: saveError, data: reportData } = await supabase
        .from('reports')
        .insert([
          {
            project_id: project!.id,
            bullet_points: bulletPoints,
            generated_content: '', // Will be updated after generation
            user_id: user.id, // Add user tracking
          },
        ])
        .select()
        .single();

      if (saveError) throw saveError;
      console.log('Created report record:', reportData);

      // Insert all images into report_images with report_id first
      await supabase.from('report_images').insert(allImages.map(img => ({
        report_id: reportData.id,
        url: img.url,
        tag: img.tag,
        description: img.description,
        user_id: user.id // Add user tracking
      })));

      const selectedModelConfig = AVAILABLE_MODELS.find(model => model.id === selectedModel) || AVAILABLE_MODELS[0];
      console.log('Starting report generation with reportId:', reportData.id, 'using model:', selectedModelConfig.name);

      // Check if model supports streaming
      if (selectedModelConfig.supportsStreaming && selectedModelConfig.streamRoute) {
        // For streaming models, redirect immediately and let the edit page handle the streaming
        router.push(`/reports/${reportData.id}/edit?streaming=true&model=${selectedModel}`);
        
        // Start the streaming generation in the background
        fetch(selectedModelConfig.streamRoute, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bulletPoints,
            projectName: project?.name,
            contractName: project?.["Client Name"], // Also send as contractName for backend compatibility
            location: project?.location,
            reportId: reportData.id,
            images: allImages,
            modelType: selectedModel
          }),
        }).then(response => {
          console.log('Streaming API response:', response.status);
          return response.json();
        }).then(data => {
          console.log('Streaming API response data:', data);
        }).catch(error => {
          console.error('Streaming generation failed:', error);
        });
        
        return; // Exit early for streaming models
      }

      // For non-streaming models, use the original approach
      const response = await fetch(selectedModelConfig.route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bulletPoints,
          projectName: project?.name,
          location: project?.location,
          reportId: reportData.id,
          images: allImages,
          modelType: selectedModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const responseData = await response.json();
      const { generatedContent, images: responseImages, batchDetails, combinedDraft, processingStats } = responseData;
      
      // Store debug information if available
      if (batchDetails || combinedDraft || processingStats) {
        setDebugInfo({
          batchDetails,
          combinedDraft,
          processingStats,
          modelUsed: selectedModelConfig.name
        });
      }

      // Update the report with the generated content
      const { error: updateError } = await supabase
        .from('reports')
        .update({ generated_content: generatedContent })
        .eq('id', reportData.id);

      if (updateError) throw updateError;

      // Redirect to the report editor
      router.push(`/reports/${reportData.id}/edit`);
    } catch (error: any) {
      console.error('Error generating report:', error);
      setError(error.message || 'An error occurred while generating the report');
      setLoading(false);
    }
  };


  if (!project) {
    return (
      <div className="loading-container">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <>
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
            {reportId && (
              <Link
                href={`/reports/${reportId}`}
                className="text-accent"
                style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}
              >
                ← Back to Report Details
              </Link>
            )}
          </div>
        </header>
        
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>New Report for {project.name}</h1>
          <p className="text-secondary">
            Location: {project.location}
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-body">
            <h3 style={{ marginBottom: "1rem" }}>Report Configuration</h3>
            
            {/* Model Selection Dropdown */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                AI Model Selection
              </label>
              <div style={{ position: "relative", display: "inline-block" }} data-dropdown="model-selector">
                <button
                  type="button"
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="btn btn-outline"
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "0.5rem",
                    minWidth: "250px",
                    justifyContent: "space-between"
                  }}
                  disabled={loading}
                >
                  <span>
                    {AVAILABLE_MODELS.find(model => model.id === selectedModel)?.name || 'Select Model'}
                  </span>
                  <span style={{ fontSize: "0.75rem" }}>▼</span>
                </button>
                
                {showModelDropdown && (
                  <div 
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "white",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.5rem",
                      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                      zIndex: 1000,
                      marginTop: "0.25rem",
                      maxHeight: "200px",
                      overflowY: "scroll",
                      overflowX: "hidden"
                    }}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {AVAILABLE_MODELS.map((model, index) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(model.id);
                          setShowModelDropdown(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.875rem",
                          textAlign: "left",
                          border: "none",
                          backgroundColor: selectedModel === model.id ? "#e3f2fd" : "transparent",
                          cursor: "pointer",
                          borderBottom: index < AVAILABLE_MODELS.length - 1 ? "1px solid #f3f4f6" : "none",
                          transition: "background-color 0.15s ease"
                        }}
                        onMouseEnter={(e) => {
                          if (selectedModel !== model.id) {
                            e.currentTarget.style.backgroundColor = "#f8fafc";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedModel !== model.id) {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }
                        }}
                      >
                        <div style={{ 
                          fontWeight: "500", 
                          marginBottom: "0.25rem",
                          color: selectedModel === model.id ? "#1565c0" : "#374151"
                        }}>
                          {model.name}
                          {selectedModel === model.id && (
                            <span style={{ 
                              marginLeft: "0.5rem", 
                              color: "#1565c0",
                              fontSize: "0.875rem"
                            }}>
                              ✓
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: "0.75rem", 
                          color: selectedModel === model.id ? "#1976d2" : "#6b7280",
                          lineHeight: "1.3"
                        }}>
                          {model.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>
                Choose the AI model for generating your report. Different models offer varying levels of quality and processing speed.
              </p>
            </div>

            <h4 style={{ marginBottom: "1rem" }}>Report Images</h4>
            <div style={{ marginBottom: "1rem", display: 'flex', gap: '1rem' }}>
              <button 
                type="button"
                onClick={() => router.push(`/projects/${projectId}/images?mode=select&returnTo=reports`)}
                className="btn btn-secondary"
                disabled={loading}
              >
                Select Photos
              </button>
            </div>

            {allImages.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <h4 style={{ marginBottom: "1rem" }}>Project Images</h4>
                {allImages.map((image, idx) => (
                  <div key={image.id} className="card" style={{ display: 'flex', gap: '1.5rem', padding: '1rem', marginBottom: '2rem' }}>
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <textarea
                          value={image.description || ''}
                          onChange={(e) => {
                            setAllImages(prev => prev.map((img, i) => i === idx ? { ...img, description: e.target.value } : img));
                          }}
                          placeholder="Enter notes for this image..."
                          style={{
                            width: '100%',
                            minHeight: '200px',
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: '0.25rem',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            name={`noteType-${idx}`}
                            checked={image.tag === 'overview'}
                            onChange={() => {
                              setAllImages(prev => prev.map((img, i) => i === idx ? { ...img, tag: 'overview' } : img));
                            }}
                            style={{ margin: 0 }}
                          />
                          Overview
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            name={`noteType-${idx}`}
                            checked={image.tag === 'deficiency'}
                            onChange={() => {
                              setAllImages(prev => prev.map((img, i) => i === idx ? { ...img, tag: 'deficiency' } : img));
                            }}
                            style={{ margin: 0 }}
                          />
                          Deficiency
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAllImages(prev => prev.filter((_, i) => i !== idx))}
                        className="btn btn-danger btn-sm"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Remove Image
                      </button>
                    </div>
                    <div style={{ flex: '1' }}>
                      <img
                        src={image.url}
                        alt={image.description || 'Project image'}
                        style={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: '300px',
                          objectFit: 'contain',
                          borderRadius: '0.25rem'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {debugInfo && (
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div className="card-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3>Debug Information</h3>
                <button
                  type="button"
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  className="btn btn-outline btn-sm"
                >
                  {showDebugInfo ? 'Hide Details' : 'Show Details'}
                </button>
              </div>
              
              {debugInfo.processingStats && (
                <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#f8f9fa", borderRadius: "0.25rem" }}>
                  <strong>Processing Stats:</strong>
                  <ul style={{ margin: "0.5rem 0 0 0", listStyle: "none", padding: "0" }}>
                    <li>Model: {debugInfo.modelUsed}</li>
                    <li>Total Batches: {debugInfo.processingStats.totalBatches}</li>
                    <li>Total Images: {debugInfo.processingStats.totalImages}</li>
                    <li>Review Time: {debugInfo.processingStats.reviewTime}</li>
                    <li>Total Processing Time: {debugInfo.processingStats.totalProcessingTime}</li>
                  </ul>
                </div>
              )}

              {showDebugInfo && debugInfo.batchDetails && (
                <div style={{ marginBottom: "1rem" }}>
                  <h4>Batch Processing Details:</h4>
                  {debugInfo.batchDetails.map((batch: any, index: number) => (
                    <div key={index} style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px solid #dee2e6", borderRadius: "0.25rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <strong>Batch {batch.batchNumber}</strong>
                        <span style={{ fontSize: "0.875rem", color: "#6c757d" }}>
                          {batch.imageCount} images • {batch.processingTime}
                        </span>
                      </div>
                      <div style={{ 
                        maxHeight: "200px", 
                        overflowY: "auto", 
                        fontSize: "0.875rem", 
                        backgroundColor: "#f8f9fa", 
                        padding: "0.5rem",
                        borderRadius: "0.25rem",
                        whiteSpace: "pre-wrap"
                      }}>
                        {batch.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showDebugInfo && debugInfo.combinedDraft && (
                <div style={{ marginBottom: "1rem" }}>
                  <h4>Combined Draft (Before Final Review):</h4>
                  <div style={{ 
                    maxHeight: "300px", 
                    overflowY: "auto", 
                    fontSize: "0.875rem", 
                    backgroundColor: "#f8f9fa", 
                    padding: "0.75rem",
                    borderRadius: "0.25rem",
                    whiteSpace: "pre-wrap",
                    border: "1px solid #dee2e6"
                  }}>
                    {debugInfo.combinedDraft}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card" style={{ minHeight: "400px", position: "relative" }}>
          <div className="card-body">
            <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }} className="text-secondary">
              Enter your observation notes as bullet points below. These will be used to generate a detailed report. Press "Generate Report" when you're ready.
            </p>
            <textarea
              value={bulletPoints}
              onChange={(e) => setBulletPoints(e.target.value)}
              style={{ 
                width: "100%", 
                minHeight: "300px",
                padding: "1rem",
                fontSize: "1rem",
                lineHeight: "1.5",
                border: "1px solid var(--color-border)",
                borderRadius: "0.25rem",
                resize: "vertical"
              }}
              placeholder={'• Observed water damage in northwest corner \n \
• Ceiling tiles showing discoloration \n \
• HVAC system making unusual noise \n \
• Foundation appears to be settling on the east side \n \
• ...'}
              disabled={loading}
            />
            
            {loading && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10
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
                <style jsx>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                <p style={{ fontSize: "1.125rem", fontWeight: 500 }}>Generating Your Report</p>
                <p style={{ color: "#666", maxWidth: "400px", textAlign: "center", marginTop: "0.5rem" }}>
                  This may take up to a minute as we analyze your bullet points and create a detailed engineering report.
                </p>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "2rem", marginBottom: "2rem" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
            Using: <strong>{AVAILABLE_MODELS.find(model => model.id === selectedModel)?.name}</strong>
          </p>
          <button
            onClick={generateReport}
            disabled={loading || !bulletPoints.trim()}
            className="btn btn-primary"
            style={{ fontSize: "1.125rem", padding: "0.75rem 2rem" }}
          >
            {loading ? 'Generating Report...' : 'Generate Report'}
          </button>
        </div>
      </div>
    </>
  );
} 