"use client";
import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase, ProjectImage, Project } from '@/lib/supabase';
import ImageListView, { ImageItem } from '@/components/ImageListView';
import DescriptionInput from '@/components/DescriptionInput';
import { TagValue, getAllTagOptions, getTagLabel, getTagBadgeClass } from '@/lib/tagConfig';
import { useViewPreference } from '@/hooks/useViewPreference';
import { useImageManagement } from '@/hooks/useImageManagement';
import Toast from '@/components/Toast';
import UploadPhotoModal from '@/components/UploadPhotoModal';

// Extended interface to track rotation and changes
interface ExtendedProjectImage extends ProjectImage {
  rotation?: number;
  hasChanges?: boolean;
  originalDescription?: string;
  originalTag?: TagValue;
  number?: number | null;
}

/**
 * FUNCTION INDEX - Project Images Page
 * 
 * DATA FETCHING & INITIALIZATION:
 * - fetchProject() - Fetches project details from database
 * - fetchImages() - Fetches all project images and report usage data
 * 
 * IMAGE MANAGEMENT:
 * - handlePhotoUpload() - Handles bulk photo upload with progress tracking
 * - handleDelete() - Deletes individual images with confirmation
 * - handleUpdate() - Updates image description and tag in modal
 * - updateImageInList() - Updates image fields in list view with change tracking
 * 
 * FILTERING & SORTING:
 * - handleSortChange() - Cycles through sort orders (desc/asc/manual)
 * - getAllGroups() - Extracts unique group names from images
 * 
 * SELECTION & GROUPING:
 * - toggleImageSelection() - Toggles individual image selection
 * - handleSelectAll() - Selects all filtered images
 * - handleDeselectAll() - Clears all image selections
 * - handleConfirmSelection() - Confirms selection and navigates to reports
 * - handleSaveGroup() - Creates new group with selected images
 * - handleDeleteGroup() - Removes group from all associated images
 * 
 * GROUP EDITING:
 * - startEditGroup() - Enters edit mode for a specific group
 * - cancelEditGroup() - Cancels group editing mode
 * - saveEditGroup() - Saves group name changes and membership updates
 * 
 * GROUP VIEW MANAGEMENT:
 * - toggleGroupViewMode() - Switches between grid/list view for specific group
 * - getGroupViewMode() - Gets current view mode for a group (defaults to grid)
 * - toggleGroupCollapse() - Toggles collapse state for group display
 * - isGroupCollapsed() - Checks if a group is currently collapsed
 * 
 * PHOTO NUMBERING SYSTEM:
 * - updatePhotoNumber() - Updates individual photo number in database
 * - startNumberingMode() - Enters numbering mode for group/ungrouped photos
 * - handleNumberingSelection() - Toggles photo selection during numbering
 * - completeNumbering() - Assigns sequential numbers to selected photos
 * - cancelNumbering() - Exits numbering mode without saving
 * 
 * UI INTERACTIONS:
 * - handleImageClick() - Opens image detail modal
 * - closeModal() - Closes image detail modal and resets edit state
 * - renderGridWithGroups() - Renders main grid layout with group separators
 * - renderImageCard() - Renders individual image card with all interactive elements
 * 
 * UTILITY FUNCTIONS:
 * - handleShowSuccessMessage() - Displays success toast messages
 * - handleImageUpdate() - Centralized image update handler from hook
 * - updateImageFromAutoSave() - Handles auto-save updates from list view
 */

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
  
  // Use the view preference hook for persistent view state
  const { viewMode, setViewMode, toggleViewMode } = useViewPreference('project-images');
  
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

  // Add project state
  const [project, setProject] = useState<Project | null>(null);

  // Use the shared image management hook
  const { updateImageFromAutoSave, handleImageUpdate, handleShowSuccessMessage } = useImageManagement({
    projectId,
    onSuccessMessage: (message) => setSuccessMessage(message)
  });

  // New state for create group mode
  const [createGroupMode, setCreateGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);

  // State for editing a group
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState<string>('');
  const [editGroupSelected, setEditGroupSelected] = useState<Set<string>>(new Set());
  const [editGroupLoading, setEditGroupLoading] = useState(false);

  // State for individual group view modes
  const [groupViewModes, setGroupViewModes] = useState<{ [key: string]: 'grid' | 'list' }>({});

  // State for collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});

  // State for numbering mode and selected photos for ordering
  const [numberingMode, setNumberingMode] = useState<string | null>(null);
  const [numberingSelection, setNumberingSelection] = useState<string[]>([]);

  // Fetch project info
  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (!error) setProject(data);
    };
    fetchProject();
  }, [projectId]);

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
          originalTag: img.tag,
          number: img.number
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
    
    // Organize grouped photos together at the front
    const groupedImages: ExtendedProjectImage[] = [];
    const ungroupedImages: ExtendedProjectImage[] = [];
    
    // Separate grouped and ungrouped images
    filtered.forEach(img => {
      if (img.group && img.group.length > 0) {
        groupedImages.push(img);
      } else {
        ungroupedImages.push(img);
      }
    });
    
    // Sort grouped images by group name, then by number, then by date within each group
    groupedImages.sort((a, b) => {
      const aGroup = (a.group || [])[0] || '';
      const bGroup = (b.group || [])[0] || '';
      
      // First sort by group name
      if (aGroup !== bGroup) {
        return aGroup.localeCompare(bGroup);
      }
      
      // Then sort by number within the same group (numbered images first, then by number)
      if (a.number && b.number) {
        return a.number - b.number; // Sort by number
      } else if (a.number && !b.number) {
        return -1; // Numbered images first
      } else if (!a.number && b.number) {
        return 1; // Numbered images first
      }
      
      // If neither has a number, sort by date
      if (sortOrder === 'desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortOrder === 'asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
    
    // Sort ungrouped images by number first, then by date
    ungroupedImages.sort((a, b) => {
      if (a.number && b.number) {
        return a.number - b.number; // Sort by number
      } else if (a.number && !b.number) {
        return -1; // Numbered images first
      } else if (!a.number && b.number) {
        return 1; // Numbered images first
      }
      
      // If neither has a number, sort by date
      if (sortOrder === 'desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortOrder === 'asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
    
    // Combine grouped images first, then ungrouped images
    const organizedImages = [...groupedImages, ...ungroupedImages];
    
    setFilteredImages(organizedImages);
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

  const updateImageInList = (imageId: string, field: 'description' | 'tag' | 'rotation' | 'number', value: string | 'overview' | 'deficiency' | null | number) => {
    const update = handleImageUpdate(imageId, field, value);
    setImages(prev => prev.map(img => {
      if (img.id === update.imageId) {
        const updated = { ...img, [update.field]: update.value };
        
        // Check if this creates a change from original
        const hasDescriptionChange = updated.description !== img.originalDescription;
        const hasTagChange = updated.tag !== img.originalTag;
        updated.hasChanges = hasDescriptionChange || hasTagChange;
        
        return updated;
      }
      return img;
    }));
  };

  // Drag and drop handlers
  // const handleDragStart = (e: React.DragEvent, index: number) => { ... }
  // const handleDragOver = (e: React.DragEvent, index: number) => { ... }
  // const handleDragLeave = (e?: React.DragEvent) => { ... }
  // const handleDrop = (e: React.DragEvent, dropIndex: number) => { ... }
  // const handleDragEnd = () => { ... }

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
    setError(null);

    try {
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
        
        // Refresh autocomplete descriptions happens automatically in component
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handlePhotoUpload = async (files: File[], dateTaken: string = '', useFilenameAsDescription: boolean = false) => {
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
      const fileArray = Array.from(files);
      const validFiles = fileArray.filter(file => file.type.startsWith('image/'));
      
      if (validFiles.length === 0) {
        setError('No valid image files selected');
        return;
      }

      // Show initial progress
      setUploadProgress(`Uploading ${validFiles.length} photos...`);

      // Process uploads in parallel with controlled concurrency (10 at a time)
      const BATCH_SIZE = 10;
      const uploadedImages: ExtendedProjectImage[] = [];
      const errors: string[] = [];
      
      for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
        const batch = validFiles.slice(i, i + BATCH_SIZE);
        setUploadProgress(`Uploading batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(validFiles.length/BATCH_SIZE)} (${i + 1}-${Math.min(i + BATCH_SIZE, validFiles.length)} of ${validFiles.length})`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (file) => {
          try {
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
            const filePath = `${projectId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('project-images')
              .upload(filePath, file);

            if (uploadError) {
              throw new Error(`Storage upload failed for ${file.name}: ${uploadError.message}`);
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('project-images')
              .getPublicUrl(filePath);

            return {
              file,
              publicUrl,
              filePath
            };
          } catch (error: any) {
            errors.push(error.message);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const successfulUploads = batchResults.filter(result => result !== null);

        // Batch database inserts for successful uploads
        if (successfulUploads.length > 0) {
          const insertData = successfulUploads.map(result => {
            // Generate description from filename if enabled
            let description = '';
            if (useFilenameAsDescription) {
              const filename = result!.file.name;
              description = filename.replace(/\.[^/.]+$/, ''); // Remove file extension
            }

            return {
              project_id: projectId,
              url: result!.publicUrl,
              description: description,
              tag: null,
              created_at: dateTaken ? new Date(dateTaken).toISOString() : new Date().toISOString(), // Use selected date or current date
              user_id: currentUser.id
            };
          });

          const { data: imageDataArray, error: dbError } = await supabase
            .from('project_images')
            .insert(insertData)
            .select();

          if (dbError) {
            console.error('Database batch insert error:', dbError);
            errors.push(`Database save failed for batch: ${dbError.message}`);
          } else if (imageDataArray) {
            // Add to uploaded images array
            imageDataArray.forEach(imageData => {
              uploadedImages.push({
                ...imageData,
                rotation: 0,
                hasChanges: false,
                originalDescription: imageData.description,
                originalTag: imageData.tag,
                number: imageData.number
              });
            });
          }
        }
      }

      // Add uploaded images to local state
      if (uploadedImages.length > 0) {
        setImages(prev => [...uploadedImages, ...prev]);
        
        const successMsg = `Successfully uploaded ${uploadedImages.length} photo${uploadedImages.length !== 1 ? 's' : ''}!`;
        const errorMsg = errors.length > 0 ? ` (${errors.length} failed)` : '';
        setSuccessMessage(successMsg + errorMsg);
        
        // Clear success message after 5 seconds for batch uploads
        setTimeout(() => setSuccessMessage(null), 5000);
      }

      // Show errors if any
      if (errors.length > 0 && uploadedImages.length === 0) {
        setError(`All uploads failed. First error: ${errors[0]}`);
      } else if (errors.length > 0) {
        console.warn('Some uploads failed:', errors);
      }

    } catch (error: any) {
      console.error('Unexpected upload error:', error);
      setError('An unexpected error occurred during upload');
    } finally {
      setUploadLoading(false);
      setUploadProgress('');
      setShowUploadModal(false); // Close modal after upload
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

  // Helper to get all unique groups
  const getAllGroups = (images: ExtendedProjectImage[]) => {
    const groupSet = new Set<string>();
    images.forEach(img => {
      (img.group || []).forEach(g => groupSet.add(g));
    });
    return Array.from(groupSet);
  };

  const allGroups = getAllGroups(images);

  // Delete group handler
  const handleDeleteGroup = async (groupToDelete: string) => {
    setUploadLoading(true);
    setError(null);
    try {
      // Remove group from all images in Supabase
      const imagesWithGroup = images.filter(img => (img.group || []).includes(groupToDelete));
      const updates = imagesWithGroup.map(async img => {
        const newGroups = (img.group || []).filter(g => g !== groupToDelete);
        await supabase
          .from('project_images')
          .update({ group: newGroups })
          .eq('id', img.id);
        return { ...img, group: newGroups };
      });
      const updatedImages = await Promise.all(updates);
      // Update local state
      setImages(prev => prev.map(img => {
        const updated = updatedImages.find(u => u.id === img.id);
        return updated ? updated : img;
      }));
      setFilteredImages(prev => prev.map(img => {
        const updated = updatedImages.find(u => u.id === img.id);
        return updated ? updated : img;
      }));
      setSuccessMessage(`Deleted group "${groupToDelete}" from ${imagesWithGroup.length} photo(s)`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete group');
    } finally {
      setUploadLoading(false);
    }
  };

  // Update handleSaveGroup to add group to array
  const handleSaveGroup = async () => {
    if (!groupName.trim() || selectedImages.size === 0) return;
    setUploadLoading(true);
    setError(null);
    try {
      const selectedImageIds = Array.from(selectedImages);
      // For each selected image, add group if not present
      const imagesToUpdate = images.filter(img => selectedImages.has(img.id));
      const updates = imagesToUpdate.map(async img => {
        const groups = Array.isArray(img.group) ? [...img.group] : (img.group ? [img.group] : []);
        if (!groups.includes(groupName.trim())) groups.push(groupName.trim());
        await supabase
          .from('project_images')
          .update({ group: groups })
          .eq('id', img.id);
        return { ...img, group: groups };
      });
      const updatedImages = await Promise.all(updates);
      setImages(prev => prev.map(img => {
        const updated = updatedImages.find(u => u.id === img.id);
        return updated ? updated : img;
      }));
      setFilteredImages(prev => prev.map(img => {
        const updated = updatedImages.find(u => u.id === img.id);
        return updated ? updated : img;
      }));
      setSuccessMessage(`Grouped ${selectedImages.size} photo(s) as "${groupName.trim()}"`);
      setCreateGroupMode(false);
      setGroupName('');
      setSelectedImages(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setUploadLoading(false);
    }
  };

  // Start editing a group
  const startEditGroup = (groupName: string) => {
    setEditingGroup(groupName);
    setEditGroupName(groupName);
    // Initialize selected images with all images in this group
    const groupImages = filteredImages.filter(img => img.group && img.group.includes(groupName));
    setEditGroupSelected(new Set(groupImages.map(img => img.id)));
    // Auto-switch to grid view for better editing experience
    setGroupViewModes(prev => ({
      ...prev,
      [groupName]: 'grid'
    }));
  };

  // Cancel editing
  const cancelEditGroup = () => {
    setEditingGroup(null);
    setEditGroupName('');
    setEditGroupSelected(new Set());
  };

  // Save group edits
  const saveEditGroup = async () => {
    if (!editGroupName.trim() || !editingGroup) return;
    
    setEditGroupLoading(true);
    try {
      // Update the group name for all selected images
      const { error } = await supabase
        .from('project_images')
        .update({ group: [editGroupName] })
        .in('id', Array.from(editGroupSelected));
        
      if (error) throw error;
      
      // Update local state
      setImages(prev => prev.map(img => {
        if (editGroupSelected.has(img.id)) {
          return { ...img, group: [editGroupName] };
        }
        return img;
      }));
      
      setEditingGroup(null);
      setEditGroupName('');
      setEditGroupSelected(new Set());
      
    } catch (error: any) {
      setError('Failed to update group: ' + error.message);
    } finally {
      setEditGroupLoading(false);
    }
  };

  // Function to toggle view mode for a specific group
  const toggleGroupViewMode = (groupName: string) => {
    setGroupViewModes(prev => ({
      ...prev,
      [groupName]: prev[groupName] === 'list' ? 'grid' : 'list'
    }));
  };

  // Function to get view mode for a group (defaults to 'grid')
  const getGroupViewMode = (groupName: string): 'grid' | 'list' => {
    return groupViewModes[groupName] || 'grid';
  };

  // Function to toggle group collapse state
  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Function to check if a group is collapsed
  const isGroupCollapsed = (groupName: string): boolean => {
    return collapsedGroups[groupName] || false;
  };

  // Function to update photo number
  const updatePhotoNumber = async (imageId: string, number: number | null) => {
    try {
      const { error } = await supabase
        .from('project_images')
        .update({ number })
        .eq('id', imageId);
        
      if (error) throw error;
      
      // Update local state
      setImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, number } : img
      ));
      
      setSuccessMessage('Photo number updated');
    } catch (error: any) {
      setError('Failed to update photo number: ' + error.message);
    }
  };

  // Start numbering mode for a group
  const startNumberingMode = (groupName: string) => {
    setNumberingMode(groupName);
    // Pre-populate selection with currently-numbered images in order
    const groupImages = filteredImages.filter(img =>
      (groupName === 'ungrouped')
        ? (!img.group || img.group.length === 0)
        : (img.group && img.group.includes(groupName))
    );
    // Sort by current number, then by created_at for unnumbered
    const sorted = [...groupImages].sort((a, b) => {
      if (a.number && b.number) return a.number - b.number;
      if (a.number && !b.number) return -1;
      if (!a.number && b.number) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    setNumberingSelection(sorted.filter(img => typeof img.number === 'number').map(img => img.id));
    setGroupViewModes(prev => ({ ...prev, [groupName]: 'grid' }));
  };

  // Toggle selection for numbering
  const handleNumberingSelection = (imageId: string) => {
    setNumberingSelection(prev =>
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  // Complete numbering: assign numbers 1,2,3... to selected, clear all others in group
  const completeNumbering = async () => {
    if (!numberingMode) return;
    // Get all images in this group
    const groupImages = filteredImages.filter(img =>
      (numberingMode === 'ungrouped')
        ? (!img.group || img.group.length === 0)
        : (img.group && img.group.includes(numberingMode))
    );
    // Assign numbers to selected in order, clear all others
    const updates = groupImages.map(img => {
      const idx = numberingSelection.indexOf(img.id);
      return {
        id: img.id,
        number: idx !== -1 ? idx + 1 : null
      };
    });
    // Update DB and local state
    for (const update of updates) {
      await updatePhotoNumber(update.id, update.number);
    }
    setImages(prev => prev.map(img => {
      const found = updates.find(u => u.id === img.id);
      return found ? { ...img, number: found.number } : img;
    }));
    setNumberingMode(null);
    setNumberingSelection([]);
    setSuccessMessage('Photo numbers updated and reordered!');
  };

  // Cancel numbering mode
  const cancelNumbering = () => {
    setNumberingMode(null);
    setNumberingSelection([]);
  };

  // Function to render grid with group separators
  const renderGridWithGroups = (): JSX.Element => {
    const groups: { [key: string]: ExtendedProjectImage[] } = {};
    const ungroupedImages: ExtendedProjectImage[] = [];
    
    filteredImages.forEach(img => {
      if (img.group && img.group.length > 0) {
        const groupName = img.group[0];
        if (!groups[groupName]) {
          groups[groupName] = [];
        }
        groups[groupName].push(img);
      } else {
        ungroupedImages.push(img);
      }
    });
    
    // If editing a group, show checkboxes for all photos, but keep grid layout the same
    const isEditing = !!editingGroup;

    return (
      <div>
        {Object.entries(groups).map(([groupName, groupImages]) => {
          const groupViewMode = getGroupViewMode(groupName);
          const isCollapsed = isGroupCollapsed(groupName);
          
          return (
            <div key={groupName} style={{ marginBottom: '2rem' }}>
              {/* Group header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                borderLeft: '4px solid #3b82f6'
              }}>
                {editingGroup === groupName ? (
                  <>
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={e => setEditGroupName(e.target.value)}
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: '#1e40af',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        marginRight: '1rem',
                        minWidth: '200px'
                      }}
                      disabled={editGroupLoading}
                    />
                    <button
                      className="btn btn-success btn-sm"
                      style={{ marginLeft: '0.5rem' }}
                      onClick={saveEditGroup}
                      disabled={editGroupLoading || !editGroupName.trim()}
                    >
                      {editGroupLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: '0.5rem' }}
                      onClick={cancelEditGroup}
                      disabled={editGroupLoading}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {/* Collapse/Expand button */}
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => toggleGroupCollapse(groupName)}
                      style={{ 
                        marginRight: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.875rem',
                        minWidth: 'auto'
                      }}
                      title={isCollapsed ? 'Expand group' : 'Collapse group'}
                    >
                      {isCollapsed ? '▶️' : '▼️'}
                    </button>
                    
                    <h3 style={{ 
                      margin: 0, 
                      color: '#1e40af', 
                      fontSize: '1.1rem',
                      fontWeight: '600'
                    }}>
                      📁 {groupName}
                    </h3>
                    <span style={{ 
                      marginLeft: '1.5rem', 
                      color: '#64748b', 
                      fontSize: '0.875rem' 
                    }}>
                      {groupImages.length} photo{groupImages.length !== 1 ? 's' : ''}
                    </span>
                    
                    {/* Grid/List toggle buttons - only show when not collapsed */}
                    {!isCollapsed && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        <button
                          className={`btn btn-sm ${groupViewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleGroupViewMode(groupName)}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          📊 Grid
                        </button>
                        <button
                          className={`btn btn-sm ${groupViewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => toggleGroupViewMode(groupName)}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          📋 List
                        </button>
                        {numberingMode === groupName ? (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={completeNumbering}
                              disabled={numberingSelection.length === 0}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              ✅ Done ({numberingSelection.length})
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={cancelNumbering}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              ❌ Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => startNumberingMode(groupName)}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              🔢 Number
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => {
                                const numberedImages = groupImages.filter(img => img.number);
                                if (numberedImages.length === 0) {
                                  setSuccessMessage(`No photos in "${groupName}" are numbered!`);
                                  return;
                                }
                                
                                if (confirm(`Clear numbers from ${numberedImages.length} photos in "${groupName}"?`)) {
                                  numberedImages.forEach(img => {
                                    updatePhotoNumber(img.id, null);
                                  });
                                  setSuccessMessage(`Cleared numbers from ${numberedImages.length} photos in "${groupName}"`);
                                }
                              }}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              🗑️ Clear Numbers
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginLeft: isCollapsed ? 'auto' : '1rem' }}
                      onClick={() => startEditGroup(groupName)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: '0.5rem' }}
                      onClick={() => handleDeleteGroup(groupName)}
                      disabled={uploadLoading}
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
              
              {/* Group images - render based on view mode and collapse state */}
              {!isCollapsed && (
                groupViewMode === 'grid' ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '2rem',
                    marginBottom: '1rem'
                  }}>
                    {groupImages.map(img => renderImageCard(img, false, isEditing))}
                  </div>
                ) : (
                  <ImageListView
                    images={groupImages.map(img => ({
                      id: img.id,
                      url: img.url,
                      description: img.description || '',
                      tag: img.tag,
                      created_at: img.created_at,
                      user_id: img.user_id || undefined,
                      hasChanges: img.hasChanges,
                      rotation: img.rotation,
                      number: img.number
                    }))}
                    onUpdateImage={(imageId, field, value) => {
                      const update = handleImageUpdate(imageId, field, value);
                      setImages(prev => prev.map(img => {
                        if (img.id === update.imageId) {
                          const updated = { ...img, [update.field]: update.value };
                          
                          // Check if this creates a change from original
                          const hasDescriptionChange = updated.description !== img.originalDescription;
                          const hasTagChange = updated.tag !== img.originalTag;
                          updated.hasChanges = hasDescriptionChange || hasTagChange;
                          
                          return updated;
                        }
                        return img;
                      }));
                    }}
                    onAutoSaveUpdate={updateImageFromAutoSave}
                    onShowSuccessMessage={handleShowSuccessMessage}
                    onRemoveImage={handleDelete}
                    showUserInfo={true}
                    showRotateButton={true}
                    currentUserId={currentUser?.id}
                    projectId={projectId}
                    imagesInReports={imagesInReports}
                    selectionMode={selectionMode}
                    selectedImages={selectedImages}
                    onToggleSelection={toggleImageSelection}
                  />
                )
              )}
            </div>
          );
        })}
        
        {/* Render ungrouped images */}
        {ungroupedImages.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              borderLeft: '4px solid #94a3b8'
            }}>
              {/* Collapse/Expand button for ungrouped */}
              <button
                className="btn btn-sm btn-outline"
                onClick={() => toggleGroupCollapse('ungrouped')}
                style={{ 
                  marginRight: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.875rem',
                  minWidth: 'auto'
                }}
                title={isGroupCollapsed('ungrouped') ? 'Expand ungrouped photos' : 'Collapse ungrouped photos'}
              >
                {isGroupCollapsed('ungrouped') ? '▶️' : '▼️'}
              </button>
              
              <h3 style={{ 
                margin: 0, 
                color: '#475569', 
                fontSize: '1.1rem',
                fontWeight: '600'
              }}>
                📷 Ungrouped Photos
              </h3>
              <span style={{ 
                marginLeft: '1.5rem', 
                color: '#64748b', 
                fontSize: '0.875rem' 
              }}>
                {ungroupedImages.length} photo{ungroupedImages.length !== 1 ? 's' : ''}
              </span>
              
              {/* Grid/List toggle buttons for ungrouped - only show when not collapsed */}
              {!isGroupCollapsed('ungrouped') && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={`btn btn-sm ${getGroupViewMode('ungrouped') === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleGroupViewMode('ungrouped')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    📊 Grid
                  </button>
                  <button
                    className={`btn btn-sm ${getGroupViewMode('ungrouped') === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleGroupViewMode('ungrouped')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    📋 List
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      // Number all ungrouped photos starting from 1
                      ungroupedImages.forEach((img, index) => {
                        updatePhotoNumber(img.id, index + 1);
                      });
                      setSuccessMessage(`Numbered ${ungroupedImages.length} ungrouped photos starting from 1`);
                    }}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    🔢 Number
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      const numberedImages = ungroupedImages.filter(img => img.number);
                      if (numberedImages.length === 0) {
                        setSuccessMessage('No ungrouped photos are numbered!');
                        return;
                      }
                      
                      if (confirm(`Clear numbers from ${numberedImages.length} ungrouped photos?`)) {
                        numberedImages.forEach(img => {
                          updatePhotoNumber(img.id, null);
                        });
                        setSuccessMessage(`Cleared numbers from ${numberedImages.length} ungrouped photos`);
                      }
                    }}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    🗑️ Clear Numbers
                  </button>
                </div>
              )}
              
              {createGroupMode && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: isGroupCollapsed('ungrouped') ? 'auto' : '1rem' }}
                  onClick={() => {
                    const allIds = ungroupedImages.map(img => img.id);
                    const allSelected = allIds.every(id => selectedImages.has(id));
                    setSelectedImages(prev => {
                      const newSet = new Set(prev);
                      if (allSelected) {
                        // Deselect all
                        allIds.forEach(id => newSet.delete(id));
                      } else {
                        // Select all
                        allIds.forEach(id => newSet.add(id));
                      }
                      return newSet;
                    });
                  }}
                >
                  {ungroupedImages.every(img => selectedImages.has(img.id)) ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            
            {/* Ungrouped images - render based on view mode and collapse state */}
            {!isGroupCollapsed('ungrouped') && (
              getGroupViewMode('ungrouped') === 'grid' ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '2rem'
                }}>
                  {ungroupedImages.map(img => renderImageCard(img, true, isEditing))}
                </div>
              ) : (
                <ImageListView
                  images={ungroupedImages.map(img => ({
                    id: img.id,
                    url: img.url,
                    description: img.description || '',
                    tag: img.tag,
                    created_at: img.created_at,
                    user_id: img.user_id || undefined,
                    hasChanges: img.hasChanges,
                    rotation: img.rotation,
                    number: img.number
                  }))}
                  onUpdateImage={(imageId, field, value) => {
                    const update = handleImageUpdate(imageId, field, value);
                    setImages(prev => prev.map(img => {
                      if (img.id === update.imageId) {
                        const updated = { ...img, [update.field]: update.value };
                        
                        // Check if this creates a change from original
                        const hasDescriptionChange = updated.description !== img.originalDescription;
                        const hasTagChange = updated.tag !== img.originalTag;
                        updated.hasChanges = hasDescriptionChange || hasTagChange;
                        
                        return updated;
                      }
                      return img;
                    }));
                  }}
                  onAutoSaveUpdate={updateImageFromAutoSave}
                  onShowSuccessMessage={handleShowSuccessMessage}
                  onRemoveImage={handleDelete}
                  showUserInfo={true}
                  showRotateButton={true}
                  currentUserId={currentUser?.id}
                  projectId={projectId}
                  imagesInReports={imagesInReports}
                  selectionMode={selectionMode}
                  selectedImages={selectedImages}
                  onToggleSelection={toggleImageSelection}
                />
              )
            )}
          </div>
        )}
      </div>
    );
  };

  // Function to render individual image card
  const renderImageCard = (img: ExtendedProjectImage, showGroupBadges: boolean = false, editGroupMode: boolean = false) => {
    // If in edit group mode, use editGroupSelected for selection
    const isSelected = editGroupMode ? editGroupSelected.has(img.id) : selectedImages.has(img.id);
    // Numbering mode logic
    const isNumbering = numberingMode !== null && (
      (img.group && img.group.includes(numberingMode)) || (numberingMode === 'ungrouped' && (!img.group || img.group.length === 0))
    );
    const numberingIndex = numberingSelection.indexOf(img.id);
    const isNumberingSelected = numberingIndex !== -1;
    const isNumbered = typeof img.number === 'number';
    const handleSelect = () => {
      if (editGroupMode) {
        setEditGroupSelected(prev => {
          const newSet = new Set(prev);
          if (newSet.has(img.id)) {
            newSet.delete(img.id);
          } else {
            newSet.add(img.id);
          }
          return newSet;
        });
      } else if (isNumbering) {
        handleNumberingSelection(img.id);
      } else {
        toggleImageSelection(img.id);
      }
    };
    return (
      <div
        key={img.id}
        style={{
          border: isNumberingSelected ? '2px solid #2563eb' : '1px solid var(--color-border)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          backgroundColor: isNumberingSelected ? 'rgba(37,99,235,0.08)' : 'var(--color-bg-card)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        }}
        onClick={() => {
          if (isNumbering) {
            handleNumberingSelection(img.id);
          } else {
            handleImageClick(img);
          }
        }}
      >
        {/* Selection checkbox */}
        {(selectionMode || createGroupMode || editGroupMode) && (
          <div style={{
            position: 'absolute',
            top: '0.75rem',
            left: '0.75rem',
            zIndex: 10
          }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleSelect}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '1.5rem',
                height: '1.5rem',
                cursor: 'pointer',
                accentColor: 'var(--color-primary)'
              }}
            />
          </div>
        )}
        {/* Number badge: show selection order if in numbering mode and selected, otherwise permanent number */}
        {isNumbering && isNumberingSelected ? (
          <div style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            zIndex: 10
          }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: '600',
              border: '2px solid #fff',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}>
              {numberingIndex + 1}
            </div>
          </div>
        ) : (
          img.number && (
            <div style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              zIndex: 10
            }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: '600',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
              }}>
                {img.number}
              </div>
            </div>
          )
        )}
        {/* Group badges */}
        {showGroupBadges && Array.isArray(img.group) && img.group.map(g => (
          <div key={g} style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            background: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 500,
            zIndex: 10,
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
          }}>
            {g}
          </div>
        ))}

        {/* Image - much larger now */}
        <div style={{ 
          position: 'relative', 
          aspectRatio: '4/3', 
          overflow: 'hidden',
          backgroundColor: '#f8fafc'
        }}>
          <img
            src={img.url}
            alt={img.description || 'Project image'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: img.rotation ? `rotate(${img.rotation}deg)` : 'none',
              transition: 'transform 0.3s ease'
            }}
          />
        </div>

        {/* Image info - more compact and elegant */}
        <div style={{ 
          padding: '1rem', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {/* Description */}
          {img.description && (
            <p style={{
              margin: 0,
              fontSize: '0.875rem',
              color: 'var(--color-text)',
              lineHeight: '1.4',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontWeight: 500
            }}>
              {img.description}
            </p>
          )}
          
          {/* Tags and metadata row */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: 'auto'
          }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--color-text-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>{new Date(img.created_at).toLocaleDateString()}</span>
              {img.user_id && (
                <span style={{ 
                  color: img.user_id === currentUser?.id ? 'var(--color-primary)' : 'var(--color-text-lighter)',
                  fontWeight: img.user_id === currentUser?.id ? '500' : 'normal'
                }}>
                  {img.user_id === currentUser?.id ? 'You' : 'Other'}
                </span>
              )}
            </div>
            
            {/* Tag badge */}
            {img.tag && (
              <span className={`badge ${getTagBadgeClass(img.tag)}`} style={{ 
                fontSize: '0.7rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px'
              }}>
                {getTagLabel(img.tag)}
              </span>
            )}
          </div>
          
          {/* Report usage indicator */}
          <div style={{ 
            fontSize: '0.7rem', 
            color: imagesInReports.has(img.url) ? 'var(--color-warning)' : 'var(--color-success)',
            backgroundColor: imagesInReports.has(img.url) ? 'rgba(255, 193, 7, 0.1)' : 'rgba(40, 167, 69, 0.1)',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            display: 'inline-block',
            alignSelf: 'flex-start',
            fontWeight: 500
          }}>
            {imagesInReports.has(img.url) ? '✓ Used in Report' : '○ Not Used'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container page-content" style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '2rem', color: 'var(--color-primary)' }}>
        {project?.project_name || 'Project'}: Images Database
      </h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          style={{ color: 'var(--color-primary)' }}
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          ← Back to Project
        </button>
        
        {selectionMode && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleConfirmSelection}
              disabled={selectedImages.size === 0}
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
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
          {!selectionMode && (
            <button
              className="btn btn-primary"
              onClick={() => setShowUploadModal(true)}
              disabled={uploadLoading}
              style={{ 
                cursor: uploadLoading ? 'not-allowed' : 'pointer',
                opacity: uploadLoading ? 0.6 : 1
              }}
            >
              {uploadLoading ? uploadProgress : '📷 Upload Photos'}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => setCreateGroupMode(true)}
            style={{ fontWeight: 600 }}
          >
            Create Group
          </button>
        </div>
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
          </div>
        </div>
      </div>
      
      {error && (
        <Toast message={error} type="error" />
      )}

      <Toast message={successMessage} type="success" />

      {loading ? (
        <div style={{ color: 'var(--color-primary)' }}>Loading...</div>
      ) : images.length === 0 ? (
        <div style={{ color: 'var(--color-text-light)' }}>No images found for this project.</div>
      ) : (
        <>
         
          {createGroupMode && (
            <div style={{ marginBottom: '2rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
              <h3 style={{ marginBottom: '1rem' }}>Create a New Group</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  style={{ padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px', minWidth: '200px' }}
                />
                <button
                  className="btn btn-success"
                  onClick={handleSaveGroup}
                  disabled={!groupName.trim() || selectedImages.size === 0 || uploadLoading}
                >
                  {uploadLoading ? 'Saving...' : `Save Group (${selectedImages.size} selected)`}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setCreateGroupMode(false); setGroupName(''); setSelectedImages(new Set()); }}
                  disabled={uploadLoading}
                >
                  Cancel
                </button>
              </div>
              <div style={{ color: '#888', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                Select photos below to add to this group.
              </div>
            </div>
          )}
          
          {/* Always render in grid view with groups */}
          {renderGridWithGroups()}
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
                src={selectedImage?.url}
                alt={selectedImage?.description || 'Project image'}
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
                  <DescriptionInput
                    value={editDescription}
                    onChange={setEditDescription}
                    placeholder="Enter image description..."
                    style={{ minHeight: '120px' }}
                    userId={currentUser?.id}
                    projectId={projectId}
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
                    {selectedImage?.description || 'No description'}
                  </p>
                </div>
                {selectedImage?.tag && (
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
                    {selectedImage?.created_at ? new Date(selectedImage.created_at).toLocaleString() : 'Unknown'}
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
                onClick={() => selectedImage && handleDelete(selectedImage.id)}
                disabled={deleteLoading === selectedImage?.id}
                className="btn btn-danger"
              >
                {deleteLoading === selectedImage?.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Photo Modal */}
      <UploadPhotoModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handlePhotoUpload}
        loading={uploadLoading}
        progress={uploadProgress}
      />
    </div>
  );
} 