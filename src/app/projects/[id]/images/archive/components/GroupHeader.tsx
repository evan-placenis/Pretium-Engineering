'use client';

interface GroupHeaderProps {
  groupName: string;
  imageCount: number;
  isEditing: boolean;
  editGroupName: string;
  editGroupLoading: boolean;
  groupViewMode: 'grid' | 'list';
  isCollapsed: boolean;
  numberingMode: string | null;
  onEditGroupNameChange: (name: string) => void;
  onSaveEditGroup: () => void;
  onCancelEditGroup: () => void;
  onToggleViewMode: () => void;
  onToggleCollapse: () => void;
  onStartNumbering: () => void;
  onClearNumbers: () => void;
  onStartEditGroup: () => void;
  onDeleteGroup: () => void;
  onCompleteNumbering: () => void;
  onCancelNumbering: () => void;
  numberingSelectionCount: number;
  uploadLoading: boolean;
}

export default function GroupHeader({
  groupName,
  imageCount,
  isEditing,
  editGroupName,
  editGroupLoading,
  groupViewMode,
  isCollapsed,
  numberingMode,
  onEditGroupNameChange,
  onSaveEditGroup,
  onCancelEditGroup,
  onToggleViewMode,
  onToggleCollapse,
  onStartNumbering,
  onClearNumbers,
  onStartEditGroup,
  onDeleteGroup,
  onCompleteNumbering,
  onCancelNumbering,
  numberingSelectionCount,
  uploadLoading
}: GroupHeaderProps) {
  return (
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
      {isEditing ? (
        <>
          <input
            type="text"
            value={editGroupName}
            onChange={e => onEditGroupNameChange(e.target.value)}
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#1e40af',
              border: '1px solid #cbd5e1',
              borderRadius: '0.25rem',
              padding: '0.25rem 0.5rem',
              marginRight: '1rem',
              minWidth: '200px'
            }}
            disabled={editGroupLoading}
          />
          <button
            className="btn btn-success btn-sm"
            style={{ marginLeft: '0.5rem' }}
            onClick={onSaveEditGroup}
            disabled={editGroupLoading || !editGroupName.trim()}
          >
            {editGroupLoading ? 'Saving...' : 'Save'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: '0.5rem' }}
            onClick={onCancelEditGroup}
            disabled={editGroupLoading}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          {/* Collapse/Expand button */}
          <button
            className="btn btn-sm btn-outline"
            onClick={onToggleCollapse}
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
            {imageCount} photo{imageCount !== 1 ? 's' : ''} (Mode: {groupViewMode})
          </span>
          {/* Grid/List toggle buttons - only show when not collapsed */}
          {!isCollapsed && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn btn-sm ${groupViewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={onToggleViewMode}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                📊 Grid
              </button>
              <button
                className={`btn btn-sm ${groupViewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={onToggleViewMode}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                📋 List
              </button>
              {numberingMode ? (
                <>

                </>
              ) : (
                <>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={onStartNumbering}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    🔢 Number
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={onClearNumbers}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    🗑️ Clear Numbers
                  </button>
                </>
              )}
            </div>
          )}
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: isCollapsed ? 'auto' : '1rem' }}
            onClick={onStartEditGroup}
          >
            ✏️ Edit
          </button>
          <button
            className="btn btn-danger btn-sm"
            style={{ marginLeft: '0.5rem' }}
            onClick={onDeleteGroup}
            disabled={uploadLoading}
          >
            🗑️ Delete
          </button>
        </>
      )}
    </div>
  );
} 