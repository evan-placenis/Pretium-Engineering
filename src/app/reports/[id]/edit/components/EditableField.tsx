import React, { useState, useEffect, useRef } from 'react';
import styles from './EditableField.module.css';

interface EditableFieldProps {
  initialValue: string;
  onSave: (newValue: string) => void;
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  multiline?: boolean;
  className?: string;
}

export const EditableField: React.FC<EditableFieldProps> = ({
  initialValue,
  onSave,
  as: Component,
  multiline = false,
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // For textarea, resize to fit content
      if (inputRef.current.tagName === 'TEXTAREA') {
        const textarea = inputRef.current as HTMLTextAreaElement;
        textarea.style.height = 'auto'; // Reset height
        textarea.style.height = `${textarea.scrollHeight}px`; // Set to content height
      }
    }
  }, [isEditing, value]); // Rerun on value change for textarea resizing

  const handleSave = () => {
    if (value !== initialValue) {
      onSave(value);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`${styles.baseInput} ${styles.subpointStyle} ${className}`}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`${styles.baseInput} ${styles.headerStyle} ${className}`}
      />
    );
  }

  return (
    <Component
      className={`${styles.editableTarget} ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {value || "..."}
    </Component>
  );
};
