'use client';

import React, { useEffect, useRef } from 'react';

interface DescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  userId?: string;
  projectId?: string;
}

const DescriptionInput: React.FC<DescriptionInputProps> = ({
  value,
  onChange,
  onBlur,
  placeholder = "Enter description...",
  disabled = false,
  style = {},
  userId,
  projectId
}) => {
  // Refs for cursor position preservation
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPositionRef = useRef<number | null>(null);
  const isUserTypingRef = useRef(false);

  // Store cursor position before value changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    // Mark that user is actively typing
    isUserTypingRef.current = true;
    
    // Store cursor position for restoration
    cursorPositionRef.current = cursorPosition;
    
    onChange(newValue);
  };

  // Restore cursor position after re-render
  useEffect(() => {
    if (textareaRef.current && cursorPositionRef.current !== null && isUserTypingRef.current) {
      const textarea = textareaRef.current;
      const position = cursorPositionRef.current;
      
      // Use setTimeout to ensure this runs after React has updated the DOM
      setTimeout(() => {
        if (textarea === document.activeElement) {
          textarea.setSelectionRange(position, position);
        }
        // Reset the flag after restoring position
        isUserTypingRef.current = false;
        cursorPositionRef.current = null;
      }, 0);
    }
  }, [value]);

  // Handle blur event
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    
    // Clear typing flag when focus is lost
    isUserTypingRef.current = false;
    cursorPositionRef.current = null;
    
    if (onBlur) {
      onBlur(textarea.value);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="form-input"
      style={{
        width: '100%',
        minHeight: '120px',
        resize: 'vertical',
        fontFamily: 'inherit',
        ...style
      }}
    />
  );
};

export default DescriptionInput; 