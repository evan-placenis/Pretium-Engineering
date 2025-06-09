"use client";
import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase, ProjectImage } from '@/lib/supabase';
import ImageListView, { ImageItem } from '@/components/ImageListView';
import { TagValue, getAllTagOptions, getTagLabel, getTagBadgeClass } from '@/lib/tagConfig';

// Extended interface to track rotation and changes
interface ExtendedProjectImage extends ProjectImage {
  rotation?: number;
  hasChanges?: boolean;
  originalDescription?: string;
  originalTag?: TagValue;
}

export default function ProjectImagesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const selectionMode = searchParams.get('mode') === 'select';
  const returnTo = searchParams.get('returnTo');
  
  const [images, setImages] = useState<ExtendedProjectImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<ExtendedProjectImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ExtendedProjectImage | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editTag, setEditTag] = useState<TagValue>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  
  // New state for view toggle and bulk save
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [saveLoading, setSaveLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Sort state
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'manual'>('desc'); // desc = newest first, asc = oldest first, manual = user reordered
  
  // Selection and filtering state
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [descriptionFilter, setDescriptionFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>(''); // 'all', 'mine', 'others'
  const [reportUsageFilter, setReportUsageFilter] = useState<string>(''); // 'all', 'unused', 'used'
  
  // State for tracking images in reports and current user
  const [imagesInReports, setImagesInReports] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchImages = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
        
        // Fetch project images
        const { data, error } = await supabase
          .from('project_images')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        // Initialize extended properties
        const extendedData = (data || []).map(img => ({
          ...img,
          rotation: 0,
          hasChanges: false,
          originalDescription: img.description,
          originalTag: img.tag
        }));
        
        setImages(extendedData);
        setFilteredImages(extendedData);
        
        // Fetch which images are used in reports
        const { data: reportImagesData, error: reportImagesError } = await supabase
          .from('report_images')
          .select('url')
          .not('url', 'is', null);
          
        if (reportImagesError) {
          console.warn('Could not fetch report images:', reportImagesError);
        } else {
          // Create a set of image URLs that are used in reports
          const usedImageUrls = new Set(reportImagesData?.map(ri => ri.url) || []);
          setImagesInReports(usedImageUrls);
        }
        
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (projectId) fetchImages();
  }, [projectId]);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = images.some(img => img.hasChanges);
    setHasUnsavedChanges(hasChanges);
  }, [images]);

  // Filter images based on criteria
  useEffect(() => {
    let filtered = [...images];
    
    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(img => {
        const imgDate = new Date(img.created_at);
        return imgDate.toDateString() === filterDate.toDateString();
      });
    }
    
    // Tag filter
    if (tagFilter && tagFilter !== 'all') {
      filtered = filtered.filter(img => img.tag === tagFilter);
    }
    
    // Description filter
    if (descriptionFilter) {
      filtered = filtered.filter(img => 
        img.description?.toLowerCase().includes(descriptionFilter.toLowerCase())
      );
    }
    
    // User filter - Now implemented with user_id tracking
    if (userFilter === 'mine' && currentUser) {
      filtered = filtered.filter(img => img.user_id === currentUser.id);
    } else if (userFilter === 'others' && currentUser) {
      filtered = filtered.filter(img => img.user_id !== currentUser.id && img.user_id != null);
    }
    
    // Report usage filter
    if (reportUsageFilter === 'unused') {
      filtered = filtered.filter(img => !imagesInReports.has(img.url));
    } else if (reportUsageFilter === 'used') {
      filtered = filtered.filter(img => imagesInReports.has(img.url));
    }
    
    // Sort by date (only if not manual reordering)
    if (sortOrder === 'desc') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortOrder === 'asc') {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    // If sortOrder is 'manual', preserve the current order (no sorting)
    
    setFilteredImages(filtered);
  }, [images, dateFilter, tagFilter, descriptionFilter, userFilter, reportUsageFilter, imagesInReports, currentUser, sortOrder]);

  // Handle sort order change
  const handleSortChange = () => {
    if (sortOrder === 'desc') {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('manual');
    } else {
      setSortOrder('desc');
    }
  };

  // New functions for list view functionality

  const updateImageInList = (imageId: string, field: 'description' | 'tag' | 'rotation', value: string | 'overview' | 'deficiency' | null | number) => {
    setImages(prev => prev.map(img => {
      if (img.id === imageId) {
        const updated = { ...img, [field]: value };
        
        // Check if this creates a change from original
        const hasDescriptionChange = updated.description !== img.originalDescription;
        const hasTagChange = updated.tag !== img.originalTag;
        updated.hasChanges = hasDescriptionChange || hasTagChange;
        
        return updated;
      }
      return img;
    }));
  };

  const bulkSaveChanges = async () => {
    const changedImages = images.filter(img => img.hasChanges);
    if (changedImages.length === 0) return;

    setSaveLoading(true);
    setError(null);

    try {
      // Update all changed images in parallel
      const updatePromises = changedImages.map(img => 
        supabase
          .from('project_images')
          .update({
            description: img.description,
            tag: img.tag
          })
          .eq('id', img.id)
      );

      const results = await Promise.all(updatePromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} image(s)`);
      }

      // Reset change tracking
      setImages(prev => prev.map(img => ({
        ...img,
        hasChanges: false,
        originalDescription: img.description,
        originalTag: img.tag
      })));

      setSuccessMessage(`Successfully saved changes to ${changedImages.length} image(s)!`);
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (error: any) {
      setError(error.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', ''); // Required for some browsers
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = (e?: React.DragEvent) => {
    if (!e) return;
    // Only clear drag over if we're actually leaving the container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Switch to manual sort mode when user manually reorders
    setSortOrder('manual');

    // Reorder the filtered images array
    const newFilteredImages = [...filteredImages];
    const [draggedItem] = newFilteredImages.splice(draggedIndex, 1);
    newFilteredImages.splice(dropIndex, 0, draggedItem);
    
    setFilteredImages(newFilteredImages);
    
    // Also update the main images array to maintain consistency
    // This is a simple approach - in a more complex app you might want to save order to DB
    const reorderedImages = [...images];
    const draggedImage = filteredImages[draggedIndex];
    const dropImage = filteredImages[dropIndex];
    
    // Find and swap positions in main array
    const draggedMainIndex = reorderedImages.findIndex(img => img.id === draggedImage.id);
    const dropMainIndex = reorderedImages.findIndex(img => img.id === dropImage.id);
    
    if (draggedMainIndex !== -1 && dropMainIndex !== -1) {
      const [draggedMainItem] = reorderedImages.splice(draggedMainIndex, 1);
      reorderedImages.splice(dropMainIndex, 0, draggedMainItem);
      setImages(reorderedImages);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleImageClick = (image: ExtendedProjectImage) => {
    setSelectedImage(image);
    setEditDescription(image.description || '');
    setEditTag(image.tag);
    setEditMode(false);
  };

  const closeModal = () => {
    setSelectedImage(null);
    setEditMode(false);
    setEditDescription('');
    setEditTag(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    setDeleteLoading(id);
    const { error } = await supabase
      .from('project_images')
      .delete()
      .eq('id', id);
    if (error) {
      setError(error.message);
    } else {
      setImages(prev => prev.filter(img => img.id !== id));
      if (selectedImage?.id === id) {
        closeModal();
      }
    }
    setDeleteLoading(null);
  };

  const handleUpdate = async () => {
    if (!selectedImage) return;
    
    setUpdateLoading(true);
    const { error } = await supabase
      .from('project_images')
      .update({
        description: editDescription,
        tag: editTag
      })
      .eq('id', selectedImage.id);

    if (error) {
      setError(error.message);
    } else {
      // Update the local state
      setImages(prev => prev.map(img => 
        img.id === selectedImage.id 
          ? { ...img, description: editDescription, tag: editTag }
          : img
      ));
      setSelectedImage(prev => prev ? { ...prev, description: editDescription, tag: editTag } : null);
      setEditMode(false);
    }
    setUpdateLoading(false);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!currentUser) {
      setError('You must be logged in to upload photos');
      return;
    }

    // Clear any existing messages
    setError(null);
    setSuccessMessage(null);
    
    setUploadLoading(true);

    try {
      const uploadedImages: ExtendedProjectImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${file.name} (${i + 1}/${files.length})`);
        
        if (!file.type.startsWith('image/')) {
          setError(`Skipping ${file.name} - not an image file`);
          continue;
        }

        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${projectId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project-images')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          setError(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('project-images')
          .getPublicUrl(filePath);

        // Save to database
        const { data: imageData, error: dbError } = await supabase
          .from('project_images')
          .insert([
            {
              project_id: projectId,
              url: publicUrl,
              description: '',
              tag: null,
              user_id: currentUser.id
            }
          ])
          .select()
          .single();

        if (dbError) {
          console.error('Database error:', dbError);
          setError(`Failed to save ${file.name} to database: ${dbError.message}`);
          continue;
        }

        uploadedImages.push({
          ...imageData,
          rotation: 0,
          hasChanges: false,
          originalDescription: imageData.description,
          originalTag: imageData.tag
        });
      }

      // Add uploaded images to local state
      if (uploadedImages.length > 0) {
        setImages(prev => [...uploadedImages, ...prev]);
        setSuccessMessage(`Successfully uploaded ${uploadedImages.length} photo${uploadedImages.length !== 1 ? 's' : ''}!`);
        setError(null);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      }

    } catch (error: any) {
      console.error('Unexpected upload error:', error);
      setError('An unexpected error occurred during upload');
    } finally {
      setUploadLoading(false);
      setUploadProgress('');
      // Clear the input
      event.target.value = '';
    }
  };

  // Selection handling functions
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedImages(new Set(filteredImages.map(img => img.id)));
  };

  const handleDeselectAll = () => {
    setSelectedImages(new Set());
  };

  const handleConfirmSelection = () => {
    if (selectedImages.size === 0) {
      setError('Please select at least one image');
      return;
    }
    
    const selectedImageData = filteredImages.filter(img => selectedImages.has(img.id));
    const imageIds = Array.from(selectedImages).join(',');
    
    if (returnTo === 'reports') {
      router.push(`/reports/new?project_id=${projectId}&selected_images=${imageIds}`);
    } else {
      // Default back to project page
      router.push(`/projects/${projectId}`);
    }
  };

  return (
    <div className="container page-content" style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      {/* Fixed Save Button */}
      {hasUnsavedChanges && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: 'var(--color-primary)',
          color: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <span>
            {images.filter(img => img.hasChanges).length} unsaved change(s)
          </span>
          <button
            onClick={bulkSaveChanges}
            disabled={saveLoading}
            className="btn btn-sm"
            style={{
              background: 'white',
              color: 'var(--color-primary)',
              border: 'none',
              fontWeight: 'bold'
            }}
          >
            {saveLoading ? 'Saving...' : 'Save All'}
          </button>
        </div>
      )}

      <h1 style={{ marginBottom: '2rem', color: 'var(--color-primary)' }}>
        {selectionMode ? 'Select Photos for Report' : 'All Project Images'}
      </h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          style={{ color: 'var(--color-primary)' }}
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          ← Back to Project
        </button>
        
        {!selectionMode && (
          <>
            {/* View Toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              <button
                className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('grid')}
              >
                📄 Grid View
              </button>
              <button
                className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('list')}
              >
                📋 List View
              </button>
            </div>
            
            {/* Sort Button */}
            <button
              className="btn btn-secondary"
              onClick={handleSortChange}
              title={
                sortOrder === 'desc' ? 'Currently: Newest First (click for Oldest First)' :
                sortOrder === 'asc' ? 'Currently: Oldest First (click for Manual Order)' :
                'Currently: Manual Order (click for Newest First)'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {sortOrder === 'desc' && '📅↓ Newest First'}
              {sortOrder === 'asc' && '📅↑ Oldest First'} 
              {sortOrder === 'manual' && '📅✋ Manual Order'}
            </button>
            
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
              id="photo-upload-input"
              disabled={uploadLoading}
            />
            <label 
              htmlFor="photo-upload-input"
              className="btn btn-primary"
              style={{ 
                cursor: uploadLoading ? 'not-allowed' : 'pointer',
                opacity: uploadLoading ? 0.6 : 1
              }}
            >
              {uploadLoading ? uploadProgress : '📷 Upload Photos'}
            </label>
          </>
        )}
        
        {selectionMode && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleConfirmSelection}
              disabled={selectedImages.size === 0}
              style={{ marginLeft: 'auto' }}
            >
              Import {selectedImages.size} Selected Photo{selectedImages.size !== 1 ? 's' : ''}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleSelectAll}
            >
              Select All
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDeselectAll}
            >
              Deselect All
            </button>
          </>
        )}
      </div>

      {/* Filter Controls */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-body">
          <h3 style={{ marginBottom: '1rem' }}>Filter Photos</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="form-label" style={{ color: 'var(--color-text)' }}>Filter by Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="form-label" style={{ color: 'var(--color-text)' }}>Filter by Tag</label>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="">All Categories</option>
                {getAllTagOptions().slice(1).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ color: 'var(--color-text)' }}>Filter by User</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="">All Users</option>
                <option value="mine">My Photos Only</option>
                <option value="others">Others' Photos</option>
              </select>
            </div>
            <div>
              <label className="form-label" style={{ color: 'var(--color-text)' }}>Filter by Report Usage</label>
              <select
                value={reportUsageFilter}
                onChange={(e) => setReportUsageFilter(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="">All Photos</option>
                <option value="unused">Not Used in Reports</option>
                <option value="used">Already Used in Reports</option>
              </select>
            </div>
            <div>
              <label className="form-label" style={{ color: 'var(--color-text)' }}>Search Description</label>
              <input
                type="text"
                value={descriptionFilter}
                onChange={(e) => setDescriptionFilter(e.target.value)}
                placeholder="Search in descriptions..."
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setDateFilter('');
                  setTagFilter('');
                  setDescriptionFilter('');
                  setUserFilter('');
                  setReportUsageFilter('');
                }}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%' }}
              >
                Clear Filters
              </button>
            </div>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-light)' }}>
            Showing {filteredImages.length} of {images.length} photos
            {sortOrder !== 'manual' && (
              <span style={{ marginLeft: '0.5rem' }}>
                • Sorted by {sortOrder === 'desc' ? 'newest first' : 'oldest first'}
              </span>
            )}
            {sortOrder === 'manual' && (
              <span style={{ marginLeft: '0.5rem' }}>
                • Custom order (drag to reorder in list view)
              </span>
            )}
          </div>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {successMessage && (
        <div className="alert alert-success" style={{ 
          backgroundColor: 'rgba(40, 167, 69, 0.1)', 
          color: 'var(--color-success)', 
          border: '1px solid rgba(40, 167, 69, 0.3)',
          marginBottom: '1rem'
        }}>
          {successMessage}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-primary)' }}>Loading...</div>
      ) : images.length === 0 ? (
        <div style={{ color: 'var(--color-text-light)' }}>No images found for this project.</div>
      ) : (
        <>
          {/* Grid View (existing) */}
          {viewMode === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {filteredImages.map(img => (
                <div
                  key={img.id}
                  className="card"
                  style={{
                    padding: '1rem',
                    position: 'relative',
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text)',
                    border: selectionMode && selectedImages.has(img.id) 
                      ? '3px solid var(--color-primary)' 
                      : '1px solid var(--color-border-dark)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                  }}
                  onClick={() => selectionMode ? toggleImageSelection(img.id) : handleImageClick(img)}
                >
                  {selectionMode && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '0.5rem',
                        left: '0.5rem',
                        width: '20px',
                        height: '20px',
                        borderRadius: '3px',
                        border: '2px solid var(--color-primary)',
                        backgroundColor: selectedImages.has(img.id) ? 'var(--color-primary)' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2
                      }}
                    >
                      {selectedImages.has(img.id) && (
                        <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>✓</span>
                      )}
                    </div>
                  )}
                  <img
                    src={img.url}
                    alt={img.description || 'Project image'}
                    style={{
                      width: '100%',
                      height: '200px',
                      objectFit: 'cover',
                      borderRadius: '0.25rem',
                      marginBottom: '1rem',
                      background: 'var(--color-primary)',
                      opacity: selectionMode && selectedImages.has(img.id) ? 0.8 : 1,
                      transform: `rotate(${img.rotation || 0}deg)`,
                    }}
                  />
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-light)' }}>
                    {img.description}
                  </div>
                  {img.tag && (
                    <span 
                      className={`badge ${img.tag === 'deficiency' ? 'badge-danger' : 'badge-info'}`}
                      style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}
                    >
                      {img.tag}
                    </span>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>
                    {new Date(img.created_at).toLocaleDateString()}
                    {img.user_id && (
                      <span style={{ marginLeft: '0.5rem' }}>
                        • {img.user_id === currentUser?.id ? (
                          <span style={{ color: 'var(--color-primary)' }}>You</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-lighter)' }}>Other User</span>
                        )}
                      </span>
                    )}
                  </div>
                  {/* Report usage indicator */}
                  {imagesInReports.has(img.url) ? (
                    <div style={{ 
                      fontSize: '0.7rem', 
                      color: 'var(--color-warning)', 
                      backgroundColor: 'rgba(255, 193, 7, 0.1)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      marginBottom: '0.5rem',
                      display: 'inline-block'
                    }}>
                      ✓ Used in Report
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: '0.7rem', 
                      color: 'var(--color-success)', 
                      backgroundColor: 'rgba(40, 167, 69, 0.1)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      marginBottom: '0.5rem',
                      display: 'inline-block'
                    }}>
                      ○ Not Used in Reports
                    </div>
                  )}
                  {!selectionMode && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ 
                        position: 'absolute', 
                        top: '1rem', 
                        right: '1rem', 
                        background: 'var(--color-danger)', 
                        color: 'white', 
                        border: 'none',
                        zIndex: 1
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(img.id);
                      }}
                      disabled={deleteLoading === img.id}
                    >
                      {deleteLoading === img.id ? 'Deleting...' : '×'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* List View (using shared component) */}
          {viewMode === 'list' && (
                          <ImageListView
                images={filteredImages.map(img => ({
                  id: img.id,
                  url: img.url,
                  description: img.description || '',
                  tag: img.tag,
                  created_at: img.created_at,
                  user_id: img.user_id || undefined,
                  hasChanges: img.hasChanges,
                  rotation: img.rotation
                }))}
                onUpdateImage={updateImageInList}
                onRemoveImage={handleDelete}
                showUserInfo={true}
                showRotateButton={true}
                currentUserId={currentUser?.id}
                imagesInReports={imagesInReports}
                selectionMode={selectionMode}
                selectedImages={selectedImages}
                onToggleSelection={toggleImageSelection}
                dragAndDrop={true}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                draggedIndex={draggedIndex}
                dragOverIndex={dragOverIndex}
              />
          )}
        </>
      )}

      {/* Modal */}
      {selectedImage && (
        <div 
          className="modal" 
          style={{ 
            display: 'block',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div 
            className="modal-content"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--color-bg-card)',
              padding: '2rem',
              borderRadius: '0.5rem',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
              minWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Image Details</h3>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--color-text)',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <img
                src={selectedImage.url}
                alt={selectedImage.description || 'Project image'}
                style={{
                  width: '100%',
                  maxHeight: '60vh',
                  objectFit: 'contain',
                  borderRadius: '0.25rem',
                }}
              />
            </div>

            {editMode ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ color: 'var(--color-text)' }}>Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="form-input"
                    rows={3}
                    placeholder="Enter image description..."
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ color: 'var(--color-text)' }}>Tag</label>
                  <select
                    value={editTag || ''}
                    onChange={(e) => setEditTag(e.target.value === '' ? null : e.target.value as 'overview' | 'deficiency')}
                    className="form-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">No tag</option>
                    <option value="overview">Overview</option>
                    <option value="deficiency">Deficiency</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleUpdate}
                    disabled={updateLoading}
                    className="btn btn-primary"
                  >
                    {updateLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: 'var(--color-text)' }}>Description:</strong>
                  <p style={{ margin: '0.5rem 0', color: 'var(--color-text-light)' }}>
                    {selectedImage.description || 'No description'}
                  </p>
                </div>
                {selectedImage.tag && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ color: 'var(--color-text)' }}>Tag:</strong>
                    <span 
                      className={`badge ${selectedImage.tag === 'deficiency' ? 'badge-danger' : 'badge-info'}`}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      {selectedImage.tag}
                    </span>
                  </div>
                )}
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: 'var(--color-text)' }}>Created:</strong>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-light)' }}>
                    {new Date(selectedImage.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="btn btn-secondary"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => handleDelete(selectedImage.id)}
                disabled={deleteLoading === selectedImage.id}
                className="btn btn-danger"
              >
                {deleteLoading === selectedImage.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 