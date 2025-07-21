'use client';

interface NumberingModeProps {
  groupName: string;
  selectedCount: number;
  onComplete: () => void;
  onCancel: () => void;
}

export default function NumberingMode({
  groupName,
  selectedCount,
  onComplete,
  onCancel
}: NumberingModeProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
      padding: '0.75rem',
      background: '#f0f9ff',
      border: '1px solid #0ea5e9',
      borderRadius: '0.5rem'
    }}>
      <span style={{ 
        color: '#0c4a6e', 
        fontSize: '0.875rem',
        fontWeight: '500'
      }}>
        Numbering Mode: {selectedCount} photo{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn btn-success btn-sm"
          onClick={onComplete}
          disabled={selectedCount === 0}
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
        >
          ✅ Done ({selectedCount})
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onCancel}
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  );
} 