'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { supabase, Project, ProjectImage } from '@/lib/supabase';
import Link from 'next/link';
import { ImageListView, type ImageItem as BaseImageItem } from '@/components/image_components';
import { ImageGridView } from '@/components/image_components';
import { Toast } from '@/components/feedback';
import GroupCreationPanel from './components/GroupCreationPanel';
import ImageFilter, { type FilterableImage } from '@/components/ImageFilter';
import UploadPhotoModal from './components/UploadPhotoModal';
import AddPhotosModal from './components/AddPhotosModal';
import CollapsibleGroup from '@/components/CollapsibleGroup';

// Extend ImageItem to include group property for project images
interface ImageItem extends BaseImageItem {
  group?: string[];
}

/**
 * ProjectImagesPage Component
 * 
 * Main page for managing project images. Features:
 * - Display all images for a project grouped by upload batch
 * - Upload new photos with required group names
 * - Edit group names inline
 * - Collapsible groups for better organization
 * - Image management (edit, rotate, remove)
 * 
 * This page stores images at the project level, which can then be
 * selected and grouped for reports on the new report page.
 */
export default function ProjectImagesPage() {
  // ===== STATE MANAGEMENT =====
  
  /** Current project data */
  const [project, setProject] = useState<Project | null>(null);
  /** List of all images for the current project */
  const [images, setImages] = useState<ImageItem[]>([]);
  /** Filtered images based on current filters */
  const [filteredImages, setFilteredImages] = useState<ImageItem[] | null>(null);
  /** Loading state for initial page load */
  const [loading, setLoading] = useState(true);
  /** Loading state for image uploads */
  const [uploadLoading, setUploadLoading] = useState(false);
  /** Error message to display */
  const [error, setError] = useState<string | null>(null);
  /** Success message to display */
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  /** Whether the upload modal is open */
  const [showUploadModal, setShowUploadModal] = useState(false);
  /** Whether the add photos modal is open */
  const [showAddPhotosModal, setShowAddPhotosModal] = useState(false);
  /** The group name for adding photos to */
  const [selectedGroupForAdd, setSelectedGroupForAdd] = useState<string>('');
  /** Current authenticated user */
  const [user, setUser] = useState<any>(null);
  
  /** Force re-render when groups are updated */
  const [groupUpdateCounter, setGroupUpdateCounter] = useState(0);
  /** Track view mode for each group (grid or list) */
  const [groupViewModes, setGroupViewModes] = useState<{ [group: string]: 'grid' | 'list' }>({});
  /** Track description visibility for each group */
  const [groupDescriptionVisibility, setGroupDescriptionVisibility] = useState<{ [group: string]: boolean }>({});
  
  // ===== GROUP MANAGEMENT =====

  // ===== ROUTING =====
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  /** Extract project ID from URL parameters */
  const projectId = searchParams.get('project_id') || searchParams.get('id') || params.id as string;
  
  // ===== SELECTION MODE =====
  /** Whether we're in selection mode for reports */
  const isSelectionMode = searchParams.get('mode') === 'select';
  const returnTo = searchParams.get('returnTo');
  const ungroupedMode = searchParams.get('ungrouped');
  const groupedMode = searchParams.get('grouped');
  
  // ===== SELECTION STATE =====
  /** Selected image IDs for report creation */
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  /** Selected groups for report creation */
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  /** Images with their assigned groups for report */
  const [imagesWithGroups, setImagesWithGroups] = useState<{ [imageId: string]: string }>({});
  /** Current selection mode for group creation */
  const [selectionMode, setSelectionMode] = useState<'disabled' | 'group' | 'ungrouped'>('disabled');

  // ===== SELECTION MODE INITIALIZATION =====
  
  /**
   * Initialize selection mode based on URL parameters
   */
  useEffect(() => {
    if (isSelectionMode && ungroupedMode === 'true') {
      setSelectionMode('ungrouped');
    } else if (isSelectionMode && groupedMode === 'true') {
      setSelectionMode('group');
    } else if (isSelectionMode) {
      setSelectionMode('disabled'); // Default to disabled, user will choose
    }
  }, [isSelectionMode, ungroupedMode, groupedMode]);

  // ===== DATA LOADING =====

  /**
   * Load user authentication and project data on component mount
   */
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

  /**
   * Load all images for the current project
   * Orders by creation date (newest first)
   */
  const loadImages = async () => {
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
      
      setImages(data || []);
    } catch (error: any) {
      setError('Failed to load images: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load images when project ID changes
  useEffect(() => {
    loadImages();
  }, [projectId]);

  // ===== IMAGE UPLOAD HANDLING =====

  /**
   * Handle image upload from the modal
   * @param files - Array of files to upload
   * @param dateTaken - Date when photos were taken
   * @param useFilenameAsDescription - Whether to use filename as description
   * @param groupName - Required group name for this batch
   */
  /**
   * Shared function to upload files to Supabase Storage and database
   * Handles the common upload logic for both new uploads and adding to groups
   */
  const uploadFilesToProject = async (
    files: File[], 
    dateTaken: string, 
    useFilenameAsDescription: boolean, 
    groupName: string
  ): Promise<void> => {
    if (!projectId || !user) return;
    
    setUploadLoading(true);
    setError(null);
    
    try {
      // Process all files in parallel for faster uploads
      const uploadPromises = files.map(async (file) => {
        // Generate unique filename to prevent conflicts
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `project-images/${projectId}/${fileName}`;
        
        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('project-images')
          .upload(filePath, file);
          
        if (uploadError) throw uploadError;
        
        // Get the public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
          .from('project-images')
          .getPublicUrl(filePath);
        
        // Prepare description (use filename if requested)
        let description = '';
        if (useFilenameAsDescription) {
          description = file.name.replace(/\.[^/.]+$/, '');
        }
        
        // Insert image record into database
        const { data: imageData, error: insertError } = await supabase
          .from('project_images')
          .insert({
            project_id: projectId,
            url: publicUrl,
            description: description,
            tag: null,
            user_id: user.id,
            created_at: dateTaken ? new Date(dateTaken).toISOString() : new Date().toISOString(),
            group: [groupName] // Store group name as array for consistency
          })
          .select()
          .single();
          
        if (insertError) throw insertError;
        
        return imageData;
      });
      
      // Wait for all uploads to complete
      const uploadedImages = await Promise.all(uploadPromises);
      
      // Refresh the image list to show new uploads
      await loadImages();
      
      // Show success message based on context
      const isAddingToGroup = groupName !== '';
      const message = isAddingToGroup 
        ? `Successfully added ${files.length} photo${files.length !== 1 ? 's' : ''} to "${groupName}"`
        : `Successfully uploaded ${files.length} photo${files.length !== 1 ? 's' : ''}`;
      
      setSuccessMessage(message);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      setError('Failed to upload images: ' + error.message);
      throw error; // Re-throw so calling functions can handle cleanup
    } finally {
      setUploadLoading(false);
    }
  };

  /**
   * Handle image uploads to the project (new uploads with group name)
   */
  const handleUpload = async (files: File[], dateTaken: string, useFilenameAsDescription: boolean, groupName: string) => {
    try {
      await uploadFilesToProject(files, dateTaken, useFilenameAsDescription, groupName);
      setShowUploadModal(false);
    } catch (error) {
      // Error already handled in uploadFilesToProject
    }
  };

  // ===== IMAGE MANAGEMENT =====

  /**
   * Handle updates to image properties (description, tag, rotation, number)
   */
  const handleImageUpdate = (imageId: string, field: 'description' | 'tag' | 'rotation' | 'number', value: string | any) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, [field]: value } : img
    ));
  };

  /**
   * Handle image removal from the project
   * Deletes both the database record and the storage file
   */
  const handleRemoveImage = async (imageId: string) => {
    try {
      // First, get the image data to find the storage path
      const { data: imageData, error: fetchError } = await supabase
        .from('project_images')
        .select('url')
        .eq('id', imageId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Extract the file path from the URL
      const url = new URL(imageData.url);
      const pathParts = url.pathname.split('/');
      // Find the index of 'project-images' and get everything after it
      const projectImagesIndex = pathParts.findIndex(part => part === 'project-images');
      let storagePath;
      if (projectImagesIndex !== -1) {
        storagePath = pathParts.slice(projectImagesIndex + 1).join('/');
      } else {
        // Fallback: try to extract from the end if the above doesn't work
        storagePath = pathParts.slice(-2).join('/');
      }
      
      // Delete the file from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('project-images')
        .remove([storagePath]);
        
      if (storageError) {
        console.warn('Failed to delete storage file:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
      
      // Delete the database record
      const { error: deleteError } = await supabase
        .from('project_images')
        .delete()
        .eq('id', imageId);
        
      if (deleteError) throw deleteError;
      
      setImages(prev => prev.filter(img => img.id !== imageId));
      setSuccessMessage('Image removed successfully');
    } catch (error: any) {
      setError('Failed to remove image: ' + error.message);
    }
  };

  /**
   * Handle adding photos to an existing group
   */
  const handleAddPhotosToGroup = async (files: File[], dateTaken: string, useFilenameAsDescription: boolean) => {
    try {
      await uploadFilesToProject(files, dateTaken, useFilenameAsDescription, selectedGroupForAdd);
      setShowAddPhotosModal(false);
      setSelectedGroupForAdd('');
    } catch (error) {
      // Error already handled in uploadFilesToProject
    }
  };

  // ===== GROUP MANAGEMENT =====

  /**
   * Handle filter changes from the ImageFilter component
   */
  const handleFilterChange = (newFilteredImages: FilterableImage[]) => {
    // If no filters are applied (all images are shown), set to null
    // If filters are applied, set to the filtered array (even if empty)
    const hasActiveFilters = newFilteredImages.length !== images.length;
    setFilteredImages(hasActiveFilters ? newFilteredImages as ImageItem[] : null);
  };

  /**
   * Group images by their group name for display
   * Falls back to 'Ungrouped' if no group is specified
   */
  const groupedImages = useMemo(() => {
    const groups: { [group: string]: ImageItem[] } = {};
    // Always use filteredImages if it has been set (even if empty), otherwise use all images
    const imagesToGroup = filteredImages !== null ? filteredImages : images;
    
    imagesToGroup.forEach(img => {
      const groupName = Array.isArray(img.group) && img.group.length > 0 ? img.group[0] : 'Ungrouped';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(img);
    });
    return groups;
  }, [images, filteredImages]);

  /**
   * Handle group name changes (business logic)
   * Updates the database and local state when a group name is changed
   */
  const handleGroupNameChange = async (oldGroupName: string, newGroupName: string) => {
    try {
      // Update all images in this group in the database
      const ids = groupedImages[oldGroupName].map(img => img.id);
      const { error } = await supabase
        .from('project_images')
        .update({ group: [newGroupName.trim()] })
        .in('id', ids);
      if (error) throw error;
      
      // Update local state to reflect the change
      setImages(prev => prev.map(img => ids.includes(img.id) ? { ...img, group: [newGroupName.trim()] } : img));
      setSuccessMessage('Group name updated');
      // Force re-render of groups
      setGroupUpdateCounter(prev => prev + 1);
    } catch (error: any) {
      setError('Failed to update group name: ' + error.message);
      throw error; // Re-throw so CollapsibleGroup can handle the failure
    }
  };

  /**
   * Handle group deletion (business logic)
   * Deletes all images in the group from both database and storage
   */
  const handleGroupDelete = async (groupName: string) => {
    try {
      const imagesInGroup = groupedImages[groupName];
      if (!imagesInGroup || imagesInGroup.length === 0) {
        setError('No images found in group to delete');
        return;
      }

      // Delete all images in the group (this will handle both database and storage)
      const deletePromises = imagesInGroup.map(img => handleRemoveImage(img.id));
      await Promise.all(deletePromises);
      
      setSuccessMessage(`Successfully deleted group "${groupName}" and all ${imagesInGroup.length} image${imagesInGroup.length !== 1 ? 's' : ''}`);
    } catch (error: any) {
      setError('Failed to delete group: ' + error.message);
      throw error; // Re-throw so CollapsibleGroup can handle the failure
    }
  };

  /**
   * Get the current view mode for a group (defaults to 'grid')
   */
  const getGroupViewMode = (group: string): 'grid' | 'list' => {
    return groupViewModes[group] || 'grid';
  };

  /**
   * Toggle the view mode for a group
   */
  const toggleGroupViewMode = (group: string) => {
    setGroupViewModes(prev => ({
      ...prev,
      [group]: prev[group] === 'list' ? 'grid' : 'list'
    }));
  };

  /**
   * Get the current description visibility for a group (defaults to true)
   */
  const getGroupDescriptionVisibility = (group: string): boolean => {
    return groupDescriptionVisibility[group] !== false; // Default to true
  };

  /**
   * Toggle the description visibility for a group
   */
  const toggleGroupDescriptionVisibility = (group: string, show: boolean) => {
    setGroupDescriptionVisibility(prev => ({
      ...prev,
      [group]: show
    }));
  };

  // ===== SELECTION HANDLERS =====
  
  /**
   * Toggle selection of an individual image
   */
  const toggleImageSelection = (imageId: string) => {
    // Only allow selection if we're in a selection mode
    if (selectionMode === 'disabled') {
      setError('Please choose "Create Group" or "Select Ungrouped Photos" before selecting images');
      return;
    }
    
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  /**
   * Toggle selection of an entire group
   */
  const toggleGroupSelection = (groupName: string) => {
    // Only allow selection if we're in a selection mode
    if (selectionMode === 'disabled') {
      setError('Please choose "Create Group" or "Select Ungrouped Photos" before selecting images');
      return;
    }
    
    const imagesInGroup = groupedImages[groupName] || [];
    const groupImageIds = new Set(imagesInGroup.map(img => img.id));
    
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      const allSelected = imagesInGroup.every(img => newSet.has(img.id));
      
      if (allSelected) {
        // Deselect all images in the group
        imagesInGroup.forEach(img => newSet.delete(img.id));
      } else {
        // Select all images in the group
        imagesInGroup.forEach(img => newSet.add(img.id));
      }
      return newSet;
    });
  };



  /**
   * Check if all images in a group are selected
   */
  const isGroupFullySelected = (groupName: string) => {
    const imagesInGroup = groupedImages[groupName] || [];
    return imagesInGroup.length > 0 && imagesInGroup.every(img => selectedImageIds.has(img.id));
  };

  /**
   * Check if some images in a group are selected
   */
  const isGroupPartiallySelected = (groupName: string) => {
    const imagesInGroup = groupedImages[groupName] || [];
    const selectedCount = imagesInGroup.filter(img => selectedImageIds.has(img.id)).length;
    return selectedCount > 0 && selectedCount < imagesInGroup.length;
  };

  // ===== RENDER =====

  // Show loading state while project data is being fetched
  if (!project) {
    return (
      <div className="loading-container">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '4rem 2rem' }}>
      {/* Navigation header */}
      <header style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Back button - always show */}
          <div style={{ display: "flex" }}>
            <Link
              href={isSelectionMode ? `/reports/new?project_id=${projectId}` : `/projects/${project.id}`}
              className="text-accent"
              style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}
            >
              ← {isSelectionMode ? 'Back to Report' : 'Back to Project'}
            </Link>
          </div>

          {/* Page title and project info */}
          <div style={{ marginBottom: "0.5rem" }}>
            <h1 style={{ marginBottom: "0.25rem" }}>
              {isSelectionMode ? 'Organize Images for Report' : `${project.project_name ? project.project_name : 'Project'} Images`}
            </h1>
            {isSelectionMode && (
              <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                Create groups or select ungrouped photos to start selecting images
              </p>
            )}
          </div>
          
          {/* Selection mode controls */}
          {isSelectionMode && (
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: "0.5rem"
            }}>
              {/* Group Creation Panel */}
              <GroupCreationPanel
                selectedImageIds={selectedImageIds}
                onImagesWithGroupsChange={setImagesWithGroups}
                isVisible={true}
                onSelectionModeChange={setSelectionMode}
                selectionMode={selectionMode}
                projectId={projectId || ''}
                returnTo={returnTo || ''}
                onError={setError}
                isUngroupedMode={ungroupedMode === 'true'}
                isGroupedMode={groupedMode === 'true'}
              />
            </div>
          )}
        </div>
      </header>
      
      

      {/* Error and success message toasts */}
      {error && (
        <Toast message={error} type="error" />
      )}

      {successMessage && (
        <Toast message={successMessage} type="success" />
      )}

      {/* Main content card */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="card-body">
          {/* Header with upload button */}
          {!isSelectionMode && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1rem' 
            }}>
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn btn-primary"
                disabled={uploadLoading}
              >
                Upload Photos{uploadLoading ? '...' : ''}
              </button>
            </div>
          )}

          {/* Image Filter Component */}
          {images.length > 0 && (
            <ImageFilter
              images={images}
              onFilterChange={handleFilterChange}
              currentUserId={user?.id}
            />
          )}

          {/* Content area - Loading, empty state, or grouped images */}
          {loading ? (
            // Loading spinner
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #2b579a',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem auto'
              }} />
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <p>Loading images...</p>
            </div>
          ) : images.length === 0 ? (
            // Empty state - no images uploaded yet
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem',
              color: 'var(--color-text-secondary)'
            }}>
              <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
                No images uploaded yet
              </p>
              <p style={{ marginBottom: '1.5rem' }}>
                Upload your first photo to get started
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn btn-primary"
              >
                📸 Upload Your First Photo
              </button>
            </div>
          ) : (
            // Grouped images display using CollapsibleGroup component
            <div>
              {/* Show message when filters are applied but no images match */}
              {filteredImages !== null && Object.keys(groupedImages).length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem',
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg-card)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border)',
                  marginBottom: '1rem'
                }}>
                  <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
                    🔍 No images match your current filters
                  </p>
                  <p style={{ marginBottom: '1.5rem' }}>
                    Try adjusting your filter criteria or clear all filters to see all images
                  </p>
                  <button
                    onClick={() => setFilteredImages(null)}
                    className="btn btn-secondary"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
              
              {Object.entries(groupedImages).map(([group, imgs], index) => (
                <CollapsibleGroup
                  key={`${group}-${groupUpdateCounter}`}
                  groupName={group}
                  itemCount={imgs.length}
                  showEditButton={!isSelectionMode}
                  showDeleteButton={!isSelectionMode}
                  onGroupNameChange={handleGroupNameChange}
                  onGroupDelete={handleGroupDelete}
                  defaultOpen={true}
                  showSelectionControls={isSelectionMode}
                  isFullySelected={isGroupFullySelected(group)}
                  isPartiallySelected={isGroupPartiallySelected(group)}
                  onGroupSelectionToggle={toggleGroupSelection}
                >
                  {/* View toggle buttons */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '1rem',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {getGroupViewMode(group) === 'grid' && (
                        <button
                          onClick={() => toggleGroupDescriptionVisibility(group, !getGroupDescriptionVisibility(group))}
                          className={`btn btn-sm ${getGroupDescriptionVisibility(group) ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.875rem' }}
                        >
                          {getGroupDescriptionVisibility(group) ? '📝 Hide Descriptions' : '📝 Show Descriptions'}
                        </button>
                      )}
                      {!isSelectionMode && (
                        <button
                          onClick={() => {
                            setSelectedGroupForAdd(group);
                            setShowAddPhotosModal(true);
                          }}
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '0.875rem' }}
                        >
                          ➕ Add Photos
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => toggleGroupViewMode(group)}
                        className={`btn btn-sm ${getGroupViewMode(group) === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.875rem' }}
                      >
                        📋 List
                      </button>
                      <button
                        onClick={() => toggleGroupViewMode(group)}
                        className={`btn btn-sm ${getGroupViewMode(group) === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.875rem' }}
                      >
                        📊 Grid
                      </button>
                    </div>
                  </div>

                  {/* Render appropriate view based on group view mode */}
                  {getGroupViewMode(group) === 'grid' ? (
                    <ImageGridView
                      images={imgs}
                      onUpdateImage={handleImageUpdate}
                      onRemoveImage={handleRemoveImage}
                      showRotateButton={getGroupDescriptionVisibility(group)}
                      showRemoveButton={!isSelectionMode}
                      showDescriptions={getGroupDescriptionVisibility(group)}
                      showTags={true}
                      currentUserId={user?.id}
                      projectId={projectId}
                      showUserInfo={true}
                      showSelectionControls={isSelectionMode}
                      selectedImageIds={selectedImageIds}
                      onImageSelectionToggle={toggleImageSelection}
                    />
                  ) : (
                    <ImageListView
                      images={imgs}
                      onUpdateImage={handleImageUpdate}
                      onRemoveImage={handleRemoveImage}
                      onShowSuccessMessage={setSuccessMessage}
                      showRotateButton={true}
                      showRemoveButton={!isSelectionMode}
                      currentUserId={user?.id}
                      projectId={projectId}
                      showUserInfo={true}
                      selectionMode={isSelectionMode}
                      selectedImages={selectedImageIds}
                      onToggleSelection={toggleImageSelection}
                    />
                  )}
                </CollapsibleGroup>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      <UploadPhotoModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        loading={uploadLoading}
        progress={uploadLoading ? 'Uploading images...' : ''}
      />

      {/* Add Photos modal */}
      <AddPhotosModal
        isOpen={showAddPhotosModal}
        onClose={() => {
          setShowAddPhotosModal(false);
          setSelectedGroupForAdd('');
        }}
        onUpload={handleAddPhotosToGroup}
        groupName={selectedGroupForAdd}
        loading={uploadLoading}
      />
    </div>
  );
}
