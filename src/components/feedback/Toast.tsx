'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string | null;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export default function Toast({ message, type = 'success', duration = 3000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration]);

  if (!message || !isVisible) return null;

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#4CAF50';
      case 'error':
        return '#F44336';
      case 'warning':
        return '#FF9800';
      case 'info':
        return '#2196F3';
      default:
        return '#4CAF50';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: getBackgroundColor(),
        color: 'white',
        padding: '1rem',
        borderRadius: '4px',
        zIndex: 1000,
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        transition: 'opacity 0.3s ease-in-out',
        opacity: isVisible ? 1 : 0
      }}
    >
      {message}
    </div>
  );
} 