import { useState, useEffect } from 'react';

type ViewMode = 'grid' | 'list';

export function useViewPreference(key: string, defaultView: ViewMode = 'grid') {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);

  // Load view preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`viewMode_${key}`);
      if (stored && (stored === 'grid' || stored === 'list')) {
        setViewMode(stored as ViewMode);
      }
    } catch (error) {
      console.warn('Failed to load view preference:', error);
    }
  }, [key]);

  // Save view preference to localStorage when it changes
  const setViewModeWithPersistence = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(`viewMode_${key}`, mode);
    } catch (error) {
      console.warn('Failed to save view preference:', error);
    }
  };

  // Toggle between grid and list view
  const toggleViewMode = () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewModeWithPersistence(newMode);
  };

  return {
    viewMode,
    setViewMode: setViewModeWithPersistence,
    toggleViewMode
  };
} 