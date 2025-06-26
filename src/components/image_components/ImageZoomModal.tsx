'use client';

import { useState, useEffect } from 'react';

interface ImageZoomModalProps {
  imageUrl: string | null;
  imageDescription?: string;
  onClose: () => void;
}

export default function ImageZoomModal({ imageUrl, imageDescription, onClose }: ImageZoomModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset scale and position when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [imageUrl]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (imageUrl) {
      document.addEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [imageUrl, onClose]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 5));
  };

  if (!imageUrl) return null;

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
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000,
        cursor: scale > 1 && isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Controls */}
      <div style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        display: 'flex',
        gap: '0.5rem',
        zIndex: 1001,
      }}>
        <button
          onClick={handleZoomOut}
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleResetZoom}
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 'bold',
          }}
          title="Reset Zoom"
        >
          1:1
        </button>
        <button
          onClick={handleZoomIn}
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Zoom level indicator */}
      <div style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '0.5rem 1rem',
        borderRadius: '0.25rem',
        fontSize: '0.875rem',
        fontWeight: 'bold',
        zIndex: 1001,
      }}>
        {Math.round(scale * 100)}%
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '0.5rem 1rem',
        borderRadius: '0.25rem',
        fontSize: '0.75rem',
        textAlign: 'center',
        zIndex: 1001,
      }}>
        Click outside to close • Scroll to zoom • Drag to pan when zoomed • ESC to close
      </div>

      {/* Image */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <img
          src={imageUrl}
          alt={imageDescription || 'Zoomed image'}
          style={{
            maxWidth: scale === 1 ? '90vw' : 'none',
            maxHeight: scale === 1 ? '90vh' : 'none',
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            userSelect: 'none',
            pointerEvents: 'auto',
          }}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          draggable={false}
        />
      </div>

      {/* Image description */}
      {imageDescription && (
        <div style={{
          position: 'absolute',
          bottom: '4rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '0.25rem',
          fontSize: '0.875rem',
          maxWidth: '80vw',
          textAlign: 'center',
          zIndex: 1001,
        }}>
          {imageDescription}
        </div>
      )}
    </div>
  );
} 