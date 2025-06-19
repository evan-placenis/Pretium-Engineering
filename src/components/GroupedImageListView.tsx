'use client';

import { useState } from 'react';
import ImageListView, { ImageItem } from './ImageListView';
import { TagValue } from '@/lib/tagConfig';

/**
 * TODO: FUTURE REFACTORING
 * 
 * This component should be extended to replace the custom grouped image implementation 
 * in images_page.tsx. The images page has additional features that need to be added:
 * - Grid/List view toggle for each group
 * - Group editing functionality (rename, delete)
 * - Photo numbering system with selection mode
 * - Group collapse/expand functionality
 * - Selection checkboxes for group editing
 * - Advanced group management buttons
 * 
 * This would provide consistency across the codebase and reduce code duplication.
 */

/**
 * Extended interface to include group and number information
 */
interface GroupedImageItem extends ImageItem {
  group?: string[];
  number?: number | null;
  originalDescription?: string;
  originalTag?: TagValue;
  hasChanges?: boolean;
}

/**
 * Props for the GroupedImageListView component
 */
interface GroupedImageListViewProps {
  images: GroupedImageItem[];
  onUpdateImage?: (imageId: string, field: 'description' | 'tag' | 'rotation' | 'number', value: string | TagValue | number | null) => void;
  onAutoSaveUpdate?: (imageId: string, description: string) => void;
  onRemoveImage?: (imageId: string) => void;
  onShowSuccessMessage?: (message: string) => void;
  readonly?: boolean;
  showUserInfo?: boolean;
  showRotateButton?: boolean;
  showRemoveButton?: boolean;
  currentUserId?: string;
  projectId?: string;
  imagesInReports?: Set<string>;
  selectionMode?: boolean;
  selectedImages?: Set<string>;
  onToggleSelection?: (imageId: string) => void;
  collapsible?: boolean; // Whether groups can be collapsed
  defaultCollapsed?: boolean; // Default collapsed state
}

/**
 * GroupedImageListView Component
 * 
 * A component that displays images organized by groups with collapsible headers.
 * Features:
 * - Groups images by their group property
 * - Shows group headers with photo counts
 * - Collapsible groups (optional)
 * - Preserves numbering order within groups
 * - Uses ImageListView for each group
 */
export default function GroupedImageListView({
  images,
  onUpdateImage,
  onAutoSaveUpdate,
  onRemoveImage,
  onShowSuccessMessage,
  readonly = false,
  showUserInfo = false,
  showRotateButton = false,
  showRemoveButton = true,
  currentUserId,
  projectId,
  imagesInReports,
  selectionMode = false,
  selectedImages,
  onToggleSelection,
  collapsible = true,
  defaultCollapsed = false,
}: GroupedImageListViewProps) {
  // State for collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<{ [key: string]: boolean }>({});

  // Organize images by groups
  const groups: { [key: string]: GroupedImageItem[] } = {};
  const ungroupedImages: GroupedImageItem[] = [];

  images.forEach(img => {
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

  // Sort images within each group by number, then by created_at
  Object.keys(groups).forEach(groupName => {
    groups[groupName].sort((a, b) => {
      if (a.number && b.number) {
        return a.number - b.number; // Sort by number
      } else if (a.number && !b.number) {
        return -1; // Numbered images first
      } else if (!a.number && b.number) {
        return 1; // Numbered images first
      }
      // If neither has a number, sort by date
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });
  });

  // Sort ungrouped images by number, then by created_at
  ungroupedImages.sort((a, b) => {
    if (a.number && b.number) {
      return a.number - b.number; // Sort by number
    } else if (a.number && !b.number) {
      return -1; // Numbered images first
    } else if (!a.number && b.number) {
      return 1; // Numbered images first
    }
    // If neither has a number, sort by date
    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
  });

  // Function to toggle group collapse state
  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Function to check if a group is collapsed
  const isGroupCollapsed = (groupName: string): boolean => {
    if (!collapsible) return false;
    return collapsedGroups[groupName] ?? defaultCollapsed;
  };

  return (
    <div>
      {/* Render grouped images */}
      {Object.entries(groups).map(([groupName, groupImages]) => {
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
              {collapsible && (
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
              )}
              
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
            </div>
            
            {/* Group images - only show if not collapsed */}
            {!isCollapsed && (
              <ImageListView
                images={groupImages.map(img => ({
                  id: img.id,
                  url: img.url,
                  description: img.description || '',
                  tag: img.tag,
                  created_at: img.created_at || '',
                  user_id: img.user_id,
                  hasChanges: img.hasChanges,
                  rotation: img.rotation,
                  number: img.number
                }))}
                onUpdateImage={onUpdateImage}
                onAutoSaveUpdate={onAutoSaveUpdate}
                onShowSuccessMessage={onShowSuccessMessage}
                onRemoveImage={onRemoveImage}
                readonly={readonly}
                showUserInfo={showUserInfo}
                showRotateButton={showRotateButton}
                showRemoveButton={showRemoveButton}
                currentUserId={currentUserId}
                projectId={projectId}
                imagesInReports={imagesInReports}
                selectionMode={selectionMode}
                selectedImages={selectedImages}
                onToggleSelection={onToggleSelection}
              />
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
            {collapsible && (
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
            )}
            
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
          </div>
          
          {/* Ungrouped images - only show if not collapsed */}
          {!isGroupCollapsed('ungrouped') && (
            <ImageListView
              images={ungroupedImages.map(img => ({
                id: img.id,
                url: img.url,
                description: img.description || '',
                tag: img.tag,
                created_at: img.created_at || '',
                user_id: img.user_id,
                hasChanges: img.hasChanges,
                rotation: img.rotation,
                number: img.number
              }))}
              onUpdateImage={onUpdateImage}
              onAutoSaveUpdate={onAutoSaveUpdate}
              onShowSuccessMessage={onShowSuccessMessage}
              onRemoveImage={onRemoveImage}
              readonly={readonly}
              showUserInfo={showUserInfo}
              showRotateButton={showRotateButton}
              showRemoveButton={showRemoveButton}
              currentUserId={currentUserId}
              projectId={projectId}
              imagesInReports={imagesInReports}
              selectionMode={selectionMode}
              selectedImages={selectedImages}
              onToggleSelection={onToggleSelection}
            />
          )}
        </div>
      )}
    </div>
  );
} 