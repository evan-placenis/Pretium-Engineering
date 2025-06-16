'use client';

import { useState, useRef, useEffect } from 'react';
import ImageZoomModal from './ImageZoomModal';
import DescriptionInput from './DescriptionInput';
import { TagValue, getAllTagOptions, getTagLabel, getTagBadgeClass } from '@/lib/tagConfig';
import { supabase } from '@/lib/supabase';

/**
 * Interface for individual image items in the list
 */
export interface ImageItem {
  id: string;
  url: string;
  description: string;
  tag: TagValue;
  created_at?: string;
  user_id?: string;
  hasChanges?: boolean;
  rotation?: number;
}

/**
 * Props for the ImageListView component
 */
interface ImageListViewProps {
  images: ImageItem[];                                    // List of images to display
  onUpdateImage?: (imageId: string, field: 'description' | 'tag' | 'rotation', value: string | TagValue | number) => void;
  onAutoSaveUpdate?: (imageId: string, description: string) => void;
  onRemoveImage?: (imageId: string) => void;
  onShowSuccessMessage?: (message: string) => void;
  readonly?: boolean;                                     // Whether the list is read-only
  showUserInfo?: boolean;                                 // Whether to show user info
  showRotateButton?: boolean;                             // Whether to show rotate button
  showRemoveButton?: boolean;                             // Whether to show remove button
  currentUserId?: string;                                 // Current user's ID
  projectId?: string;                                     // Current project's ID
  imagesInReports?: Set<string>;                          // Set of image URLs used in reports
  selectionMode?: boolean;                                // Whether in selection mode
  selectedImages?: Set<string>;                           // Set of selected image IDs
  onToggleSelection?: (imageId: string) => void;          // Handler for selection toggle
  dragAndDrop?: boolean;                                  // Whether drag and drop is enabled
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragLeave?: (e?: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  draggedIndex?: number | null;
  dragOverIndex?: number | null;
}

/**
 * ImageListView Component
 * 
 * A list view component for displaying and managing project images.
 * Features:
 * - Grid/list view of images with descriptions and tags
 * - Auto-saving descriptions
 * - Image rotation
 * - Drag and drop reordering
 * - Selection mode for report creation
 * - Image zooming
 */
export default function ImageListView({
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
  dragAndDrop = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  draggedIndex,
  dragOverIndex,
}: ImageListViewProps) {
  // State for the zoom modal
  const [zoomedImage, setZoomedImage] = useState<{ url: string; description: string } | null>(null);

  /**
   * Handle image click - either zoom the image or toggle selection
   */
  const handleImageClick = (image: ImageItem) => {
    if (!selectionMode) {
      setZoomedImage({ url: image.url, description: image.description || '' });
    }
  };

  /**
   * Auto-save description when user blurs the input field
   * This triggers a database update and refreshes the suggestions cache
   */
  const handleAutoSave = async (imageId: string, originalDescription: string, newValue: string) => {
    // Don't save empty descriptions
    if (!newValue || !newValue.trim()) {
      return;
    }
    
    try {
      console.log('Attempting to save description:', { imageId, newValue });
      
      const { data, error } = await supabase
        .from('project_images')
        .update({ description: newValue.trim() })
        .eq('id', imageId)
        .select();

      if (error) {
        console.error('Save failed:', error);
        onShowSuccessMessage?.('Failed to save description');
        return;
      }
      
      if (!data || data.length === 0) {
        console.error('No data returned from save');
        onShowSuccessMessage?.('Failed to save description');
        return;
      }
      
      console.log('Save successful:', data);
      
      // First update the parent component to reset hasChanges
      onUpdateImage?.(imageId, 'description', newValue.trim());
      
      // Then notify about the auto-save
      onAutoSaveUpdate?.(imageId, newValue.trim());
      onShowSuccessMessage?.('Description auto-saved');
      
      // Invalidate the suggestions cache to refresh all components
      if (projectId && (window as any).invalidateDescriptionCache) {
        (window as any).invalidateDescriptionCache(projectId);
      }
      
    } catch (error: any) {
      console.error('Unexpected error during save:', error);
      onShowSuccessMessage?.('Failed to save description');
    }
  };

  return (
    <>
      <div>
        {images.map((image, idx) => (
          <div 
            key={image.id} 
            className="card" 
            style={{ 
              display: 'flex', 
              gap: '1.5rem', 
              padding: '1rem', 
              marginBottom: '2rem',
              position: 'relative',
              cursor: 'default',
              border: '1px solid var(--color-border-dark)',
              backgroundColor: 'var(--color-bg-card)'
            }}
          >
            {/* Main content section */}
            <div style={{ 
              flex: '1', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem'
            }}>
              {/* Description input with autocomplete */}
              <div style={{ marginBottom: '1rem' }}>
                <DescriptionInput
                  value={image.description || ''}
                  onChange={(value) => {
                    // When the value changes, update the image and set hasChanges to true
                    onUpdateImage?.(image.id, 'description', value);
                  }}
                  onBlur={(value) => handleAutoSave(image.id, image.description || '', value)}
                  placeholder="Enter notes for this image..."
                  disabled={readonly || selectionMode}
                  hasChanges={image.hasChanges}
                  userId={currentUserId}
                  projectId={projectId}
                />
              </div>
              
              {/* Tag selection dropdown */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: 'var(--color-text)' }}>
                  Category:
                </label>
                <select
                  value={image.tag || ''}
                  onChange={async (e) => {
                    const newTag = e.target.value === '' ? null : e.target.value as TagValue;
                    onUpdateImage?.(image.id, 'tag', newTag);
                    
                    // Auto-save tag change
                    try {
                      const { error } = await supabase
                        .from('project_images')
                        .update({ tag: newTag })
                        .eq('id', image.id);

                      if (error) {
                        onShowSuccessMessage?.('Failed to save tag');
                        return;
                      }
                      
                      onShowSuccessMessage?.('Tag auto-saved');
                    } catch (error: any) {
                      onShowSuccessMessage?.('Failed to save tag');
                    }
                  }}
                  disabled={readonly || selectionMode}
                  style={{
                    width: '100%',
                    maxWidth: '200px',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.25rem',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)'
                  }}
                >
                  {getAllTagOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {!selectionMode && !readonly && (
                  <>
                    {showRotateButton && (
                      <button
                        type="button"
                        onClick={() => {
                          const newRotation = ((image.rotation || 0) + 90) % 360;
                          onUpdateImage?.(image.id, 'rotation', newRotation);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        🔄 Rotate
                      </button>
                    )}
                    {showRemoveButton && (
                      <button
                        type="button"
                        onClick={() => onRemoveImage?.(image.id)}
                        className="btn btn-danger btn-sm"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Remove Image
                      </button>
                    )}
                  </>
                )}
                
                {/* Unsaved changes indicator */}
                {image.hasChanges && (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--color-warning)', 
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem'
                  }}>
                    • Unsaved changes
                  </span>
                )}
              </div>
              
              {/* Image metadata */}
              {showUserInfo && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                  {image.created_at && (
                    <>Created: {new Date(image.created_at).toLocaleDateString()}</>
                  )}
                  {image.user_id && currentUserId && (
                    <span style={{ marginLeft: '0.5rem' }}>
                      • {image.user_id === currentUserId ? (
                        <span style={{ color: 'var(--color-primary)' }}>You</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-lighter)' }}>Other User</span>
                      )}
                    </span>
                  )}
                  {imagesInReports?.has(image.url) && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--color-warning)' }}>
                      • Used in Report
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Image display */}
            <div style={{ flex: '1' }}>
              <img
                src={image.url}
                alt={image.description || 'Project image'}
                onClick={() => handleImageClick(image)}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '300px',
                  objectFit: 'contain',
                  borderRadius: '0.25rem',
                  transform: `rotate(${image.rotation || 0}deg)`,
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Image zoom modal */}
      <ImageZoomModal
        imageUrl={zoomedImage?.url || null}
        imageDescription={zoomedImage?.description}
        onClose={() => setZoomedImage(null)}
      />
    </>
  );
} 