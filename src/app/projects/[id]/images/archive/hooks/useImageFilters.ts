import { useState, useMemo } from 'react';
import { ExtendedProjectImage } from './useImageData';

interface UseImageFiltersProps {
  images: ExtendedProjectImage[];
  imagesInReports: Set<string>;
  currentUser: any;
}

interface UseImageFiltersReturn {
  // Filter state
  dateFilter: string;
  tagFilter: string;
  descriptionFilter: string;
  userFilter: string;
  reportUsageFilter: string;
  sortOrder: 'desc' | 'asc' | 'manual';
  
  // Filtered results
  filteredImages: ExtendedProjectImage[];
  
  // Actions
  setDateFilter: (filter: string) => void;
  setTagFilter: (filter: string) => void;
  setDescriptionFilter: (filter: string) => void;
  setUserFilter: (filter: string) => void;
  setReportUsageFilter: (filter: string) => void;
  setSortOrder: (order: 'desc' | 'asc' | 'manual') => void;
  handleSortChange: () => void;
  clearAllFilters: () => void;
}

export function useImageFilters({ 
  images, 
  imagesInReports, 
  currentUser 
}: UseImageFiltersProps): UseImageFiltersReturn {
  const [dateFilter, setDateFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [descriptionFilter, setDescriptionFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>(''); // 'all', 'mine', 'others'
  const [reportUsageFilter, setReportUsageFilter] = useState<string>(''); // 'all', 'unused', 'used'
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'manual'>('desc');

  // Apply filters and sorting
  const filteredImages = useMemo(() => {
    let filtered = [...images];

    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(img => {
        const imgDate = new Date(img.created_at);
        return imgDate.toDateString() === filterDate.toDateString();
      });
    }

    // Tag filter
    if (tagFilter) {
      filtered = filtered.filter(img => img.tag === tagFilter);
    }

    // Description filter
    if (descriptionFilter) {
      filtered = filtered.filter(img => 
        img.description?.toLowerCase().includes(descriptionFilter.toLowerCase())
      );
    }

    // User filter
    if (userFilter && currentUser) {
      if (userFilter === 'mine') {
        filtered = filtered.filter(img => img.user_id === currentUser.id);
      } else if (userFilter === 'others') {
        filtered = filtered.filter(img => img.user_id !== currentUser.id);
      }
    }

    // Report usage filter
    if (reportUsageFilter) {
      if (reportUsageFilter === 'used') {
        filtered = filtered.filter(img => imagesInReports.has(img.url));
      } else if (reportUsageFilter === 'unused') {
        filtered = filtered.filter(img => !imagesInReports.has(img.url));
      }
    }

    // Sorting
    if (sortOrder !== 'manual') {
      filtered.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
    }

    return filtered;
  }, [images, dateFilter, tagFilter, descriptionFilter, userFilter, reportUsageFilter, sortOrder, currentUser, imagesInReports]);

  // Cycle through sort orders
  const handleSortChange = () => {
    setSortOrder(prev => {
      if (prev === 'desc') return 'asc';
      if (prev === 'asc') return 'manual';
      return 'desc';
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setDateFilter('');
    setTagFilter('');
    setDescriptionFilter('');
    setUserFilter('');
    setReportUsageFilter('');
  };

  return {
    dateFilter,
    tagFilter,
    descriptionFilter,
    userFilter,
    reportUsageFilter,
    sortOrder,
    filteredImages,
    setDateFilter,
    setTagFilter,
    setDescriptionFilter,
    setUserFilter,
    setReportUsageFilter,
    setSortOrder,
    handleSortChange,
    clearAllFilters
  };
} 