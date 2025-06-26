'use client';

import { useState, useRef, useEffect } from 'react';
import { ImageZoomModal, DescriptionInput } from './index';
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
  number?: number | null;
}

/**
 * Props for the ImageListView component
 */
interface ImageListViewProps {
  images: ImageItem[];                                    // List of images to display
  onUpdateImage?: (imageId: string, field: 'description' | 'tag' | 'rotation' | 'number', value: string | TagValue | number | null) => void;
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
            style={{ 
              display: 'flex', 
              gap: '2rem', 
              padding: '1.5rem', 
              marginBottom: '2rem',
              position: 'relative',
              cursor: 'default',
              border: '1px solid var(--color-border)',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--color-bg-card)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            }}
          >
            {/* Main content section */}
            <div style={{ 
              flex: '1', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem'
            }}>
              {/* Description input with autocomplete */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '600', 
                  marginBottom: '0.5rem', 
                  color: 'var(--color-text)' 
                }}>
                  Description:
                </label>
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
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '600', 
                  marginBottom: '0.5rem', 
                  color: 'var(--color-text)' 
                }}>
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
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    transition: 'border-color 0.2s ease'
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
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem'
                        }}
                      >
                        🔄 Rotate
                      </button>
                    )}
                    {showRemoveButton && (
                      <button
                        type="button"
                        onClick={() => onRemoveImage?.(image.id)}
                        className="btn btn-danger btn-sm"
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem'
                        }}
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
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontWeight: '500'
                  }}>
                    ⚠️ Unsaved changes
                  </span>
                )}
              </div>
              
              {/* Image metadata */}
              {showUserInfo && (
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--color-text-light)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  alignItems: 'center'
                }}>
                  {image.created_at && (
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem' 
                    }}>
                      📅 {new Date(image.created_at).toLocaleDateString()}
                    </span>
                  )}
                  {image.user_id && currentUserId && (
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      color: image.user_id === currentUserId ? 'var(--color-primary)' : 'var(--color-text-lighter)',
                      fontWeight: image.user_id === currentUserId ? '500' : 'normal'
                    }}>
                      👤 {image.user_id === currentUserId ? 'You' : 'Other User'}
                    </span>
                  )}
                  {imagesInReports?.has(image.url) && (
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      color: 'var(--color-warning)',
                      fontWeight: '500'
                    }}>
                      ✓ Used in Report
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Image display - on the right side */}
            <div style={{ 
              flex: '0 0 550px',
              position: 'relative',
              borderRadius: '0.5rem',
              overflow: 'hidden'
            }}>
              <img
                src={image.url}
                alt={image.description || 'Project image'}
                onClick={() => handleImageClick(image)}
                style={{
                  width: '100%',
                  height: '425px',
                  objectFit: 'cover',
                  borderRadius: '0.5rem',
                  transform: `rotate(${image.rotation || 0}deg)`,
                  cursor: 'pointer',
                  transition: 'transform 0.3s ease'
                }}
              />
              
              {/* Number bubble */}
              {image.number && (
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
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
                  zIndex: 10,
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}>
                  {image.number}
                </div>
              )}
              
              {/* Selection checkbox overlay */}
              {selectionMode && (
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  left: '0.75rem',
                  zIndex: 10
                }}>
                  <input
                    type="checkbox"
                    checked={selectedImages?.has(image.id) || false}
                    onChange={() => onToggleSelection?.(image.id)}
                    style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      cursor: 'pointer',
                      accentColor: 'var(--color-primary)'
                    }}
                  />
                </div>
              )}
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