import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExtendedProjectImage } from './useImageData';

interface UseImageNumberingProps {
  filteredImages: ExtendedProjectImage[];
  onSuccessMessage: (message: string) => void;
  onRefreshImages: () => Promise<void>;
}

interface UseImageNumberingReturn {
  // Numbering state
  numberingMode: string | null;
  numberingSelection: string[];
  
  // Actions
  updatePhotoNumber: (imageId: string, number: number | null) => Promise<void>;
  startNumberingMode: (groupName: string) => void;
  handleNumberingSelection: (imageId: string) => void;
  completeNumbering: () => Promise<void>;
  cancelNumbering: () => void;
}

export function useImageNumbering({ 
  filteredImages, 
  onSuccessMessage,
  onRefreshImages 
}: UseImageNumberingProps): UseImageNumberingReturn {
  const [numberingMode, setNumberingMode] = useState<string | null>(null);
  const [numberingSelection, setNumberingSelection] = useState<string[]>([]);

  // Update individual photo number in database
  const updatePhotoNumber = async (imageId: string, number: number | null) => {
    try {
      const { error } = await supabase
        .from('project_images')
        .update({ number })
        .eq('id', imageId);
        
      if (error) throw error;
      
      onSuccessMessage('Photo number updated');
    } catch (error: any) {
      console.error('Error updating photo number:', error);
      onSuccessMessage('Failed to update photo number: ' + error.message);
    }
  };

  // Start numbering mode for a group
  const startNumberingMode = (groupName: string) => {
    setNumberingMode(groupName);
    
    // Pre-populate selection with currently-numbered images in order
    const groupImages = filteredImages.filter(img =>
      (groupName === 'ungrouped')
        ? (!img.group || (Array.isArray(img.group) && img.group.length === 0))
        : (img.group && Array.isArray(img.group) && img.group.includes(groupName))
    );
    
    // Sort by current number, then by created_at for unnumbered
    const sorted = [...groupImages].sort((a, b) => {
      if (a.number && b.number) return a.number - b.number;
      if (a.number && !b.number) return -1;
      if (!a.number && b.number) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    setNumberingSelection(sorted.filter(img => typeof img.number === 'number').map(img => img.id));
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
        ? (!img.group || (Array.isArray(img.group) && img.group.length === 0))
        : (img.group && Array.isArray(img.group) && img.group.includes(numberingMode))
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
    
    setNumberingMode(null);
    setNumberingSelection([]);
    onSuccessMessage('Photo numbers updated and reordered!');
    await onRefreshImages();
  };

  // Cancel numbering mode
  const cancelNumbering = () => {
    setNumberingMode(null);
    setNumberingSelection([]);
  };

  return {
    numberingMode,
    numberingSelection,
    updatePhotoNumber,
    startNumberingMode,
    handleNumberingSelection,
    completeNumbering,
    cancelNumbering
  };
} 