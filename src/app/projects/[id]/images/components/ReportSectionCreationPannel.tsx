'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Props for the ReportSectionCreationPannel component
 */
interface ReportSectionCreationPannelProps {
  /** Selected image IDs */
  selectedImageIds: Set<string>;
  /** Callback when images with groups change */
  onImagesWithGroupsChange: (imagesWithGroups: { [imageId: string]: string }) => void;
  /** Whether the panel is visible */
  isVisible: boolean;
  /** Callback to enable/disable image selection */
  onSelectionModeChange: (mode: 'disabled' | 'group' | 'ungrouped') => void;
  /** Current selection mode */
  selectionMode: 'disabled' | 'group' | 'ungrouped';
  /** Project ID for navigation */
  projectId: string;
  /** Return destination */
  returnTo: string;
  /** Callback to show error message */
  onError: (message: string) => void;
  /** Whether we're in ungrouped mode (from URL parameter) */
  isUngroupedMode?: boolean;
  /** Whether we're in grouped mode (from URL parameter) */
  isGroupedMode?: boolean;
}

/**
 * ReportSectionCreationPannel Component
 * 
 * A component that allows users to create groups and assign selected images to them
 * during the image selection process for reports.
 * 
 * Features:
 * - Create new groups with custom names
 * - Assign selected images to groups
 * - Visual feedback for group assignments
 * - Simple one-group-at-a-time workflow
 */
export default function ReportSectionCreationPannel({
  selectedImageIds,
  onImagesWithGroupsChange,
  isVisible,
  onSelectionModeChange,
  selectionMode,
  projectId,
  returnTo,
  onError,
  isUngroupedMode = false,
  isGroupedMode = false
}: ReportSectionCreationPannelProps) {
  // State for group management
  const [currentGroupName, setCurrentGroupName] = useState<string>('');
  const [showGroupInput, setShowGroupInput] = useState<boolean>(false);
  const [imagesWithGroups, setImagesWithGroups] = useState<{ [imageId: string]: string }>({});
  const [createdGroups, setCreatedGroups] = useState<string[]>([]);
  const router = useRouter();

  // Auto-show group input when entering group mode
  useEffect(() => {
    if (selectionMode === 'group' && !showGroupInput) {
      setShowGroupInput(true);
    }
  }, [selectionMode, showGroupInput]);

  // Update parent when images with groups change
  useEffect(() => {
    onImagesWithGroupsChange(imagesWithGroups);
  }, [imagesWithGroups, onImagesWithGroupsChange]);

  // Reset state when selection changes
  useEffect(() => {
    if (selectedImageIds.size === 0) {
      setImagesWithGroups({});
      setCreatedGroups([]);
      // Don't clear the group name when deselecting images
      // setCurrentGroupName('');
      // setShowGroupInput(false);
    }
  }, [selectedImageIds]);



  /**
   * Create a new group and assign selected images to it, then return to report page
   */
  const createGroup = () => {
    if (!currentGroupName.trim()) {
      onError('Please enter a group name');
      return;
    }

    if (selectedImageIds.size === 0) {
      onError('Please select at least one image before creating a group');
      return;
    }

    const groupName = currentGroupName.trim();
    
    // Create the selected images data with group information
    const newGroupData = Array.from(selectedImageIds).map(imageId => ({
      id: imageId,
      group: [groupName]
    }));

    // Get existing groups from localStorage
    const existingData = localStorage.getItem(`report-groups-${projectId}`);
    let allGroupsData = [];
    
    if (existingData) {
      try {
        allGroupsData = JSON.parse(existingData);
      } catch (error) {
        console.warn('Failed to parse existing groups data:', error);
      }
    }
    
    // Add new group data to existing data
    allGroupsData = [...allGroupsData, ...newGroupData];
    
    // Save all groups back to localStorage
    localStorage.setItem(`report-groups-${projectId}`, JSON.stringify(allGroupsData));
    
    // Get all unique image IDs
    const allImageIds = [...new Set(allGroupsData.map(item => item.id))];
    const selectedIds = allImageIds.join(',');
    const groupsData = JSON.stringify(allGroupsData);
    
    // Navigate back to report page with all selected images and group data
    const returnUrl = returnTo === 'reports' 
      ? `/reports/new?project_id=${projectId}&selected_images=${selectedIds}&groups_data=${encodeURIComponent(groupsData)}`
      : `/projects/${projectId}`;
    
    router.push(returnUrl);
  };



  if (!isVisible) return null;

  return (
    <div style={{
      marginBottom: "1rem",
      padding: "1rem",
      background: "var(--color-bg-card)",
      borderRadius: "0.5rem",
      border: "1px solid var(--color-border)"
    }}>
      <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", fontWeight: "600" }}>
       Select Organization Mode 
      </h3>
      
      {/* Initial Action Buttons */}
      {selectionMode === 'disabled' && (
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ 
            marginBottom: "1rem", 
            fontSize: "0.875rem", 
            color: "var(--color-text-secondary)" 
          }}>
            Choose how you want to organize your images:
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={() => onSelectionModeChange('group')}
              className="btn btn-primary"
              style={{ 
                fontSize: "0.875rem", 
                padding: "0.75rem 1rem",
                opacity: isUngroupedMode ? 0.6 : 1,
                cursor: isUngroupedMode ? 'not-allowed' : 'pointer'
              }}
              disabled={isUngroupedMode}
              title={isUngroupedMode ? "Cannot create report sections when using AI-generated sections" : "Create report sections and organize photos"}
            >
              Create Report Sections
            </button>
            <button
              onClick={() => onSelectionModeChange('ungrouped')}
              className="btn btn-secondary"
              style={{ 
                fontSize: "0.875rem", 
                padding: "0.75rem 1rem",
                opacity: (isGroupedMode || (!isUngroupedMode && selectedImageIds.size > 0)) ? 0.6 : 1,
                cursor: (isGroupedMode || (!isUngroupedMode && selectedImageIds.size > 0)) ? 'not-allowed' : 'pointer'
              }}
              disabled={isGroupedMode || (!isUngroupedMode && selectedImageIds.size > 0)}
              title={isGroupedMode ? "Cannot use AI-generated sections when using grouped photos" : (!isUngroupedMode && selectedImageIds.size > 0 ? "Cannot switch to AI-generated mode when grouped photos are selected" : "Select photos for AI-generated sections")}
            >
               AI-Generated Sections
            </button>
          </div>
        </div>
      )}

      {/* Group Creation Mode */}
      {selectionMode === 'group' && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "1rem"
          }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1 }}>
              <input
                type="text"
                value={currentGroupName}
                onChange={(e) => setCurrentGroupName(e.target.value)}
                placeholder="Enter report section name..."
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.25rem",
                  fontSize: "0.875rem"
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createGroup();
                  } else if (e.key === 'Escape') {
                    onSelectionModeChange('disabled');
                    setCurrentGroupName('');
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  if (!currentGroupName.trim()) {
                    onError('Please enter a report section name');
                    return;
                  }
                  if (selectedImageIds.size === 0) {
                    onError('Please select at least one image before creating a report section');
                    return;
                  }
                  createGroup();
                }}
                className="btn btn-primary"
                disabled={!currentGroupName.trim() || selectedImageIds.size === 0}
                style={{
                  fontSize: "1rem",
                  padding: "0.75rem 1.5rem",
                  fontWeight: "600",
                  opacity: (!currentGroupName.trim() || selectedImageIds.size === 0) ? 0.6 : 1,
                  cursor: (!currentGroupName.trim() || selectedImageIds.size === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                Create Report Section with {selectedImageIds.size} Image{selectedImageIds.size !== 1 ? 's' : ''}
              </button>
            </div>
            <button
              onClick={() => onSelectionModeChange('disabled')}
              className="btn btn-outline btn-sm"
              style={{ fontSize: "0.75rem", marginLeft: "0.5rem" }}
            >
              Cancel
            </button>
          </div>
          
          {/* Selection Summary */}
          {selectedImageIds.size > 0 && (
            <div style={{
              padding: "0.75rem",
              background: "var(--color-bg)",
              borderRadius: "0.25rem",
              border: "1px solid var(--color-border)"
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                📸 {selectedImageIds.size} image{selectedImageIds.size !== 1 ? 's' : ''} selected
              </span>
            </div>
          )}
          
          {/* Help text when no images selected */}
          {selectedImageIds.size === 0 && (
            <div style={{
              padding: "0.75rem",
              background: "var(--color-bg-secondary)",
              borderRadius: "0.25rem",
              border: "1px solid var(--color-border)"
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                💡 Select images to add to this report section
              </span>
            </div>
          )}
        </div>
      )}

      {/* Ungrouped Mode */}
      {selectionMode === 'ungrouped' && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "1rem"
          }}>
            <span style={{ 
              fontSize: "0.875rem", 
              color: "var(--color-secondary)",
              fontWeight: "500"
            }}>
              📤 AI-Generated Mode - Select images for AI-generated sections
            </span>
            <button
              onClick={() => onSelectionModeChange('disabled')}
              className="btn btn-outline btn-sm"
              style={{ fontSize: "0.75rem" }}
            >
              Cancel
            </button>
          </div>
          
          {/* Selection Summary */}
          {selectedImageIds.size > 0 && (
            <div style={{
              padding: "0.75rem",
              background: "var(--color-bg)",
              borderRadius: "0.25rem",
              border: "1px solid var(--color-border)",
              marginBottom: "1rem"
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>
                📸 {selectedImageIds.size} image{selectedImageIds.size !== 1 ? 's' : ''} selected for AI-generated report
              </span>
            </div>
          )}
          
          {/* Help text when no images selected */}
          {selectedImageIds.size === 0 && (
            <div style={{
              padding: "0.75rem",
              background: "var(--color-bg-secondary)",
              borderRadius: "0.25rem",
              border: "1px solid var(--color-border)",
              marginBottom: "1rem"
            }}>
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                💡 Select images to add to your report without grouping or numbering
              </span>
            </div>
          )}
          
          {/* Done button for ungrouped mode */}
          {selectedImageIds.size > 0 && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => {
                  // Get all unique image IDs
                  const allImageIds = Array.from(selectedImageIds);
                  const selectedIds = allImageIds.join(',');
                  
                  // Navigate back to report page with ungrouped flag
                  const returnUrl = returnTo === 'reports' 
                    ? `/reports/new?project_id=${projectId}&selected_images=${selectedIds}&ungrouped=true`
                    : `/projects/${projectId}`;
                  
                  router.push(returnUrl);
                }}
                className="btn btn-primary"
                style={{ 
                  fontSize: "1rem", 
                  padding: "0.75rem 2rem",
                  fontWeight: "600"
                }}
              >
                ✅ Done - Use {selectedImageIds.size} AI-Generated Image{selectedImageIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}


    </div>
  );
} 