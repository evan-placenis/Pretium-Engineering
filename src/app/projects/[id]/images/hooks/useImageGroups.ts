import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExtendedProjectImage } from './useImageData';

interface UseImageGroupsProps {
  projectId: string;
  images: ExtendedProjectImage[];
  selectedImages: Set<string>;
  onSuccessMessage: (message: string) => void;
  onRefreshImages: () => Promise<void>;
}

interface UseImageGroupsReturn {
  // Group creation state
  createGroupMode: boolean;
  groupName: string;
  
  // Group editing state
  editingGroup: string | null;
  editGroupName: string;
  editGroupSelected: Set<string>;
  editGroupLoading: boolean;
  
  // Group view state
  groupViewModes: { [key: string]: 'grid' | 'list' };
  collapsedGroups: { [key: string]: boolean };
  
  // Actions
  setCreateGroupMode: (mode: boolean) => void;
  setGroupName: (name: string) => void;
  handleSaveGroup: () => Promise<void>;
  handleDeleteGroup: (groupToDelete: string) => Promise<void>;
  startEditGroup: (groupName: string) => void;
  cancelEditGroup: () => void;
  saveEditGroup: () => Promise<void>;
  toggleGroupViewMode: (groupName: string) => void;
  getGroupViewMode: (groupName: string) => 'grid' | 'list';
  toggleGroupCollapse: (groupName: string) => void;
  isGroupCollapsed: (groupName: string) => boolean;
  getAllGroups: (images: ExtendedProjectImage[]) => string[];
  setEditGroupName: (name: string) => void;
  setEditGroupSelected: (selected: Set<string>) => void;
  setGroupViewModes: React.Dispatch<React.SetStateAction<{ [key: string]: 'grid' | 'list' }>>;
}

export function useImageGroups({ 
  projectId, 
  images, 
  selectedImages, 
  onSuccessMessage,
  onRefreshImages 
}: UseImageGroupsProps): UseImageGroupsReturn {
  const [createGroupMode, setCreateGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState<string>('');
  const [editGroupSelected, setEditGroupSelected] = useState<Set<string>>(new Set());
  const [editGroupLoading, setEditGroupLoading] = useState(false);
  
  const [groupViewModes, setGroupViewModes] = useState<{ [key: string]: 'grid' | 'list' }>({});
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});

  // Get all unique group names from images
  const getAllGroups = (images: ExtendedProjectImage[]): string[] => {
    const groups = new Set<string>();
    images.forEach(img => {
      if (img.group && Array.isArray(img.group) && img.group.length > 0) {
        groups.add(img.group[0]);
      }
    });
    return Array.from(groups).sort();
  };

  // Save new group
  const handleSaveGroup = async () => {
    if (!groupName.trim() || selectedImages.size === 0) return;
    
    try {
      const { error } = await supabase
        .from('project_images')
        .update({ group: [groupName.trim()] })
        .in('id', Array.from(selectedImages));
        
      if (error) throw error;
      
      onSuccessMessage(`Group "${groupName}" created with ${selectedImages.size} images`);
      setCreateGroupMode(false);
      setGroupName('');
      await onRefreshImages();
    } catch (error: any) {
      console.error('Error creating group:', error);
      onSuccessMessage('Failed to create group');
    }
  };

  // Delete group
  const handleDeleteGroup = async (groupToDelete: string) => {
    if (!confirm(`Are you sure you want to delete the group "${groupToDelete}"? This will remove the group from all associated images.`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('project_images')
        .update({ group: null })
        .eq('project_id', projectId)
        .contains('group', [groupToDelete]);
        
      if (error) throw error;
      
      onSuccessMessage(`Group "${groupToDelete}" deleted`);
      await onRefreshImages();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      onSuccessMessage('Failed to delete group');
    }
  };

  // Start editing a group
  const startEditGroup = (groupName: string) => {
    setEditingGroup(groupName);
    setEditGroupName(groupName);
    
    // Get all images in this group
    const groupImages = images.filter(img => 
      img.group && Array.isArray(img.group) && img.group.includes(groupName)
    );
    setEditGroupSelected(new Set(groupImages.map(img => img.id)));
  };

  // Cancel group editing
  const cancelEditGroup = () => {
    setEditingGroup(null);
    setEditGroupName('');
    setEditGroupSelected(new Set());
  };

  // Save group edits
  const saveEditGroup = async () => {
    if (!editingGroup || !editGroupName.trim()) return;
    
    setEditGroupLoading(true);
    try {
      // Remove group from all images first
      const { error: removeError } = await supabase
        .from('project_images')
        .update({ group: null })
        .eq('project_id', projectId)
        .contains('group', [editingGroup]);
        
      if (removeError) throw removeError;
      
      // Add new group name to selected images
      if (editGroupSelected.size > 0) {
        const { error: addError } = await supabase
          .from('project_images')
          .update({ group: [editGroupName.trim()] })
          .in('id', Array.from(editGroupSelected));
          
        if (addError) throw addError;
      }
      
      onSuccessMessage(`Group "${editingGroup}" updated to "${editGroupName}"`);
      cancelEditGroup();
      await onRefreshImages();
    } catch (error: any) {
      console.error('Error updating group:', error);
      onSuccessMessage('Failed to update group');
    } finally {
      setEditGroupLoading(false);
    }
  };

  // Toggle group view mode
  const toggleGroupViewMode = (groupName: string) => {
    setGroupViewModes(prev => ({
      ...prev,
      [groupName]: prev[groupName] === 'list' ? 'grid' : 'list'
    }));
  };

  // Get current view mode for a group
  const getGroupViewMode = (groupName: string): 'grid' | 'list' => {
    return groupViewModes[groupName] || 'grid';
  };

  // Toggle group collapse
  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Check if group is collapsed
  const isGroupCollapsed = (groupName: string): boolean => {
    return collapsedGroups[groupName] || false;
  };

  return {
    createGroupMode,
    groupName,
    editingGroup,
    editGroupName,
    editGroupSelected,
    editGroupLoading,
    groupViewModes,
    setGroupViewModes,
    collapsedGroups,
    setCreateGroupMode,
    setGroupName,
    handleSaveGroup,
    handleDeleteGroup,
    startEditGroup,
    cancelEditGroup,
    saveEditGroup,
    toggleGroupViewMode,
    getGroupViewMode,
    toggleGroupCollapse,
    isGroupCollapsed,
    getAllGroups,
    setEditGroupName,
    setEditGroupSelected
  };
} 