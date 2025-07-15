import React from 'react';

interface ImageControlsProps {
  imageId: number;
  groupName: string;
  onPlusClick: (imageId: number, groupName: string) => void;
  onMinusClick: (imageId: number, groupName: string) => void;
}

export const ImageControls: React.FC<ImageControlsProps> = ({
  imageId,
  groupName,
  onPlusClick,
  onMinusClick
}) => {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      zIndex: 5
    }}>
      <button
        onClick={() => onPlusClick(imageId, groupName)}
        style={{
          width: '25px',
          height: '25px',
          borderRadius: '50%',
          border: 'none',
          background: '#28a745',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'transform 0.1s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Add image"
      >
        +
      </button>
      <button
        onClick={() => onMinusClick(imageId, groupName)}
        style={{
          width: '25px',
          height: '25px',
          borderRadius: '50%',
          border: 'none',
          background: '#dc3545',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'transform 0.1s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Remove image"
      >
        −
      </button>
    </div>
  );
}; 