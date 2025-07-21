import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExtendedProjectImage } from './useImageData';
import { TagValue } from '@/lib/tagConfig';

interface UseImageModalProps {
  projectId: string;
  onSuccessMessage: (message: string) => void;
  onRefreshImages: () => Promise<void>;
}

interface UseImageModalReturn {
  // Modal state
  selectedImage: ExtendedProjectImage | null;
  editMode: boolean;
  editDescription: string;
  editTag: TagValue;
  updateLoading: boolean;
  deleteLoading: string | null;
  
  // Actions
  handleImageClick: (image: ExtendedProjectImage) => void;
  closeModal: () => void;
  handleDelete: (id: string) => Promise<void>;
  handleUpdate: () => Promise<void>;
  setEditMode: (mode: boolean) => void;
  setEditDescription: (description: string) => void;
  setEditTag: (tag: TagValue) => void;
}

export function useImageModal({ 
  projectId, 
  onSuccessMessage,
  onRefreshImages 
}: UseImageModalProps): UseImageModalReturn {
  const [selectedImage, setSelectedImage] = useState<ExtendedProjectImage | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editTag, setEditTag] = useState<TagValue>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Open image detail modal
  const handleImageClick = (image: ExtendedProjectImage) => {
    setSelectedImage(image);
    setEditDescription(image.description || '');
    setEditTag(image.tag);
    setEditMode(false);
  };

  // Close modal and reset edit state
  const closeModal = () => {
    setSelectedImage(null);
    setEditMode(false);
    setEditDescription('');
    setEditTag(null);
  };

  // Delete image
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    
    setDeleteLoading(id);
    try {
      const { error } = await supabase
        .from('project_images')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      onSuccessMessage('Image deleted successfully');
      closeModal();
      await onRefreshImages();
    } catch (error: any) {
      console.error('Error deleting image:', error);
      onSuccessMessage('Failed to delete image');
    } finally {
      setDeleteLoading(null);
    }
  };

  // Update image description and tag
  const handleUpdate = async () => {
    if (!selectedImage) return;
    
    setUpdateLoading(true);
    try {
      const { error } = await supabase
        .from('project_images')
        .update({
          description: editDescription.trim() || null,
          tag: editTag
        })
        .eq('id', selectedImage.id);
        
      if (error) throw error;
      
      onSuccessMessage('Image updated successfully');
      setEditMode(false);
      await onRefreshImages();
    } catch (error: any) {
      console.error('Error updating image:', error);
      onSuccessMessage('Failed to update image');
    } finally {
      setUpdateLoading(false);
    }
  };

  return {
    selectedImage,
    editMode,
    editDescription,
    editTag,
    updateLoading,
    deleteLoading,
    handleImageClick,
    closeModal,
    handleDelete,
    handleUpdate,
    setEditMode,
    setEditDescription,
    setEditTag
  };
} 