'use client';
//page to create a new report - fullscreen bullet points entry
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, Project } from '@/lib/supabase';
import Link from 'next/link';
import { Document, Packer, Paragraph, ImageRun, HeadingLevel, AlignmentType } from 'docx';
import { type ImageItem } from '@/components/image_components';

import { Toast } from '@/components/feedback';
import CollapsibleGroup from '@/components/CollapsibleGroup';
import { NumberingMode, NumberedImageCard } from './components';
import { useNumberingMode } from './hooks/useNumberingMode';


// Extended interface for report images
interface ExtendedImageItem extends ImageItem {
  group?: string[]; // Add group information
  number?: number | null; // Add number information for ordering
}

interface GroupOrder {
  groupName: string;
  order: number;
}

// Define available models for the unified report generation system
const AVAILABLE_MODELS = [
  { id: 'grok4', name: 'Grok-4', description: 'Latest xAI model with advanced reasoning capabilities' },
  { id: 'gpt4o', name: 'GPT-4o', description: 'OpenAI model with strong image understanding' },
];

export default function NewReport() {
  const [project, setProject] = useState<Project | null>(null);
  const [reportTitle, setReportTitle] = useState<string>('');
  const [bulletPoints, setBulletPoints] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedImages, setSelectedImages] = useState<ExtendedImageItem[]>([]);
  const [selectedModel, setSelectedModel] = useState('grok4');
  const [reportMode, setReportMode] = useState<'brief' | 'elaborate' | 'parallel-summary'>('brief');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasManuallySelectedModel, setHasManuallySelectedModel] = useState(false);
  const [groupNumberingStates, setGroupNumberingStates] = useState<{ [groupName: string]: boolean }>({});
  const [groupOrder, setGroupOrder] = useState<GroupOrder[]>([]);
  const [isGroupOrderingMode, setIsGroupOrderingMode] = useState(false);
  const [isUngroupedMode, setIsUngroupedMode] = useState(false);
  const hasRestoredFormData = useRef(false);
  
  // Use the numbering mode hook
  const {
    numberingMode,
    numberingSelection,
    startNumberingMode,
    handleNumberingSelection,
    completeNumbering,
    cancelNumbering,
    autoNumberImages,
    isInNumberingMode,
    isNumberingSelected,
    getNumberingIndex
  } = useNumberingMode({
    selectedImages,
    setSelectedImages,
    groupNumberingStates,
    setGroupNumberingStates
  });
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');
  const reportId = searchParams.get('reportId');
  const selectedImageIds = searchParams.get('selected_images');
  const groupsData = searchParams.get('groups_data');
  const useTemplate = searchParams.get('useTemplate');
  const ungroupedMode = searchParams.get('ungrouped');
  


  // Set mode based on URL parameter - this is the primary source of truth
  useEffect(() => {
    if (ungroupedMode === 'true') {
      setIsUngroupedMode(true);
      // Clear any existing group data when explicitly entering ungrouped mode
      setSelectedImages(prev => prev.map(img => ({
        ...img,
        group: [],
        number: null
      })));
      setGroupNumberingStates({});
      setGroupOrder([]);
    } else {
      // If not explicitly ungrouped, default to grouped mode
      setIsUngroupedMode(false);
    }
  }, [ungroupedMode]);

  // Clear group data when entering ungrouped mode (additional safety)
  useEffect(() => {
    if (isUngroupedMode) {
      setSelectedImages(prev => prev.map(img => ({
        ...img,
        group: [],
        number: null
      })));
      setGroupNumberingStates({});
      setGroupOrder([]);
    }
  }, [isUngroupedMode]);

  // Load form data from localStorage on component mount (only once)
  useEffect(() => {
    const restoreFormData = async () => {
      if (projectId && !hasRestoredFormData.current) {
        hasRestoredFormData.current = true;
        
        // Check if we should load a template
        if (useTemplate === 'true') {
          const templateData = localStorage.getItem(`report-template-${projectId}`);
          if (templateData) {
            try {
              const parsed = JSON.parse(templateData);
              
              // Load the template images from the database
              const templateImageIds = parsed.selectedImages.map((img: any) => img.id);
              const { data: templateImages, error: loadError } = await supabase
                .from('project_images')
                .select('*')
                .in('id', templateImageIds);
                
              if (!loadError && templateImages) {
                const restoredImages = templateImages.map(img => {
                  const templateData = parsed.selectedImages.find((template: any) => template.id === img.id);
                  return {
                    ...img,
                    group: templateData?.group || [],
                    number: templateData?.number || null
                  };
                });
                
                // Determine if the template was ungrouped or grouped based on the data
                const hasGroups = restoredImages.some(img => img.group && img.group.length > 0);
                const isTemplateUngrouped = !hasGroups;
                
                // Set the mode based on the template data, not URL parameter
                setIsUngroupedMode(isTemplateUngrouped);
                
                setSelectedImages(restoredImages);
                setGroupNumberingStates(parsed.groupNumberingStates || {});
                setGroupOrder(parsed.groupOrder || []);
                
                // Load bullet points and generated content from template
                if (parsed.bulletPoints) {
                  setBulletPoints(parsed.bulletPoints);
                }
                
                // Also check for separate localStorage items as fallback
                const savedBulletPoints = localStorage.getItem(`report-bullet-points-${projectId}`);
                
                if (savedBulletPoints && !parsed.bulletPoints) {
                  setBulletPoints(savedBulletPoints);
                }
                
                // Clear the separate localStorage items after loading
                localStorage.removeItem(`report-bullet-points-${projectId}`);
                localStorage.removeItem(`report-generated-content-${projectId}`);
                
                setSuccessMessage('Template loaded successfully! Photo structure, bullet points, and content restored.');
                setTimeout(() => setSuccessMessage(null), 3000);
                
                // Clear the template from localStorage after loading
                localStorage.removeItem(`report-template-${projectId}`);
                return;
              }
            } catch (error) {
              console.warn('Failed to load template:', error);
            }
          }
        }
        
        // Fall back to normal form data restoration
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
            // Restore selected images from localStorage if no URL params are present
            if (parsed.selectedImages && Array.isArray(parsed.selectedImages) && !selectedImageIds) {
              // Load the saved images from the database
              const savedImageIds = parsed.selectedImages.map((img: any) => img.id);
              const savedGroupsMapping: { [imageId: string]: string[] } = {};
              parsed.selectedImages.forEach((img: any) => {
                if (img.id && img.group) {
                  savedGroupsMapping[img.id] = img.group;
                }
              });
              
              // Load images from database and restore their groups and numbers
              const { data: savedImages, error: loadError } = await supabase
                .from('project_images')
                .select('*')
                .in('id', savedImageIds);
                
              if (!loadError && savedImages) {
                const restoredImages = savedImages.map(img => {
                  const savedData = parsed.selectedImages.find((saved: any) => saved.id === img.id);
                  return {
                    ...img,
                    group: savedData?.group || [],
                    number: savedData?.number || null
                  };
                });
                setSelectedImages(restoredImages);
                restored = true;
              }
            }
            // Only restore selectedModel if we're still on the default and haven't manually selected a model
            if (parsed.selectedModel && selectedModel === 'grok4' && !hasManuallySelectedModel) {
              setSelectedModel(parsed.selectedModel);
              restored = true;
            }
            if (parsed.groupNumberingStates && typeof parsed.groupNumberingStates === 'object') {
              setGroupNumberingStates(parsed.groupNumberingStates);
              restored = true;
            }
            if (parsed.groupOrder && Array.isArray(parsed.groupOrder)) {
              setGroupOrder(parsed.groupOrder);
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
    };
    
    restoreFormData();
  }, [projectId, selectedImageIds, useTemplate]); // Add useTemplate to dependencies

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (projectId) {
      const formData = {
        reportTitle,
        bulletPoints,
        selectedModel,
        selectedImages: selectedImages.map(img => ({
          id: img.id,
          group: img.group,
          number: img.number
        })), // Save selected image data with groups and numbers
        groupNumberingStates, // Save numbering states
        groupOrder, // Save group order
        timestamp: Date.now()
      };
      localStorage.setItem(`report-form-${projectId}`, JSON.stringify(formData));
      
      // Clear URL parameters after data has been saved to localStorage
      // This prevents URL from getting too long with multiple groups
      if (selectedImageIds || groupsData) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('selected_images');
        newUrl.searchParams.delete('groups_data');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
  }, [reportTitle, bulletPoints, selectedModel, projectId, groupNumberingStates, selectedImages, selectedImageIds, groupsData]);

  // Clear saved form data when report is successfully generated
  // Initialize group order when groups are loaded
  const initializeGroupOrder = (groups: string[]) => {
    const existingOrder = groupOrder.map(go => go.groupName);
    const newGroups = groups.filter(group => !existingOrder.includes(group));
    
    if (newGroups.length > 0) {
      const newOrder = newGroups.map((group, index) => ({
        groupName: group,
        order: groupOrder.length + index + 1
      }));
      setGroupOrder(prev => [...prev, ...newOrder]);
    }
  };

  // Update group order
  const updateGroupOrder = (groupName: string, newOrder: number) => {
    setGroupOrder(prev => {
      const updated = prev.map(go => 
        go.groupName === groupName ? { ...go, order: newOrder } : go
      );
      return updated.sort((a, b) => a.order - b.order);
    });
  };

  // Move group up in order
  const moveGroupUp = (groupName: string) => {
    const currentGroup = groupOrder.find(go => go.groupName === groupName);
    if (currentGroup && currentGroup.order > 1) {
      const targetGroup = groupOrder.find(go => go.order === currentGroup.order - 1);
      if (targetGroup) {
        updateGroupOrder(groupName, currentGroup.order - 1);
        updateGroupOrder(targetGroup.groupName, currentGroup.order);
      }
    }
  };

  // Move group down in order
  const moveGroupDown = (groupName: string) => {
    const currentGroup = groupOrder.find(go => go.groupName === groupName);
    const maxOrder = Math.max(...groupOrder.map(go => go.order));
    if (currentGroup && currentGroup.order < maxOrder) {
      const targetGroup = groupOrder.find(go => go.order === currentGroup.order + 1);
      if (targetGroup) {
        updateGroupOrder(groupName, currentGroup.order + 1);
        updateGroupOrder(targetGroup.groupName, currentGroup.order);
      }
    }
  };

  // Get group order number
  const getGroupOrder = (groupName: string) => {
    const group = groupOrder.find(go => go.groupName === groupName);
    return group ? group.order : 0;
  };

  const clearSavedFormData = () => {
    if (projectId) {
      localStorage.removeItem(`report-form-${projectId}`);
      localStorage.removeItem(`report-groups-${projectId}`); // Clear groups data too
      setHasManuallySelectedModel(false); // Reset the manual selection flag
      hasRestoredFormData.current = false; // Reset the restoration flag
    }
  };



  // Group images by their group name and sort by number within each group
  // Only group if we're not in ungrouped mode
  const groupedImages = isUngroupedMode ? {} : selectedImages.reduce((groups, image) => {
    const groupName = image.group && image.group.length > 0 ? image.group[0] : 'Ungrouped';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(image);
    return groups;
  }, {} as { [groupName: string]: ExtendedImageItem[] });

  // Sort images within each group by number (lowest to highest)
  Object.keys(groupedImages).forEach(groupName => {
    groupedImages[groupName].sort((a, b) => {
      // If both have numbers, sort by number
      if (a.number && b.number) {
        return a.number - b.number;
      }
      // If only one has a number, put numbered ones first
      if (a.number && !b.number) return -1;
      if (!a.number && b.number) return 1;
      // If neither has a number, sort by creation date
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aDate - bDate;
    });
  });

  // Initialize group order when groups change
  useEffect(() => {
    const groupNames = Object.keys(groupedImages);
    initializeGroupOrder(groupNames);
  }, [Object.keys(groupedImages).join(',')]);

  // Sort groups by their order
  const sortedGroupEntries = Object.entries(groupedImages).sort(([a], [b]) => {
    const orderA = getGroupOrder(a);
    const orderB = getGroupOrder(b);
    return orderA - orderB;
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
        
        // Parse groups data if available (from URL or localStorage)
        let groupsMapping: { [imageId: string]: string[] } = {};
        
        if (groupsData) {
          // Use URL groups data if available
          try {
            const parsedGroupsData = JSON.parse(decodeURIComponent(groupsData));
            parsedGroupsData.forEach((item: any) => {
              if (item.id && item.group) {
                groupsMapping[item.id] = item.group;
              }
            });
          } catch (error) {
            console.warn('Failed to parse URL groups data:', error);
          }
        } else {
          // Fall back to localStorage groups data
          const savedGroupsData = localStorage.getItem(`report-groups-${projectId}`);
          if (savedGroupsData) {
            try {
              const parsedGroupsData = JSON.parse(savedGroupsData);
              parsedGroupsData.forEach((item: any) => {
                if (item.id && item.group) {
                  groupsMapping[item.id] = item.group;
                }
              });
            } catch (error) {
              console.warn('Failed to parse localStorage groups data:', error);
            }
          }
        }

        setSelectedImages(prev => {
          // Avoid duplicates by id
          const newImages = (data || [])
            .filter(img => !prev.some(existing => existing.id === img.id))
            .map(img => ({ ...img }));
          
          const updatedImages = [...prev, ...newImages];
          
          // Only apply grouping logic if we're not in ungrouped mode
          if (!isUngroupedMode) {
            // Use the hook to automatically number images and set group states
            const { numberedImages, newGroupStates } = autoNumberImages(updatedImages, groupsMapping);
            
            // Merge the new group states with existing ones (don't overwrite)
            setGroupNumberingStates(prevStates => ({ ...prevStates, ...newGroupStates }));
            
            return numberedImages;
          } else {
            // For ungrouped mode, just return the images without grouping
            return updatedImages.map(img => ({
              ...img,
              group: [],
              number: null
            }));
          }
        });
        
        // Don't clear URL parameters immediately - let localStorage handle persistence
        // This allows multiple groups to be loaded properly
        
      } catch (error: any) {
        setError('Failed to load selected images: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadSelectedImages();
  }, [selectedImageIds, projectId]);





  const generateReport = async () => {
    // Prevent multiple submissions
    if (loading) {
      console.log('Report generation already in progress, ignoring duplicate click');
      return;
    }

    if (!bulletPoints.trim()) {
      setError('Please enter some bullet points to generate a report');
      return;
    }

    if (selectedImages.length === 0) {
      setError('Please add at least one image to the report');
      return;
    }

    console.log('Starting report generation process...');
    setLoading(true);
    setError(null);

    try {
      // Sort images based on mode
      let sortedImages;
      if (isUngroupedMode) {
        // For ungrouped mode, just sort by creation date
        sortedImages = [...selectedImages].sort((a, b) => {
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aDate - bDate;
        });
      } else {
        // For grouped mode, sort by group order and then by image number within each group
        sortedImages = [...selectedImages].sort((a, b) => {
          const aGroup = (a.group && a.group.length > 0) ? a.group[0] : 'Ungrouped';
          const bGroup = (b.group && b.group.length > 0) ? b.group[0] : 'Ungrouped';
          
          // First sort by group order
          const aGroupOrder = getGroupOrder(aGroup);
          const bGroupOrder = getGroupOrder(bGroup);
          
          if (aGroupOrder !== bGroupOrder) {
            return aGroupOrder - bGroupOrder;
          }
          
          // Then sort by image number within the group
          if (a.number && b.number) {
            return a.number - b.number;
          }
          if (a.number && !b.number) return -1;
          if (!a.number && b.number) return 1;
          
          // Finally sort by creation date
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aDate - bDate;
        });
      }

      // Apply numbering to images based on mode
      const imagesWithNumbering = sortedImages.map((image, globalIndex) => {
        if (isUngroupedMode) {
          // For ungrouped mode, assign sequential numbers
          return {
            ...image,
            number: globalIndex + 1,
            group: [] // Ensure no groups for ungrouped mode
          };
        } else {
          // For grouped mode, use existing numbering logic
          const groupName = image.group && image.group.length > 0 ? image.group[0] : 'Ungrouped';
          const isNumberingEnabled = groupNumberingStates[groupName];
          
          if (isNumberingEnabled && image.number) {
            // Use the manually assigned number from numbering mode
            return {
              ...image,
              number: image.number
            };
          }
          
          return {
            ...image,
            number: null // No numbering for this image
          };
        }
      });

      console.log('Starting report generation with:', {
        bulletPoints,
        projectName: project?.project_name,
        uploadedImagesCount: imagesWithNumbering.length,
        sortedImages: imagesWithNumbering.map((img, index) => ({
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
      console.log('Images with rotation data:', imagesWithNumbering.map(img => ({
        id: img.id,
        description: img.description,
        rotation: img.rotation,
        number: img.number
      })));
      const { error: imagesError } = await supabase.from('report_images').insert(imagesWithNumbering.map(img => ({
        report_id: reportData.id,
        url: img.url,
        tag: img.tag,
        description: img.description,
        number: img.number, // Preserve the number field for proper ordering
        group: img.group, // Add group information
        rotation: img.rotation || 0, // Preserve rotation information
        user_id: user.id // Add user tracking
      })));

      if (imagesError) {
        console.error('Error inserting report images:', imagesError);
        throw new Error(`Failed to insert report images: ${imagesError.message}`);
      }

      console.log('Starting report generation with reportId:', reportData.id, 'using model:', selectedModel, 'mode:', reportMode);

      // Use the unified API route with user-selected parameters
      const response = await fetch('/api/models/generate-report', {
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
          imagesWithNumbering,
          groupOrder: groupOrder, // Include group ordering information
          selectedModel, // User's model choice
          isUngroupedMode, // User's grouping choice
          mode: reportMode // User's mode choice ('brief' or 'elaborate')
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const responseData = await response.json();
      console.log('Job queued successfully:', responseData);

      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to queue report generation job');
      }

      // Store debug information if available (for job tracking)
      if (responseData && typeof responseData === 'object' && 'jobId' in responseData) {
        setDebugInfo({
          jobId: responseData.jobId,
          message: responseData.message,
          modelUsed: selectedModel
        });
      }

      // Clear saved form data after successful job queuing
      clearSavedFormData();

      // Redirect to the report editor to show progress
      router.push(`/reports/${reportData.id}/edit?jobId=${responseData.jobId}&streaming=true&model=${selectedModel}`);
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

          {/* Report Mode Selection */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
              Report Style
            </label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setReportMode('brief')}
                className="btn btn-sm"
                style={{ 
                  backgroundColor: reportMode === 'brief' ? 'var(--color-primary)' : 'transparent',
                  color: reportMode === 'brief' ? '#fff' : 'var(--color-text)',
                  borderColor: reportMode === 'brief' ? 'var(--color-primary)' : 'var(--color-border)',
                  fontSize: "0.875rem",
                  padding: "0.5rem 1rem"
                }}
                disabled={loading}
              >
                Brief
              </button>
              <button
                type="button"
                onClick={() => setReportMode('elaborate')}
                className="btn btn-sm"
                style={{ 
                  backgroundColor: reportMode === 'elaborate' ? 'var(--color-primary)' : 'transparent',
                  color: reportMode === 'elaborate' ? '#fff' : 'var(--color-text)',
                  borderColor: reportMode === 'elaborate' ? 'var(--color-primary)' : 'var(--color-border)',
                  fontSize: "0.875rem",
                  padding: "0.5rem 1rem"
                }}
                disabled={loading}
              >
                Elaborate
              </button>
              <button
                type="button"
                onClick={() => setReportMode('parallel-summary')}
                className="btn btn-sm"
                style={{ 
                  backgroundColor: reportMode === 'parallel-summary' ? 'var(--color-primary)' : 'transparent',
                  color: reportMode === 'parallel-summary' ? '#fff' : 'var(--color-text)',
                  borderColor: reportMode === 'parallel-summary' ? 'var(--color-primary)' : 'var(--color-border)',
                  fontSize: "0.875rem",
                  padding: "0.5rem 1rem"
                }}
                disabled={loading}
              >
                Parallel Summary
              </button>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>
              Brief: Concise, focused reports. Elaborate: Detailed, comprehensive analysis. Parallel Summary: Uses multiple AI agents for faster processing with reduced timeout risk.
            </p>
          </div>

          <h4 style={{ marginBottom: "1rem" }}>Project Images</h4>
          <div style={{ marginBottom: "1rem", display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={() => {
                let url = `/projects/${projectId}/images?mode=select&returnTo=reports`;
                
                if (selectedImages.length > 0) {
                  // Only add mode parameters if there are already images loaded
                  if (isUngroupedMode) {
                    url += '&ungrouped=true';
                  } else {
                    url += '&grouped=true';
                  }
                }
                
                router.push(url);
              }}
              className="btn btn-secondary"
              disabled={loading}
              title="Select photos for your report"
            >
              Select Photos
            </button>
            <button
              type="button"
              onClick={() => router.push(`/reports/new/use-previous?project_id=${projectId}&returnTo=reports`)}
              className="btn btn-outline"
              disabled={loading || isUngroupedMode}
              title={isUngroupedMode ? "Cannot use previous grouped reports when using ungrouped photos" : "Use previous report as template"}
            >
              Use Previous
            </button>
          </div>
          {/* Selected Images Display */}
          {selectedImages.length > 0 && (
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ marginBottom: "1rem" }}>
                {isUngroupedMode ? 'Ungrouped Report Images' : 'Report Images'} ({selectedImages.length})
              </h2>
              {!isUngroupedMode && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: "1rem"
                }}>
                  <button 
                    type="button"
                    onClick={() => setIsGroupOrderingMode(!isGroupOrderingMode)}
                    className="btn btn-outline"
                    disabled={loading}
                    style={{ 
                      color: isGroupOrderingMode ? '#fff' : '#0d6efd', 
                      backgroundColor: isGroupOrderingMode ? '#0d6efd' : 'transparent',
                      borderColor: '#0d6efd'
                    }}
                  >
                    {isGroupOrderingMode ? 'Done Ordering' : 'Order Sections'}
                  </button>
                                  <button 
                  type="button"
                  onClick={() => {
                    setSelectedImages([]);
                    setGroupNumberingStates({});
                    setGroupOrder([]);
                    setIsUngroupedMode(false);
                    localStorage.removeItem(`report-groups-${projectId}`);
                  }}
                  className="btn btn-outline"
                  disabled={loading}
                  style={{ color: '#dc3545', borderColor: '#dc3545' }}
                >
                  Clear All Groups
                </button>
                </div>
              )}
              {isUngroupedMode && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  alignItems: 'center',
                  marginBottom: "1rem"
                }}>
                  <button 
                    type="button"
                    onClick={() => {
                      setSelectedImages([]);
                      setIsUngroupedMode(false);
                      setGroupNumberingStates({});
                      setGroupOrder([]);
                      localStorage.removeItem(`report-groups-${projectId}`);
                    }}
                    className="btn btn-outline"
                    disabled={loading}
                    style={{ color: '#dc3545', borderColor: '#dc3545' }}
                  >
                    Clear All Images
                  </button>
                </div>
              )}
              {/* Display logic based on mode */}
              {!isUngroupedMode ? (
                // Grouped mode display
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {sortedGroupEntries.map(([groupName, images]) => (
                    <div key={groupName} style={{ marginBottom: "1rem" }}>
                      {/* Group Header with Ordering Controls */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        marginBottom: "0.5rem"
                      }}>
                        {/* Ordering Controls */}
                        {isGroupOrderingMode && (
                          <div style={{ display: "flex", gap: "0.25rem" }}>
                            <button
                              onClick={() => moveGroupUp(groupName)}
                              className="btn btn-outline btn-sm"
                              disabled={getGroupOrder(groupName) <= 1}
                              style={{ 
                                fontSize: "0.75rem", 
                                padding: "0.25rem 0.5rem",
                                opacity: getGroupOrder(groupName) > 1 ? 1 : 0.5,
                                cursor: getGroupOrder(groupName) > 1 ? 'pointer' : 'not-allowed'
                              }}
                              title="Move section up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveGroupDown(groupName)}
                              className="btn btn-outline btn-sm"
                              disabled={getGroupOrder(groupName) >= Math.max(...groupOrder.map(go => go.order))}
                              style={{ 
                                fontSize: "0.75rem", 
                                padding: "0.25rem 0.5rem",
                                opacity: getGroupOrder(groupName) < Math.max(...groupOrder.map(go => go.order)) ? 1 : 0.5,
                                cursor: getGroupOrder(groupName) < Math.max(...groupOrder.map(go => go.order)) ? 'pointer' : 'not-allowed'
                              }}
                              title="Move section down"
                            >
                              ↓
                            </button>
                          </div>
                        )}
                        
                        {/* Group Component */}
                        <div style={{ flex: 1 }}>
                          <CollapsibleGroup
                            groupName={`${getGroupOrder(groupName) > 0 ? `Section ${getGroupOrder(groupName)}: ` : ''}${groupName}`}
                            itemCount={images.length}
                            showSelectionControls={false}
                            isFullySelected={false}
                            isPartiallySelected={false}
                            onGroupSelectionToggle={() => {}}
                            defaultOpen={false}
                          >
                            {/* Numbering Controls */}
                            <div style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "1rem",
                              padding: "0.5rem",
                              background: "var(--color-bg-secondary)",
                              borderRadius: "0.25rem"
                            }}>
                              <span style={{ fontSize: "0.875rem", fontWeight: "500" }}>
                                {groupNumberingStates[groupName] ? "Numbering Enabled" : "Numbering Disabled"}
                              </span>
                              <button
                                onClick={() => startNumberingMode(groupName)}
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: "0.75rem" }}
                              >
                                {groupNumberingStates[groupName] ? "Re-number Photos" : "Number Photos"}
                              </button>
                            </div>
                        
                        {/* Numbering Mode UI */}
                        {isInNumberingMode(groupName) && (
                          <NumberingMode
                            groupName={groupName}
                            selectedCount={numberingSelection.length}
                            onComplete={() => completeNumbering(groupName)}
                            onCancel={cancelNumbering}
                          />
                        )}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                          gap: "1rem",
                          padding: "1rem",
                          border: "1px solid var(--color-border)",
                          borderRadius: "0.5rem",
                          backgroundColor: "var(--color-bg-card)"
                        }}>
                          {images.map((image, index) => (
                            <NumberedImageCard
                              key={image.id}
                              image={image}
                              groupName={groupName}
                              isNumbering={isInNumberingMode(groupName)}
                              isNumberingSelected={isNumberingSelected(image.id)}
                              numberingIndex={getNumberingIndex(image.id)}
                              isNumberingEnabled={groupNumberingStates[groupName]}
                              onNumberingSelection={handleNumberingSelection}
                            />
                          ))}
                        </div>
                          </CollapsibleGroup>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Ungrouped mode display - direct grid without collapsible headers
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "1rem",
                  padding: "1rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--color-bg-card)"
                }}>
                  {selectedImages.map((image, index) => (
                    <div key={image.id} style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "0.5rem",
                      overflow: "hidden",
                      backgroundColor: "var(--color-bg)"
                    }}>
                      <img
                        src={image.url}
                        alt={image.description || `Image ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "150px",
                          objectFit: "cover"
                        }}
                      />
                      <div style={{ padding: "0.5rem" }}>
                        <p style={{ 
                          fontSize: "0.875rem", 
                          fontWeight: "500",
                          margin: "0",
                          textAlign: "center"
                        }}>
                          Photo {index + 1}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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