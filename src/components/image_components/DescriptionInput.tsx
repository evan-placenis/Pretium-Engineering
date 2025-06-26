'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Global state management for description suggestions
 * This is shared across all DescriptionInput components to maintain consistency
 */
const descriptionCache = new Map<string, string[]>(); // Cache of descriptions per project/user
const cacheTimestamps = new Map<string, number>();    // When each cache was last updated
const loadingPromises = new Map<string, Promise<string[]>>(); // Track in-progress fetches
const CACHE_DURATION = 15 * 60 * 1000; // Cache expires after 15 minutes

/**
 * Event system to notify all DescriptionInput components when the cache updates
 * This ensures all components stay in sync when descriptions are added/updated
 */
const cacheUpdateListeners = new Map<string, Set<() => void>>();

function subscribeToCacheUpdates(cacheKey: string, callback: () => void) {
  if (!cacheUpdateListeners.has(cacheKey)) {
    cacheUpdateListeners.set(cacheKey, new Set());
  }
  cacheUpdateListeners.get(cacheKey)!.add(callback);
  return () => {
    cacheUpdateListeners.get(cacheKey)?.delete(callback);
  };
}

function notifyCacheUpdate(cacheKey: string) {
  cacheUpdateListeners.get(cacheKey)?.forEach(callback => callback());
}

interface DescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  hasChanges?: boolean;
  userId?: string;
  projectId?: string;
}

/**
 * DescriptionInput Component
 * 
 * A textarea input with autocomplete suggestions based on previously used descriptions.
 * Features:
 * - Auto-saves descriptions when focus is lost
 * - Shows suggestions as you type
 * - Tab to complete suggestions
 * - Maintains a cache of descriptions per project/user
 * - Syncs suggestions across all instances
 */
export default function DescriptionInput({
  value,
  onChange,
  onBlur,
  placeholder = "Enter notes for this image...",
  disabled = false,
  style,
  hasChanges = false,
  userId,
  projectId
}: DescriptionInputProps) {
  const [suggestion, setSuggestion] = useState<string>('');
  const [previousDescriptions, setPreviousDescriptions] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set up global cache invalidation handler
  useEffect(() => {
    (window as any).invalidateDescriptionCache = (projectId: string) => {
      const cacheKey = projectId || `user_${userId}`;
      
      // Clear the cache
      descriptionCache.delete(cacheKey);
      cacheTimestamps.delete(cacheKey);
      loadingPromises.delete(cacheKey);
      
      // Notify all components to refresh
      notifyCacheUpdate(cacheKey);
      setRefreshKey(prev => prev + 1);
    };
  }, [userId]);

  // Subscribe to cache updates from other components
  useEffect(() => {
    const cacheKey = projectId || `user_${userId}`;
    const unsubscribe = subscribeToCacheUpdates(cacheKey, () => {
      setRefreshKey(prev => prev + 1);
    });
    return unsubscribe;
  }, [projectId, userId]);

  // Fetch and maintain the list of previous descriptions
  useEffect(() => {
    const fetchPreviousDescriptions = async () => {
      const cacheKey = projectId || `user_${userId}`;
      
      // Use cached data if available and not expired
      const cachedData = descriptionCache.get(cacheKey);
      const cacheTime = cacheTimestamps.get(cacheKey);
      const now = Date.now();
      
      if (cachedData && cacheTime && (now - cacheTime < CACHE_DURATION)) {
        setPreviousDescriptions(cachedData);
        return;
      }
      
      // If another component is already fetching, wait for its result
      const existingPromise = loadingPromises.get(cacheKey);
      if (existingPromise) {
        try {
          const descriptions = await existingPromise;
          setPreviousDescriptions(descriptions);
          return;
        } catch (error) {
          loadingPromises.delete(cacheKey);
        }
      }
      
      // Fetch fresh data from the database
      if (!projectId && !userId) return;
      
      const fetchPromise = (async (): Promise<string[]> => {
        try {
          let query = supabase
            .from('project_images')
            .select('description')
            .not('description', 'is', null)
            .not('description', 'eq', '');

          // Prefer project-specific descriptions over user-specific
          if (projectId) {
            query = query.eq('project_id', projectId);
          } else if (userId) {
            query = query.eq('user_id', userId);
          }

          const { data, error } = await query;
          if (error) throw error;

          // Process and deduplicate descriptions
          const descriptions = data
            .map(item => item.description?.trim())
            .filter((desc): desc is string => Boolean(desc))
            .filter((desc, index, arr) => arr.indexOf(desc) === index)
            .sort((a, b) => b.length - a.length);
          
          // Update cache and notify other components
          descriptionCache.set(cacheKey, descriptions);
          cacheTimestamps.set(cacheKey, now);
          notifyCacheUpdate(cacheKey);
          
          return descriptions;
        } finally {
          loadingPromises.delete(cacheKey);
        }
      })();
      
      loadingPromises.set(cacheKey, fetchPromise);
      
      try {
        const descriptions = await fetchPromise;
        setPreviousDescriptions(descriptions);
      } catch (error) {
        // Silently fail - will retry next time
      }
    };

    fetchPreviousDescriptions();
  }, [userId, projectId, refreshKey]);

  // Find and update suggestions as user types
  useEffect(() => {
    if (!value.trim() || value.length < 3) {
      setSuggestion('');
      return;
    }

    const currentValue = value.toLowerCase().trim();
    
    // Find all descriptions that start with the current input
    const matchingDescriptions = previousDescriptions.filter(desc => {
      const descLower = desc.toLowerCase();
      return descLower.startsWith(currentValue) && descLower !== currentValue;
    });

    // If we have matches, use the most relevant one
    if (matchingDescriptions.length > 0) {
      // Sort by:
      // 1. Exact prefix match (case-insensitive)
      // 2. Length (prefer longer matches)
      const bestMatch = matchingDescriptions.sort((a, b) => {
        const aStartsWith = a.toLowerCase().startsWith(currentValue);
        const bStartsWith = b.toLowerCase().startsWith(currentValue);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return b.length - a.length;
      })[0];

      setSuggestion(bestMatch);
    } else {
      setSuggestion('');
    }
  }, [value, previousDescriptions]);

  // Handle keyboard events (Tab to complete)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && suggestion && suggestion !== value) {
      e.preventDefault();
      onChange(suggestion);
      setSuggestion('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleSuggestionClick = () => {
    if (suggestion) {
      onChange(suggestion);
      setSuggestion('');
      textareaRef.current?.focus();
    }
  };

  const handleBlur = () => {
    if (onBlur) {
      onBlur(value);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          minHeight: '200px',
          padding: '0.75rem',
          fontSize: '0.875rem',
          border: '1px solid var(--color-border)',
          borderRadius: '0.25rem',
          resize: 'vertical',
          backgroundColor: hasChanges ? 'rgba(255, 255, 0, 0.1)' : 'var(--color-bg)',
          fontFamily: 'inherit',
          lineHeight: '1.4',
          ...style
        }}
      />
      
      {/* Suggestion overlay - shows the suggested completion */}
      {suggestion && value && (
        <div
          style={{
            position: 'absolute',
            top: '0.75rem',
            left: '0.75rem',
            right: '0.75rem',
            pointerEvents: 'none',
            fontSize: '0.875rem',
            lineHeight: '1.4',
            color: 'transparent',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            zIndex: 1,
            fontFamily: 'inherit'
          }}
        >
          {/* Render the current text invisibly to position the suggestion correctly */}
          <span style={{ visibility: 'hidden' }}>{value}</span>
          <span style={{ 
            color: 'rgba(107, 114, 128, 0.6)',
            backgroundColor: 'rgba(107, 114, 128, 0.1)',
            padding: '0 2px',
            borderRadius: '2px'
          }}>
            {suggestion.slice(value.length)}
          </span>
        </div>
      )}
      
      {/* Suggestion hint - shows how to accept the suggestion */}
      {suggestion && value && suggestion !== value && (
        <div
          style={{
            position: 'absolute',
            bottom: '-1.5rem',
            left: '0',
            right: '0',
            fontSize: '0.75rem',
            color: 'var(--color-text-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>💡 Press Tab to complete</span>
          <button
            type="button"
            onClick={handleSuggestionClick}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-light)',
              fontSize: '0.75rem',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(43, 87, 154, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Complete
          </button>
        </div>
      )}
    </div>
  );
} 