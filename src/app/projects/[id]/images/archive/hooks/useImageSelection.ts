import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExtendedProjectImage } from './useImageData';

interface UseImageSelectionProps {
  filteredImages: ExtendedProjectImage[];
  projectId: string;
  selectionMode?: boolean;
  returnTo?: string | null;
}

interface UseImageSelectionReturn {
  // Selection state
  selectedImages: Set<string>;
  setSelectedImages: React.Dispatch<React.SetStateAction<Set<string>>>;
  
  // Actions
  toggleImageSelection: (imageId: string) => void;
  handleSelectAll: () => void;
  handleDeselectAll: () => void;
  handleConfirmSelection: () => void;
  isImageSelected: (imageId: string) => boolean;
  getSelectedCount: () => number;
}

export function useImageSelection({ 
  filteredImages, 
  projectId, 
  selectionMode = false,
  returnTo 
}: UseImageSelectionProps): UseImageSelectionReturn {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Toggle individual image selection
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

  // Select all filtered images
  const handleSelectAll = () => {
    const allIds = filteredImages.map(img => img.id);
    setSelectedImages(new Set(allIds));
  };

  // Deselect all images
  const handleDeselectAll = () => {
    setSelectedImages(new Set());
  };

  // Confirm selection and navigate to reports
  const handleConfirmSelection = () => {
    if (selectedImages.size === 0) return;
    
    const selectedIds = Array.from(selectedImages);
    const queryParams = new URLSearchParams();
    queryParams.set('images', selectedIds.join(','));
    
    if (returnTo) {
      queryParams.set('returnTo', returnTo);
    }
    
    router.push(`/reports/new?${queryParams.toString()}`);
  };

  // Check if image is selected
  const isImageSelected = (imageId: string): boolean => {
    return selectedImages.has(imageId);
  };

  // Get count of selected images
  const getSelectedCount = (): number => {
    return selectedImages.size;
  };

  return {
    selectedImages,
    setSelectedImages,
    toggleImageSelection,
    handleSelectAll,
    handleDeselectAll,
    handleConfirmSelection,
    isImageSelected,
    getSelectedCount
  };
} 