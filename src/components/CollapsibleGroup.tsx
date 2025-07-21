'use client';
import { useState } from 'react';

/**
 * Props for the CollapsibleGroup component
 */
interface CollapsibleGroupProps {
  /** The name/title of the group to display in the header */
  groupName: string;
  /** Number of items in the group (for display purposes) */
  itemCount: number;
  /** Whether to show the edit button */
  showEditButton?: boolean;
  /** Whether to show the delete button */
  showDeleteButton?: boolean;
  /** Callback when the group name is changed (business logic) */
  onGroupNameChange?: (oldName: string, newName: string) => Promise<void>;
  /** Callback when the group is deleted (business logic) */
  onGroupDelete?: (groupName: string) => Promise<void>;
  /** The content to render inside the collapsible area */
  children: React.ReactNode;
  /** Custom CSS styles for the group container */
  style?: React.CSSProperties;
  /** Whether the group should be open by default */
  defaultOpen?: boolean;
  /** Whether to show selection controls */
  showSelectionControls?: boolean;
  /** Whether the group is fully selected */
  isFullySelected?: boolean;
  /** Whether the group is partially selected */
  isPartiallySelected?: boolean;
  /** Callback when group selection is toggled */
  onGroupSelectionToggle?: (groupName: string) => void;
}

/**
 * CollapsibleGroup Component
 * 
 * A reusable component that displays a group of items under a collapsible header.
 * Features:
 * - Expandable/collapsible content area (handled internally)
 * - Optional inline editing of group name (handled internally)
 * - Item count display
 * - Customizable styling
 * 
 * This component manages its own UI state (open/closed, editing mode)
 * and only requires a callback for business logic (saving group name changes).
 * 
 * Used in:
 * - Images page: Grouping uploaded photos by batch
 * - New report page: Grouping selected images for reports
 * - Any other page that needs grouped, collapsible content
 */
export default function CollapsibleGroup({
  groupName,
  itemCount,
  showEditButton = false,
  showDeleteButton = false,
  onGroupNameChange,
  onGroupDelete,
  children,
  style = {},
  defaultOpen = true,
  showSelectionControls = false,
  isFullySelected = false,
  isPartiallySelected = false,
  onGroupSelectionToggle
}: CollapsibleGroupProps) {
  // Internal UI state management
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(groupName);

  /**
   * Handle toggling the group open/closed
   */
  const handleToggle = () => {
    setIsOpen(prev => !prev);
  };

  /**
   * Start editing the group name
   */
  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingValue(groupName);
  };

  /**
   * Cancel editing and reset to original value
   */
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingValue(groupName);
  };

  /**
   * Save the new group name
   */
  const handleSaveEdit = async () => {
    const newName = editingValue.trim();
    
    // Validate input
    if (!newName || newName === groupName) {
      handleCancelEdit();
      return;
    }

    try {
      // Call business logic callback if provided
      if (onGroupNameChange) {
        await onGroupNameChange(groupName, newName);
      }
      
      // Update local state
      setIsEditing(false);
    } catch (error) {
      // If business logic fails, cancel the edit
      console.error('Failed to save group name:', error);
      handleCancelEdit();
    }
  };

  /**
   * Handle keyboard events during editing
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  /**
   * Handle group deletion
   */
  const handleDeleteGroup = async () => {
    if (!onGroupDelete) return;
    
    // Confirm deletion with user
    const confirmed = window.confirm(
      `Are you sure you want to delete the group "${groupName}" and all ${itemCount} item${itemCount !== 1 ? 's' : ''} in it? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      await onGroupDelete(groupName);
    } catch (error) {
      console.error('Failed to delete group:', error);
      // Error handling is done by the parent component
    }
  };

  return (
    <div 
      style={{ 
        marginBottom: '2rem', 
        border: '1px solid var(--color-border)', 
        borderRadius: '0.5rem', 
        background: 'var(--color-bg-card)',
        ...style
      }}
    >
      {/* Group Header - Clickable to toggle expand/collapse */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '1rem', 
          cursor: 'pointer', 
          background: 'var(--color-bg)', 
          borderTopLeftRadius: '0.5rem', 
          borderTopRightRadius: '0.5rem',
          borderBottom: isOpen ? '1px solid var(--color-border)' : 'none'
        }}
      >
        {/* Left side: Toggle button and group name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Expand/Collapse toggle button */}
          <button 
            onClick={handleToggle} 
            style={{ 
              fontSize: '1.25rem', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              color: 'var(--color-text)',
              padding: '0.25rem'
            }}
            aria-label={isOpen ? 'Collapse group' : 'Expand group'}
          >
            {isOpen ? '▼' : '▶'}
          </button>
          
          {/* Group name display or editing input */}
          {isEditing ? (
            // Inline editing mode
            <>
              <input
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ 
                  fontSize: '1.1rem', 
                  padding: '0.25rem 0.5rem', 
                  border: '1px solid var(--color-border)', 
                  borderRadius: '0.25rem',
                  minWidth: '200px'
                }}
                autoFocus
                placeholder="Enter group name"
              />
              <button 
                className="btn btn-primary btn-sm" 
                style={{ marginLeft: 8 }} 
                onClick={handleSaveEdit}
              >
                Save
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ marginLeft: 4 }} 
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </>
          ) : (
            // Normal display mode
            <>
              <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {groupName}
              </span>
              {showEditButton && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ marginLeft: 8 }} 
                  onClick={handleStartEdit}
                >
                  Edit
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Right side: Item count, selection checkbox, and delete button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Selection checkbox */}
          {showSelectionControls && (
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <input
                type="checkbox"
                checked={isFullySelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = isPartiallySelected && !isFullySelected;
                  }
                }}
                onChange={(e) => {
                  e.stopPropagation(); // Prevent triggering the toggle
                  if (onGroupSelectionToggle) {
                    onGroupSelectionToggle(groupName);
                  }
                }}
                style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  cursor: 'pointer',
                  accentColor: 'var(--color-primary)',
                  transform: 'scale(1.1)'
                }}
                title={isFullySelected ? 'Deselect all images in group' : 'Select all images in group'}
              />
            </div>
          )}
          
          <span style={{ 
            color: 'var(--color-text-secondary)', 
            fontSize: '0.95rem' 
          }}>
            {itemCount} Photo{itemCount !== 1 ? 's' : ''}
          </span>
          {showDeleteButton && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the toggle
                handleDeleteGroup();
              }}
              className="btn btn-danger btn-sm"
              style={{ 
                fontSize: '0.875rem',
                padding: '0.5rem 0.5rem'
              }}
              title={`Delete group "${groupName}" and all ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
            >
              Delete Group
            </button>
          )}
        </div>
      </div>
      
      {/* Collapsible content area */}
      {isOpen && (
        <div style={{ padding: '1.5rem' }}>
          {children}
        </div>
      )}
    </div>
  );
} 