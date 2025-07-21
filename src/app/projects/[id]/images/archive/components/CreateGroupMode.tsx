'use client';

import { ExtendedProjectImage } from '../hooks/useImageData';

interface CreateGroupModeProps {
  groupName: string;
  selectedCount: number;
  uploadLoading: boolean;
  images: ExtendedProjectImage[];
  selectedImages: Set<string>;
  onGroupNameChange: (name: string) => void;
  onSaveGroup: () => void;
  onCancel: () => void;
  onToggleImageSelection: (imageId: string) => void;
}

export default function CreateGroupMode({
  groupName,
  selectedCount,
  uploadLoading,
  images,
  selectedImages,
  onGroupNameChange,
  onSaveGroup,
  onCancel,
  onToggleImageSelection
}: CreateGroupModeProps) {
  return (
    <div style={{ 
      marginBottom: '2rem', 
      background: '#f8f9fa', 
      padding: '1rem', 
      borderRadius: '8px', 
      border: '1px solid #e0e0e0' 
    }}>
      <h3 style={{ marginBottom: '1rem' }}>Create a New Group</h3>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="text"
          value={groupName}
          onChange={e => onGroupNameChange(e.target.value)}
          placeholder="Enter group name"
          style={{ 
            padding: '0.5rem', 
            fontSize: '1rem', 
            border: '1px solid #ccc', 
            borderRadius: '4px', 
            minWidth: '200px' 
          }}
        />
        <button
          className="btn btn-success"
          onClick={onSaveGroup}
          disabled={!groupName.trim() || selectedCount === 0 || uploadLoading}
        >
          {uploadLoading ? 'Saving...' : `Save Group (${selectedCount} selected)`}
        </button>
        <button
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={uploadLoading}
        >
          Cancel
        </button>
      </div>
      <div style={{ color: '#888', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
        Select photos below to add to this group.
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '0.75rem',
        marginTop: '1rem'
      }}>
        {images.map(img => (
          <div key={img.id} style={{ position: 'relative', border: selectedImages.has(img.id) ? '2px solid #3b82f6' : '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', background: '#fff' }} onClick={() => onToggleImageSelection(img.id)}>
            <input
              type="checkbox"
              checked={selectedImages.has(img.id)}
              onChange={() => onToggleImageSelection(img.id)}
              style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
              onClick={e => e.stopPropagation()}
            />
            <img
              src={img.url}
              alt={img.description || 'Project image'}
              style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }}
            />
        </div>
        ))}
      </div>
    </div>
  );
} 