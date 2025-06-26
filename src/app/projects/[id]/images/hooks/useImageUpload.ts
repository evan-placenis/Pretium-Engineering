import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UseImageUploadProps {
  projectId: string;
  onSuccessMessage: (message: string) => void;
  onRefreshImages: () => Promise<void>;
}

interface UseImageUploadReturn {
  // Upload state
  uploadLoading: boolean;
  uploadProgress: string;
  showUploadModal: boolean;
  
  // Actions
  setShowUploadModal: (show: boolean) => void;
  handlePhotoUpload: (files: File[], dateTaken?: string, useFilenameAsDescription?: boolean) => Promise<void>;
}

export function useImageUpload({ 
  projectId, 
  onSuccessMessage,
  onRefreshImages 
}: UseImageUploadProps): UseImageUploadReturn {
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Handle bulk photo upload with progress tracking
  const handlePhotoUpload = async (files: File[], dateTaken: string = '', useFilenameAsDescription: boolean = false) => {
    if (files.length === 0) return;
    
    setUploadLoading(true);
    setUploadProgress('Starting upload...');
    
    try {
      let uploadedCount = 0;
      const totalFiles = files.length;
      
      for (const file of files) {
        setUploadProgress(`Uploading ${uploadedCount + 1}/${totalFiles}: ${file.name}`);
        
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `projects/${projectId}/${fileName}`;
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, file);
          
        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);
        
        // Extract EXIF data if available
        let extractedDate = dateTaken;
        let extractedDescription = '';
        
        if (useFilenameAsDescription) {
          extractedDescription = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        }
        
        // Create database record
        const { error: dbError } = await supabase
          .from('project_images')
          .insert({
            project_id: projectId,
            url: publicUrl,
            description: extractedDescription || null,
            created_at: extractedDate ? new Date(extractedDate).toISOString() : new Date().toISOString(),
            filename: file.name,
            file_size: file.size,
            mime_type: file.type
          });
          
        if (dbError) {
          console.error('Database error:', dbError);
          continue;
        }
        
        uploadedCount++;
      }
      
      if (uploadedCount > 0) {
        onSuccessMessage(`Successfully uploaded ${uploadedCount} of ${totalFiles} images`);
        await onRefreshImages();
      } else {
        onSuccessMessage('No images were uploaded successfully');
      }
      
    } catch (error: any) {
      console.error('Upload error:', error);
      onSuccessMessage('Upload failed: ' + error.message);
    } finally {
      setUploadLoading(false);
      setUploadProgress('');
      setShowUploadModal(false);
    }
  };

  return {
    uploadLoading,
    uploadProgress,
    showUploadModal,
    setShowUploadModal,
    handlePhotoUpload
  };
} 