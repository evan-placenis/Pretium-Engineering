'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ImageItem } from './image_components/ImageListView';
import { ImageZoomModal } from './image_components/index';

/**
 * Props for the ImageGridView component
 */
interface ImageGridViewProps {
  /** List of images to display in grid */
  images: ImageItem[];
  /** Callback when image is clicked */
  onImageClick?: (image: ImageItem) => void;
  /** Whether to show image descriptions */
  showDescriptions?: boolean;
  /** Whether to show image tags */
  showTags?: boolean;
  /** Whether to show rotate button */
  showRotateButton?: boolean;
  /** Whether to show remove button */
  showRemoveButton?: boolean;
  /** Callback for image updates */
  onUpdateImage?: (imageId: string, field: 'description' | 'tag' | 'rotation' | 'number', value: string | any) => void;
  /** Callback for image removal */
  onRemoveImage?: (imageId: string) => void;
  /** Current user ID */
  currentUserId?: string;
  /** Project ID */
  projectId?: string;
  /** Whether to show user info */
  showUserInfo?: boolean;
  /** Whether to show selection checkboxes */
  showSelectionControls?: boolean;
  /** Set of selected image IDs */
  selectedImageIds?: Set<string>;
  /** Callback when image selection is toggled */
  onImageSelectionToggle?: (imageId: string) => void;
}

/**
 * ImageGridView Component
 * 
 * Displays images in a responsive grid layout.
 * Features:
 * - Responsive grid with auto-sizing columns
 * - Image zoom on click
 * - Optional description and tag display
 * - Image management actions (rotate, remove)
 * - Hover effects and visual feedback
 */
export default function ImageGridView({
  images,
  onImageClick,
  showDescriptions = true,
  showTags = true,
  showRotateButton = false,
  showRemoveButton = false,
  onUpdateImage,
  onRemoveImage,
  currentUserId,
  projectId,
  showUserInfo = false,
  showSelectionControls = false,
  selectedImageIds = new Set(),
  onImageSelectionToggle
}: ImageGridViewProps) {
  const [zoomedImage, setZoomedImage] = useState<{ url: string; description: string } | null>(null);
  const [showDescriptionsLocal, setShowDescriptionsLocal] = useState(showDescriptions);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Update local state when prop changes
  useEffect(() => {
    setShowDescriptionsLocal(showDescriptions);
  }, [showDescriptions]);

  /**
   * Handle image click - either zoom or call custom handler
   */
  const handleImageClick = (image: ImageItem) => {
    if (onImageClick) {
      onImageClick(image);
    } else {
      setZoomedImage({ url: image.url, description: image.description || '' });
    }
  };

  /**
   * Handle image rotation
   */
  const handleRotate = async (image: ImageItem) => {
    if (!onUpdateImage) return;
    
    const newRotation = ((image.rotation || 0) + 90) % 360;
    onUpdateImage(image.id, 'rotation', newRotation);
    
    // Auto-save rotation change to database
    try {
      const { error } = await supabase
        .from('project_images')
        .update({ rotation: newRotation })
        .eq('id', image.id);

      if (error) {
        console.error('Failed to save rotation:', error);
        return;
      }
    } catch (error: any) {
      console.error('Error saving rotation:', error);
    }
  };

  /**
   * Handle image removal
   */
  const handleRemove = (image: ImageItem) => {
    if (onRemoveImage) {
      onRemoveImage(image.id);
    }
  };

  /**
   * Start editing description
   */
  const handleStartEdit = (image: ImageItem) => {
    setEditingImageId(image.id);
    setEditingValue(image.description || '');
  };

  /**
   * Save edited description
   */
  const handleSaveEdit = async () => {
    if (!editingImageId || !onUpdateImage) return;
    
    try {
      await onUpdateImage(editingImageId, 'description', editingValue.trim());
      setEditingImageId(null);
      setEditingValue('');
    } catch (error) {
      console.error('Failed to update description:', error);
    }
  };

  /**
   * Cancel editing
   */
  const handleCancelEdit = () => {
    setEditingImageId(null);
    setEditingValue('');
  };

  /**
   * Handle key press in edit mode
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <>
      <style jsx>{`
        .image-card:hover .delete-btn {
          opacity: 1 !important;
        }
      `}</style>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${showDescriptionsLocal ? '240px' : '280px'}, 1fr))`,
        gap: '0.5rem',
        padding: '0.5rem',
        width: '100%',
        maxWidth: '100%'
      }}>
        {images.map((image) => (
          <div
            key={image.id}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: '0.25rem',
              overflow: 'hidden',
              backgroundColor: 'var(--color-bg-card)',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              minHeight: showDescriptionsLocal ? '240px' : '240px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            {/* Image container */}
            <div 
              className="image-card"
              onClick={() => {
                if (showSelectionControls && onImageSelectionToggle) {
                  onImageSelectionToggle(image.id);
                } else {
                  handleImageClick(image);
                }
              }}
              style={{
                position: 'relative',
                cursor: showSelectionControls ? 'pointer' : 'default'
              }}
            >
              <img
                src={image.url}
                alt={image.description || 'Project image'}
                style={{
                  width: '100%',
                  height: showDescriptionsLocal ? '200px' : '220px',
                  objectFit: 'cover',
                  transform: `rotate(${image.rotation || 0}deg)`,
                  transition: 'transform 0.3s ease'
                }}
              />
              
              {/* Delete button - top right */}
              {showRemoveButton && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '0.25rem',
                    right: '0.25rem',
                    width: '1.75rem',
                    height: '1.75rem',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(220, 38, 38, 0.9)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    zIndex: 20,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(image);
                  }}
                >
                  −
                </div>
              )}
              
              {/* Selection indicator - top-left */}
              {showSelectionControls && (
                <div style={{
                  position: 'absolute',
                  top: '0.5rem',
                  left: '0.5rem',
                  zIndex: 30,
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: selectedImageIds.has(image.id) 
                    ? 'var(--color-primary)' 
                    : 'rgba(255, 255, 255, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  border: selectedImageIds.has(image.id) 
                    ? '2px solid white' 
                    : '2px solid rgba(255, 255, 255, 0.8)',
                  transition: 'all 0.2s ease'
                }}>
                  {selectedImageIds.has(image.id) && (
                    <span style={{
                      color: 'white',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      lineHeight: 1
                    }}>
                      ✓
                    </span>
                  )}
                </div>
              )}
              
              {/* Number badge - moved to top-left (or top-right if selection is enabled) */}
              {image.number && (
                <div style={{
                  position: 'absolute',
                  top: '0.25rem',
                  left: showSelectionControls ? '2.5rem' : '0.25rem',
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(59, 130, 246, 0.9)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  zIndex: 10,
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)'
                }}>
                  {image.number}
                </div>
              )}
            </div>

            {/* Image info and actions */}
            <div style={{ 
              padding: showDescriptionsLocal ? '0.5rem' : '0.25rem',
              display: showDescriptionsLocal ? 'block' : 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* Description */}
              {showDescriptionsLocal && (
                editingImageId === image.id ? (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSaveEdit}
                      style={{
                        width: '100%',
                        fontSize: '0.75rem',
                        padding: '0.25rem',
                        border: '1px solid var(--color-primary)',
                        borderRadius: '0.25rem',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)'
                      }}
                      autoFocus
                    />
                    <div style={{ 
                      display: 'flex', 
                      gap: '0.25rem', 
                      marginTop: '0.25rem',
                      fontSize: '0.625rem'
                    }}>
                      <button
                        onClick={handleSaveEdit}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '0.125rem 0.25rem' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.125rem 0.25rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    style={{ 
                      marginBottom: '0.5rem',
                      fontSize: '0.75rem',
                      color: 'var(--color-text)',
                      lineHeight: '1.2',
                      maxHeight: '2.8em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '0.25rem',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(image);
                    }}
                  >
                    {image.description || 'Click to add description...'}
                  </div>
                )
              )}

              {/* Tag */}
              {showTags && image.tag && showDescriptionsLocal && (
                <div style={{ 
                  marginBottom: '0.5rem',
                  display: 'inline-block',
                  padding: '0.125rem 0.375rem',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  borderRadius: '0.125rem',
                  fontSize: '0.625rem',
                  fontWeight: '500'
                }}>
                  {image.tag}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '0.25rem', 
                alignItems: 'center',
                justifyContent: showDescriptionsLocal ? 'space-between' : 'flex-end'
              }}>
                                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {showRotateButton && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRotate(image);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ 
                          padding: '0.125rem 0.25rem', 
                          fontSize: '0.625rem',
                          minWidth: 'auto',
                          height: '1.5rem'
                        }}
                      >
                        🔄
                      </button>
                    )}
                  </div>

                {/* Metadata */}
                {showUserInfo && showDescriptionsLocal && (
                  <div style={{ 
                    fontSize: '0.625rem', 
                    color: 'var(--color-text-secondary)',
                    textAlign: 'right',
                    lineHeight: '1.2'
                  }}>
                    {image.created_at && (
                      <div>📅 {new Date(image.created_at).toLocaleDateString()}</div>
                    )}
                    {image.user_id && currentUserId && (
                      <div style={{ 
                        color: image.user_id === currentUserId ? 'var(--color-primary)' : 'var(--color-text-lighter)',
                        fontWeight: image.user_id === currentUserId ? '500' : 'normal'
                      }}>
                        👤 {image.user_id === currentUserId ? 'You' : 'Other User'}
                      </div>
                    )}
                  </div>
                )}
              </div>
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