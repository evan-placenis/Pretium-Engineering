import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ImageItem } from '@/components/ImageListView';
import { TagValue } from '@/lib/tagConfig';

interface UseImageManagementProps {
  projectId?: string;
  onSuccessMessage?: (message: string) => void;
}

interface ImageUpdate {
  imageId: string;
  field: 'description' | 'tag' | 'rotation';
  value: string | TagValue | number;
}

interface UseImageManagementReturn {
  updateImageFromAutoSave: (imageId: string, description: string) => void;
  handleImageUpdate: (imageId: string, field: 'description' | 'tag' | 'rotation', value: string | TagValue | number) => ImageUpdate;
  handleShowSuccessMessage: (message: string) => void;
}

export function useImageManagement({ projectId, onSuccessMessage }: UseImageManagementProps): UseImageManagementReturn {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle auto-save callback from ImageListView
  const updateImageFromAutoSave = (imageId: string, description: string) => {
    console.log('Auto-save update received:', { imageId, description });
    
    // Invalidate the description cache for this project
    if (projectId && (window as any).invalidateDescriptionCache) {
      (window as any).invalidateDescriptionCache(projectId);
    }
  };

  // Handle success message display
  const handleShowSuccessMessage = (message: string) => {
    console.log('Showing success message:', message);
    setSuccessMessage(message);
    if (onSuccessMessage) {
      onSuccessMessage(message);
    }
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Generic image update handler
  const handleImageUpdate = (imageId: string, field: 'description' | 'tag' | 'rotation', value: string | TagValue | number): ImageUpdate => {
    console.log('Image update:', { imageId, field, value });
    return { imageId, field, value };
  };

  return {
    updateImageFromAutoSave,
    handleImageUpdate,
    handleShowSuccessMessage
  };
} 