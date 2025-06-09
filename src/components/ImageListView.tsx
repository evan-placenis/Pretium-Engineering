'use client';

import { useState } from 'react';
import ImageZoomModal from './ImageZoomModal';
import { TagValue, getAllTagOptions, getTagLabel, getTagBadgeClass } from '@/lib/tagConfig';

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

interface ImageListViewProps {
  images: ImageItem[];
  onUpdateImage?: (imageId: string, field: 'description' | 'tag' | 'rotation', value: string | TagValue | number) => void;
  onRemoveImage?: (imageId: string) => void;
  readonly?: boolean;
  showUserInfo?: boolean;
  showRotateButton?: boolean;
  showRemoveButton?: boolean;
  currentUserId?: string;
  imagesInReports?: Set<string>;
  selectionMode?: boolean;
  selectedImages?: Set<string>;
  onToggleSelection?: (imageId: string) => void;
  dragAndDrop?: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragLeave?: (e?: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  draggedIndex?: number | null;
  dragOverIndex?: number | null;
}

export default function ImageListView({
  images,
  onUpdateImage,
  onRemoveImage,
  readonly = false,
  showUserInfo = false,
  showRotateButton = false,
  showRemoveButton = true,
  currentUserId,
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
  const [zoomedImage, setZoomedImage] = useState<{ url: string; description: string } | null>(null);

  const handleImageClick = (image: ImageItem) => {
    if (!selectionMode) {
      setZoomedImage({ url: image.url, description: image.description || '' });
    }
  };
  

  return (
    <>
      <div>
        {images.map((image, idx) => (
          <div 
            key={image.id} 
            className="card" 
            draggable={dragAndDrop && !selectionMode}
            onDragStart={dragAndDrop ? (e) => onDragStart?.(e, idx) : undefined}
            onDragOver={dragAndDrop ? (e) => onDragOver?.(e, idx) : undefined}
            onDragLeave={dragAndDrop ? onDragLeave : undefined}
            onDrop={dragAndDrop ? (e) => onDrop?.(e, idx) : undefined}
            onDragEnd={dragAndDrop ? onDragEnd : undefined}
            style={{ 
              display: 'flex', 
              gap: '1.5rem', 
              padding: '1rem', 
              marginBottom: '2rem',
              position: 'relative',
              cursor: dragAndDrop && !selectionMode ? 'grab' : 'default',
              opacity: draggedIndex === idx ? 0.5 : 1,
              transform: draggedIndex === idx ? 'rotate(5deg)' : 'none',
              transition: draggedIndex === idx ? 'none' : 'all 0.2s ease',
              border: dragOverIndex === idx && draggedIndex !== idx 
                ? '2px dashed var(--color-primary)' 
                : '1px solid var(--color-border-dark)',
              backgroundColor: dragOverIndex === idx && draggedIndex !== idx 
                ? 'rgba(43, 87, 154, 0.05)' 
                : 'var(--color-bg-card)'
            }}
          >
            {/* Drag Handle */}
            {dragAndDrop && !selectionMode && (
              <div
                style={{
                  position: 'absolute',
                  left: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'grab',
                  color: 'var(--color-text-light)',
                  fontSize: '1.2rem',
                  padding: '0.5rem',
                  zIndex: 1
                }}
                title="Drag to reorder"
              >
                ⋮⋮
              </div>
            )}

            {/* Selection Checkbox */}
            {selectionMode && (
              <div
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  width: '24px',
                  height: '24px',
                  borderRadius: '3px',
                  border: '2px solid var(--color-primary)',
                  backgroundColor: selectedImages?.has(image.id) ? 'var(--color-primary)' : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  cursor: 'pointer'
                }}
                onClick={() => onToggleSelection?.(image.id)}
              >
                {selectedImages?.has(image.id) && (
                  <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                )}
              </div>
            )}
            
            {/* Content Section */}
            <div style={{ 
              flex: '1', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem',
              marginLeft: dragAndDrop && !selectionMode ? '2rem' : '0'
            }}>
              {/* Description Textarea */}
              <div>
                <textarea
                  value={image.description || ''}
                  onChange={(e) => onUpdateImage?.(image.id, 'description', e.target.value)}
                  placeholder="Enter notes for this image..."
                  disabled={readonly || selectionMode}
                  style={{
                    width: '100%',
                    minHeight: '200px',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.25rem',
                    resize: 'vertical',
                    backgroundColor: image.hasChanges ? 'rgba(255, 255, 0, 0.1)' : 'var(--color-bg)'
                  }}
                />
              </div>
              
              {/* Tag Dropdown */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: 'var(--color-text)' }}>
                  Category:
                </label>
                <select
                  value={image.tag || ''}
                  onChange={(e) => onUpdateImage?.(image.id, 'tag', e.target.value === '' ? null : e.target.value as TagValue)}
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
              
              {/* Action Buttons */}
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
              
              {/* Image Info */}
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
            
            {/* Image Display */}
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
                  pointerEvents: draggedIndex === idx ? 'none' : 'auto',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Zoom Modal */}
      <ImageZoomModal
        imageUrl={zoomedImage?.url || null}
        imageDescription={zoomedImage?.description}
        onClose={() => setZoomedImage(null)}
      />
    </>
  );
} 