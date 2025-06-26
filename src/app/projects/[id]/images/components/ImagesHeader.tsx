import { useRouter } from 'next/navigation';

interface ImagesHeaderProps {
  projectName?: string;
  imageCount: number;
  selectionMode: boolean;
  selectedCount: number;
  viewMode: 'grid' | 'list';
  uploadLoading: boolean;
  onUploadClick: () => void;
  onConfirmSelection: () => void;
  onCancel: () => void;
  onCreateGroup: () => void;
  createGroupLoading: boolean;
}

export default function ImagesHeader({
  projectName,
  imageCount,
  selectionMode,
  selectedCount,
  viewMode,
  uploadLoading,
  onUploadClick,
  onConfirmSelection,
  onCancel,
  onCreateGroup,
  createGroupLoading
}: ImagesHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <div>
        <h1 className="title" style={{ margin: 0, color: 'var(--color-text)' }}>
          {projectName || 'Project'}: Image Database
        </h1>
        <p style={{ margin: '0.5rem 0 0 0', color: 'var(--color-text-light)' }}>
          {imageCount} images
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {selectionMode && (
          <>
            <button
              className="btn btn-primary"
              onClick={onConfirmSelection}
              disabled={selectedCount === 0}
            >
              Confirm Selection ({selectedCount})
            </button>
            <button
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
          </>
        )}
        
        {!selectionMode && (
          <>
            <button
              className="btn btn-primary"
              onClick={onUploadClick}
              disabled={uploadLoading}
            >
              {uploadLoading ? 'Uploading...' : 'Upload Photos'}
            </button>
            <button
              className="btn btn-primary"
              onClick={onCreateGroup}
              disabled={createGroupLoading}
            >
              {createGroupLoading ? 'Creating...' : 'Create Group'}
            </button>
          </>
        )}
      </div>
    </div>
  );
} 