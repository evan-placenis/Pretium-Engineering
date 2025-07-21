'use client';

import { useState, useMemo, useEffect } from 'react';

/**
 * Interface for image items that can be filtered
 */
export interface FilterableImage {
  id: string;
  description?: string;
  created_at?: string;
  user_id?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Filter criteria interface
 */
export interface FilterCriteria {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  descriptionKeywords?: string;
}

/**
 * Props for the ImageFilter component
 */
interface ImageFilterProps {
  /** List of all images to filter */
  images: FilterableImage[];
  /** Callback when filters change, receives filtered images */
  onFilterChange: (filteredImages: FilterableImage[]) => void;
  /** Available users for filtering (optional - will be auto-detected if not provided) */
  availableUsers?: Array<{ id: string; name: string }>;
  /** Current user ID for highlighting */
  currentUserId?: string;
  /** Whether to show the filter panel (default: true) */
  showFilters?: boolean;
  /** Custom styles for the filter container */
  style?: React.CSSProperties;
}

/**
 * ImageFilter Component
 * 
 * A reusable component for filtering images by:
 * - Date range (from/to dates)
 * - User (who uploaded the image)
 * - Description keywords (text search)
 * 
 * Features:
 * - Real-time filtering as user types/selects
 * - Auto-detection of available users from image data
 * - Highlighting of current user
 * - Collapsible filter panel
 * - Clear filters functionality
 * 
 * Used in:
 * - Images page: Filter project images
 * - New report page: Filter selected images
 * - Any other page that needs image filtering
 */
export default function ImageFilter({
  images,
  onFilterChange,
  availableUsers,
  currentUserId,
  showFilters = true,
  style = {}
}: ImageFilterProps) {
  // Filter state
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({});
  const [showClearButton, setShowClearButton] = useState(false);

  // Auto-detect available users if not provided
  const detectedUsers = useMemo(() => {
    if (availableUsers) return availableUsers;
    
    const userMap = new Map<string, string>();
    images.forEach(img => {
      if (img.user_id) {
        userMap.set(img.user_id, img.user_id === currentUserId ? 'You' : 'Other User');
      }
    });
    
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [images, availableUsers, currentUserId]);

  // Apply filters to images
  const filteredImages = useMemo(() => {
    let result = [...images];

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      result = result.filter(img => {
        if (!img.created_at) return false;
        const imgDate = new Date(img.created_at);
        return imgDate >= fromDate;
      });
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      result = result.filter(img => {
        if (!img.created_at) return false;
        const imgDate = new Date(img.created_at);
        return imgDate <= toDate;
      });
    }

    // Filter by user
    if (filters.userId) {
      result = result.filter(img => img.user_id === filters.userId);
    }

    // Filter by description keywords
    if (filters.descriptionKeywords) {
      const keywords = filters.descriptionKeywords.toLowerCase().split(' ').filter(k => k.length > 0);
      result = result.filter(img => {
        if (!img.description) return false;
        const description = img.description.toLowerCase();
        return keywords.every(keyword => description.includes(keyword));
      });
    }

    return result;
  }, [images, filters]);

  // Update parent component when filters change
  useEffect(() => {
    onFilterChange(filteredImages);
  }, [filteredImages, onFilterChange]);

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(value => value && value.toString().trim() !== '');

  // Update showClearButton based on active filters
  useMemo(() => {
    setShowClearButton(hasActiveFilters);
  }, [hasActiveFilters]);

  /**
   * Update a specific filter
   */
  const updateFilter = (key: keyof FilterCriteria, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value.trim() === '' ? undefined : value
    }));
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setFilters({});
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!showFilters) {
    return null;
  }

  return (
    <div style={{
      marginBottom: '1.5rem',
      background: 'linear-gradient(135deg,rgb(30, 33, 48) 0%,rgb(22, 13, 32) 100%)',
      borderRadius: '0.75rem',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      overflow: 'hidden',
      ...style
    }}>
      {/* Filter Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem',
          cursor: 'pointer',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.2)' : 'none'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ 
            fontSize: '1.5rem', 
            color: 'white',
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>
            ▶
          </span>
          <span style={{ 
            fontWeight: '700', 
            fontSize: '1.1rem',
            color: 'white',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
          }}>
            🔍 Filter Photos
          </span>
          {hasActiveFilters && (
            <span style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: '#667eea',
              borderRadius: '50%',
              width: '1.75rem',
              height: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: '700',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }}>
              {filteredImages.length}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {showClearButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
              style={{ 
                fontSize: '0.875rem',
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Clear Filters
            </button>
          )}
          <span style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            fontSize: '0.9rem',
            fontWeight: '500',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
          }}>
            {filteredImages.length} of {images.length} photos
          </span>
        </div>
      </div>

      {/* Filter Controls */}
      {isExpanded && (
        <div style={{ 
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        {/* Date Range Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* From Date Filter */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              {/* To Date Filter */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  To
                </label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </div>

            {/* User Filter */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                User
              </label>
              <select
                value={filters.userId || ''}
                onChange={(e) => updateFilter('userId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem',
                  background: 'var(--color-bg)'
                }}
              >
                <option value="">All Users</option>
                {detectedUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description Keywords Filter */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Description Keywords
              </label>
              <input
                type="text"
                value={filters.descriptionKeywords || ''}
                onChange={(e) => updateFilter('descriptionKeywords', e.target.value)}
                placeholder="Search in descriptions..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.25rem',
                  fontSize: '0.875rem'
                }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                Separate multiple words with spaces
              </p>
            </div>


          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              background: 'var(--color-bg)', 
              borderRadius: '0.25rem',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Active Filters:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {filters.dateFrom && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--color-primary)',
                    color: 'white',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem'
                  }}>
                    From: {formatDate(filters.dateFrom)}
                  </span>
                )}
                {filters.dateTo && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--color-primary)',
                    color: 'white',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem'
                  }}>
                    To: {formatDate(filters.dateTo)}
                  </span>
                )}
                {filters.userId && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--color-primary)',
                    color: 'white',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem'
                  }}>
                    User: {detectedUsers.find(u => u.id === filters.userId)?.name}
                  </span>
                )}
                {filters.descriptionKeywords && (
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--color-primary)',
                    color: 'white',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem'
                  }}>
                    Keywords: "{filters.descriptionKeywords}"
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 