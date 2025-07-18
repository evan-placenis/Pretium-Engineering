'use client';
//page to create a new report - fullscreen bullet points entry
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, Project } from '@/lib/supabase';
import Link from 'next/link';
import { Document, Packer, Paragraph, ImageRun, HeadingLevel, AlignmentType } from 'docx';
import { ImageListView, GroupedImageListView, type ImageItem } from '@/components/image_components';
import { TagValue } from '@/lib/tagConfig';
import { useImageManagement } from '@/hooks/useImageManagement';
import { Toast } from '@/components/feedback';


// Extended interface to track original values
interface ExtendedImageItem extends ImageItem {
  originalDescription?: string;
  originalTag?: TagValue;
  group?: string[]; // Add group information
  number?: number | null; // Add number information for ordering
}

// Define available models and their corresponding API routes
const AVAILABLE_MODELS = [
  { id: 'grok4', name: 'Grok-4 ', route: '/api/models/generate-report-grok4', streamRoute: '/api/models/generate-report-grok4', description: 'Latest xAI model with advanced reasoning capabilities', supportsStreaming: true },
  { id: 'advanced-streaming', name: 'gpt-4o', route: '/api/models/generate-report-gpt4', streamRoute: '/api/models/generate-report-gpt4', description: 'Open AI model with strong image understanding', supportsStreaming: true },
  { id: 'advanced', name: 'Advanced Model (Standard)', route: '/api/models/generate-report-advanced', description: 'Higher quality, slower processing', supportsStreaming: false },
  { id: 'lightweight', name: 'Lightweight Model', route: '/api/models/generate-report-lite', description: 'Faster processing, basic quality', supportsStreaming: false },
  { id: 'custom', name: 'Custom Fine-tuned', route: '/api/models/generate-report-custom', description: 'Your fine-tuned model', supportsStreaming: false },
  { id: 'standard', name: 'Standard Model', route: '/api/generate-report-simple', description: 'Balanced performance and speed', supportsStreaming: false },
];

export default function NewReport() {
  const [project, setProject] = useState<Project | null>(null);
  const [reportTitle, setReportTitle] = useState<string>('');
  const [bulletPoints, setBulletPoints] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [allImages, setAllImages] = useState<ExtendedImageItem[]>([]);
  const [selectedModel, setSelectedModel] = useState('advanced-streaming');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasManuallySelectedModel, setHasManuallySelectedModel] = useState(false);
  const hasRestoredFormData = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');
  const reportId = searchParams.get('reportId');
  const selectedImageIds = searchParams.get('selected_images');
  


  // Load form data from localStorage on component mount (only once)
  useEffect(() => {
    if (projectId && !hasRestoredFormData.current) {
      hasRestoredFormData.current = true;
      const savedData = localStorage.getItem(`report-form-${projectId}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          let restored = false;
          if (parsed.reportTitle) {
            setReportTitle(parsed.reportTitle);
            restored = true;
          }
          if (parsed.bulletPoints) {
            setBulletPoints(parsed.bulletPoints);
            restored = true;
          }
          // Only restore selectedModel if we're still on the default and haven't manually selected a model
          if (parsed.selectedModel && selectedModel === 'advanced-streaming' && !hasManuallySelectedModel) {
            setSelectedModel(parsed.selectedModel);
            restored = true;
          }
          if (restored) {
            setSuccessMessage('Your previous form data has been restored');
            setTimeout(() => setSuccessMessage(null), 3000);
          }
        } catch (error) {
          console.warn('Failed to parse saved form data:', error);
        }
      }
    }
  }, [projectId]); // Only depend on projectId

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (projectId) {
      const formData = {
        reportTitle,
        bulletPoints,
        selectedModel,
        timestamp: Date.now()
      };
      localStorage.setItem(`report-form-${projectId}`, JSON.stringify(formData));
    }
  }, [reportTitle, bulletPoints, selectedModel, projectId]);

  // Clear saved form data when report is successfully generated
  const clearSavedFormData = () => {
    if (projectId) {
      localStorage.removeItem(`report-form-${projectId}`);
      setHasManuallySelectedModel(false); // Reset the manual selection flag
      hasRestoredFormData.current = false; // Reset the restoration flag
    }
  };

  // Use the shared image management hook
  const { updateImageFromAutoSave, handleImageUpdate, handleShowSuccessMessage } = useImageManagement({
    projectId: projectId ?? undefined,
    onSuccessMessage: (message) => setSuccessMessage(message)
  });

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
          .in('id', imageIds)
          .order('number', { ascending: true, nullsFirst: false }) // Order by number first, then by created_at
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setAllImages(prev => {
          // Avoid duplicates by id and initialize original values
          const newImages = (data || [])
            .filter(img => !prev.some(existing => existing.id === img.id))
            .map(img => ({
              ...img,
              originalDescription: img.description,
              originalTag: img.tag,
              hasChanges: false,
              group: img.group || [], // Preserve group information
              number: img.number // Preserve number information
            }));
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
        .order('number', { ascending: true, nullsFirst: false }) // Order by number first, then by created_at
        .order('created_at', { ascending: false });
      if (error) throw error;
              // Avoid duplicates by id and initialize original values
        setAllImages(prev => ([
          ...prev,
          ...((data || [])
            .filter(img => !prev.some(existing => existing.id === img.id))
            .map(img => ({
              ...img,
              originalDescription: img.description,
              originalTag: img.tag,
              hasChanges: false,
              group: img.group || [], // Preserve group information
              number: img.number, // Preserve number information
              rotation: img.rotation || 0 // Preserve rotation information
            })))
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
      // Sort images by group and number before sending to AI
      const sortedImages = [...allImages].sort((a, b) => {
        // First sort by group name (alphabetically)
        const aGroup = (a.group && a.group.length > 0) ? a.group[0] : '';
        const bGroup = (b.group && b.group.length > 0) ? b.group[0] : '';
        
        if (aGroup !== bGroup) {
          return aGroup.localeCompare(bGroup);
        }
        
        // Within the same group, sort by number
        if (a.number && b.number) {
          return a.number - b.number;
        } else if (a.number && !b.number) {
          return -1; // Numbered images first
        } else if (!a.number && b.number) {
          return 1; // Numbered images first
        }
        
        // If neither has a number, maintain original order
        return 0;
      });

      console.log('Starting report generation with:', {
        bulletPoints,
        projectName: project?.project_name,
        uploadedImagesCount: sortedImages.length,
        sortedImages: sortedImages.map((img, index) => ({
          index: index + 1,
          group: img.group?.[0] || 'ungrouped',
          number: img.number,
          description: img.description
        }))
      });

      // Save the initial report data to the database first
      console.log('Attempting to create report record in database...');
      const { error: saveError, data: reportData } = await supabase
        .from('reports')
        .insert([
          {
            project_id: project!.id,
            title: reportTitle.trim() || null, // Save title if provided
            bullet_points: bulletPoints,
            generated_content: '', // Will be updated after generation
            user_id: user.id, // Add user tracking
          },
        ])
        .select()
        .single();


      // Insert all images into report_images with report_id first
      console.log('Attempting to insert report images...');
      console.log('Images with rotation data:', sortedImages.map(img => ({
        id: img.id,
        description: img.description,
        rotation: img.rotation,
        number: img.number
      })));
      const { error: imagesError } = await supabase.from('report_images').insert(sortedImages.map(img => ({
        report_id: reportData.id,
        url: img.url,
        tag: img.tag,
        description: img.description,
        number: img.number, // Preserve the number field for proper ordering
        group: img.group, // Add group information
        rotation: img.rotation || 0, // Preserve rotation information
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
            projectId: project?.id,
            contractName: project?.["Client Name"],
            location: project?.location,
            reportId: reportData.id,
            images: sortedImages,
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
        
        // Clear saved form data after successful generation
        clearSavedFormData();
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
          projectId: project?.id,
          location: project?.location,
          reportId: reportData.id,
          images: sortedImages,
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

      // Clear saved form data after successful generation
      clearSavedFormData();

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
    <div className="container page-content" style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '2rem', color: 'var(--color-primary)' }}>
        Create New Report
      </h1>

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
        <Toast message={error} type="error" />
      )}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-body">
          <h3 style={{ marginBottom: "1rem" }}>Report Configuration</h3>
          {/* Report Title Input */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              Report Title (Optional)
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Enter a custom title for this report..."
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "1rem",
                border: "1px solid var(--color-border)",
                borderRadius: "0.25rem"
              }}
              disabled={loading}
            />
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>
              If left blank, the report will be automatically numbered (e.g., "Report 1", "Report 2", etc.)
            </p>
          </div>
          
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
                        setHasManuallySelectedModel(true);
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
          {/* Image List View */}
          {allImages.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h4 style={{ marginBottom: "1rem" }}>Project Images</h4>
              <GroupedImageListView
                images={allImages}
                onUpdateImage={(imageId, field, value) => {
                  const update = handleImageUpdate(imageId, field, value);
                  setAllImages(prev => prev.map(img => {
                    if (img.id === update.imageId) {
                      const updated = { ...img, [update.field]: update.value };
                      
                      return updated;
                    }
                    return img;
                  }));
                }}
                onAutoSaveUpdate={updateImageFromAutoSave}
                onShowSuccessMessage={handleShowSuccessMessage}
                onRemoveImage={(imageId) => {
                  setAllImages(prev => prev.filter(img => img.id !== imageId));
                }}
                showRotateButton={true}
                currentUserId={user?.id}
                projectId={searchParams.get('project_id') ?? undefined}
                collapsible={true}
                defaultCollapsed={false}
              />
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

      <Toast message={successMessage} type="success" />
    </div>
  );
} 