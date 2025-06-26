'use client';

import { ExtendedProjectImage } from '../hooks/useImageData';

interface ImageCardProps {
  image: ExtendedProjectImage;
  showGroupBadges: boolean;
  editGroupMode: boolean;
  selectionMode: boolean;
  numberingMode: string | null;
  isSelected: boolean;
  isInReport: boolean;
  isNumbering: boolean;
  numberingIndex: number;
  editGroupSelected: Set<string>;
  onSelect: () => void;
  onCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ImageCard({
  image,
  showGroupBadges,
  editGroupMode,
  selectionMode,
  numberingMode,
  isSelected,
  isInReport,
  isNumbering,
  numberingIndex,
  editGroupSelected,
  onSelect,
  onCheckboxChange
}: ImageCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        border: isNumbering ? '2px solid #2563eb' : (isSelected ? '3px solid #3b82f6' : '1px solid var(--color-border)'),
        borderRadius: '0.5rem',
        overflow: 'hidden',
        cursor: 'pointer',
        backgroundColor: isNumbering ? 'rgba(37,99,235,0.08)' : 'var(--color-bg-card)',
        transition: 'all 0.2s ease',
        ...(isSelected && { transform: 'scale(1.02)' })
      }}
      onClick={onSelect}
    >
      {/* Selection checkbox */}
      {(selectionMode || editGroupMode || numberingMode) && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          left: '0.5rem',
          zIndex: 10
        }}>
          <input
            type="checkbox"
            checked={
              selectionMode
                ? isSelected
                : editGroupMode
                  ? editGroupSelected.has(image.id)
                  : numberingMode
                    ? isNumbering
                    : false
            }
            onChange={onCheckboxChange}
            style={{ transform: 'scale(1.2)' }}
          />
        </div>
      )}

      {/* Number badge: show selection order if in numbering mode and selected, otherwise permanent number */}
      {isNumbering ? (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          zIndex: 10
        }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
            fontWeight: '600',
            border: '2px solid #fff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
          }}>
            {/* This will be calculated in the parent component */}
            {numberingIndex + 1}
          </div>
        </div>
      ) : (
        image.number && (
          <div style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            zIndex: 10
          }}>
            <div style={{
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
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}>
              {image.number}
            </div>
          </div>
        )
      )}

      {/* Image */}
      <img
        src={image.url}
        alt={image.description || 'Project image'}
        style={{
          width: '100%',
          height: '200px',
          objectFit: 'cover',
          display: 'block'
        }}
      />

      {/* Overlay with info */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        color: 'white',
        padding: '1rem',
        fontSize: '0.875rem'
      }}>
        {showGroupBadges && image.group && Array.isArray(image.group) && image.group.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{
              background: '#3b82f6',
              color: 'white',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem'
            }}>
              {image.group[0]}
            </span>
          </div>
        )}
        
        {image.description && (
          <div style={{ 
            marginBottom: '0.5rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {image.description}
          </div>
        )}
        
        {image.tag && (
          <div style={{ marginBottom: '0.5rem' }}>
            <span className={`badge ${image.tag === 'deficiency' ? 'badge-danger' : 'badge-info'}`}>
              {image.tag}
            </span>
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '0.75rem',
          opacity: 0.8
        }}>
          <span>
            {new Date(image.created_at).toLocaleDateString()}
          </span>
          {isInReport && (
            <span style={{ color: '#10b981' }}>
              ✓ In Report
            </span>
          )}
        </div>
      </div>
    </div>
  );
} 