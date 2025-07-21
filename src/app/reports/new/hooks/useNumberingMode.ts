import { useState } from 'react';

import { type ImageItem } from '@/components/image_components';

interface ExtendedImageItem extends ImageItem {
  group?: string[];
  number?: number | null;
}

interface UseNumberingModeProps {
  selectedImages: ExtendedImageItem[];
  setSelectedImages: (images: ExtendedImageItem[]) => void;
  groupNumberingStates: { [groupName: string]: boolean };
  setGroupNumberingStates: (states: { [groupName: string]: boolean } | ((prev: { [groupName: string]: boolean }) => { [groupName: string]: boolean })) => void;
}

export function useNumberingMode({ 
  selectedImages, 
  setSelectedImages, 
  groupNumberingStates, 
  setGroupNumberingStates 
}: UseNumberingModeProps) {
  const [numberingMode, setNumberingMode] = useState<string | null>(null);
  const [numberingSelection, setNumberingSelection] = useState<string[]>([]);

  // Start numbering mode for a group (clears all existing numbers first)
  const startNumberingMode = (groupName: string) => {
    // Clear all existing numbers in this group
    const updatedImages = selectedImages.map(img => {
      if (img.group && img.group.length > 0 && img.group[0] === groupName) {
        return { ...img, number: null };
      }
      return img;
    });
    setSelectedImages(updatedImages);
    
    setNumberingMode(groupName);
    setNumberingSelection([]);
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
  const completeNumbering = (groupName: string) => {
    // Update the selectedImages with new numbering
    const updatedImages = selectedImages.map(img => {
      if (img.group && img.group.length > 0 && img.group[0] === groupName) {
        const idx = numberingSelection.indexOf(img.id);
        return {
          ...img,
          number: idx !== -1 ? idx + 1 : null
        };
      }
      return img;
    });
    
    setSelectedImages(updatedImages);
    setNumberingMode(null);
    setNumberingSelection([]);
    setGroupNumberingStates((prev: { [groupName: string]: boolean }) => ({ ...prev, [groupName]: true }));
  };

  // Cancel numbering mode
  const cancelNumbering = () => {
    setNumberingMode(null);
    setNumberingSelection([]);
  };

  // Automatically number images when they're loaded from groups
  const autoNumberImages = (images: ExtendedImageItem[], groupsMapping: { [imageId: string]: string[] }) => {
    // Group images by their group name
    const groupedImages: { [groupName: string]: ExtendedImageItem[] } = {};
    
    images.forEach(img => {
      const group = groupsMapping[img.id] || img.group || [];
      const groupName = group.length > 0 ? group[0] : 'Ungrouped';
      
      if (!groupedImages[groupName]) {
        groupedImages[groupName] = [];
      }
      groupedImages[groupName].push(img);
    });

    // Number images within each group (1-based)
    const numberedImages = images.map(img => {
      const group = groupsMapping[img.id] || img.group || [];
      const groupName = group.length > 0 ? group[0] : 'Ungrouped';
      
      if (group.length > 0 && groupedImages[groupName]) {
        const groupIndex = groupedImages[groupName].findIndex(groupImg => groupImg.id === img.id);
        return {
          ...img,
          group: group,
          number: groupIndex !== -1 ? groupIndex + 1 : null
        };
      }
      
      return {
        ...img,
        group: group,
        number: img.number // Preserve existing number if no group
      };
    });

    // Set numbering states for groups that have images
    const newGroupStates = { ...groupNumberingStates };
    Object.keys(groupedImages).forEach(groupName => {
      if (groupName !== 'Ungrouped' && groupedImages[groupName].length > 0) {
        newGroupStates[groupName] = true;
      }
    });

    return { numberedImages, newGroupStates };
  };

  // Check if an image is in numbering mode
  const isInNumberingMode = (groupName: string) => numberingMode === groupName;

  // Check if an image is selected for numbering
  const isNumberingSelected = (imageId: string) => numberingSelection.includes(imageId);

  // Get the numbering index for an image
  const getNumberingIndex = (imageId: string) => numberingSelection.indexOf(imageId);

  return {
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
  };
} 