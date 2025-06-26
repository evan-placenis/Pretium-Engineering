'use client';

import { DescriptionInput } from '@/components/image_components';
import { ExtendedProjectImage } from '../hooks/useImageData';
import { TagValue } from '@/lib/tagConfig';

interface ImageModalProps {
  image: ExtendedProjectImage | null;
  editMode: boolean;
  editDescription: string;
  editTag: TagValue;
  updateLoading: boolean;
  deleteLoading: string | null;
  currentUserId?: string;
  projectId?: string;
  onClose: () => void;
  onDelete: (imageId: string) => void;
  onUpdate: () => void;
  onEditModeToggle: () => void;
  onEditDescriptionChange: (description: string) => void;
  onEditTagChange: (tag: TagValue) => void;
}

export default function ImageModal({
  image,
  editMode,
  editDescription,
  editTag,
  updateLoading,
  deleteLoading,
  currentUserId,
  projectId,
  onClose,
  onDelete,
  onUpdate,
  onEditModeToggle,
  onEditDescriptionChange,
  onEditTagChange
}: ImageModalProps) {
  if (!image) return null;

  return (
    <div 
      className="modal" 
      style={{ 
        display: 'block',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div 
        className="modal-content"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--color-bg-card)',
          padding: '2rem',
          borderRadius: '0.5rem',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          minWidth: '400px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Image Details</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--color-text)',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <img
            src={image.url}
            alt={image.description || 'Project image'}
            style={{
              width: '100%',
              maxHeight: '60vh',
              objectFit: 'contain',
              borderRadius: '0.25rem',
            }}
          />
        </div>

        {editMode ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ color: 'var(--color-text)' }}>Description</label>
              <DescriptionInput
                value={editDescription}
                onChange={onEditDescriptionChange}
                placeholder="Enter image description..."
                style={{ minHeight: '120px' }}
                userId={currentUserId}
                projectId={projectId}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ color: 'var(--color-text)' }}>Tag</label>
              <select
                value={editTag || ''}
                onChange={(e) => onEditTagChange(e.target.value === '' ? null : e.target.value as TagValue)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="">No tag</option>
                <option value="overview">Overview</option>
                <option value="deficiency">Deficiency</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={onUpdate}
                disabled={updateLoading}
                className="btn btn-primary"
              >
                {updateLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={onEditModeToggle}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--color-text)' }}>Description:</strong>
              <p style={{ margin: '0.5rem 0', color: 'var(--color-text-light)' }}>
                {image.description || 'No description'}
              </p>
            </div>
            {image.tag && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--color-text)' }}>Tag:</strong>
                <span 
                  className={`badge ${image.tag === 'deficiency' ? 'badge-danger' : 'badge-info'}`}
                  style={{ marginLeft: '0.5rem' }}
                >
                  {image.tag}
                </span>
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--color-text)' }}>Created:</strong>
              <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-light)' }}>
                {image.created_at ? new Date(image.created_at).toLocaleString() : 'Unknown'}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          {!editMode && (
            <button
              onClick={onEditModeToggle}
              className="btn btn-secondary"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => onDelete(image.id)}
            disabled={deleteLoading === image.id}
            className="btn btn-danger"
          >
            {deleteLoading === image.id ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
} 