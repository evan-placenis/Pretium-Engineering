'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface KnowledgeUploadProps {
  projectId: string;
  onUploadComplete?: () => void;
  onError?: (error: string) => void;
}

interface KnowledgeDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: 'spec' | 'building_code';
  file_size: number;
  uploaded_at: string;
}

interface ParsedChunk {
  content: string;
  sectionTitle?: string;
  chunkIndex: number;
}

export default function KnowledgeUpload({ projectId, onUploadComplete, onError }: KnowledgeUploadProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [parsedChunks, setParsedChunks] = useState<ParsedChunk[]>([]);
  const [showChunks, setShowChunks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Multiple file upload state
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [uploadType, setUploadType] = useState<'spec' | 'building_code'>('spec');
  const [showMultipleUploadModal, setShowMultipleUploadModal] = useState(false);
  const [multipleUploadProgress, setMultipleUploadProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
    isProcessing: boolean;
  } | null>(null);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('project_knowledge')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error loading documents:', error);
        return;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const handleFileUpload = async (file: File, fileType: 'spec' | 'building_code') => {
    if (!projectId) return;
    
    setUploading(true);
    setError(null);
    
    try {
      // 1. Upload file to Supabase storage
      const filePath = `${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('project-knowledge')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setUploadProgress(prev => ({ ...prev, [file.name]: 50 }));

      // 2. Insert record into project_knowledge table
      const { data: insertData, error: dbError } = await supabase
        .from('project_knowledge')
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_path: `project-knowledge/${filePath}`,
          file_type: fileType,
          file_size: file.size,
          uploaded_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        // If database insert fails, clean up the uploaded file
        await supabase.storage
          .from('project-knowledge')
          .remove([filePath]);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      const knowledgeId = insertData.id;
      console.log(`Knowledge record created with ID: ${knowledgeId}`);

      setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

      // 3. Process document and generate embeddings if it's a supported file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'docx') {
        console.log(`Processing ${fileExtension} document and generating embeddings...`);
        
        try {
          // Call the parse-document API directly for embedding processing
          const response = await fetch('/api/parse-document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filePath,
              fileName: file.name,
              projectId,
              knowledgeId,
              skipEmbeddings: false
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Document processing failed');
          }

          console.log(`${fileExtension} processing and embedding generation completed successfully`);
        } catch (parseError) {
          console.error(`${fileExtension} processing and embedding generation failed:`, parseError);
        }
      }

      // 4. Reload documents list
      await loadDocuments();

      // 5. Call success callback
      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      if (onError) {
        onError(error.message);
      }
    } finally {
      setUploading(false);
      // Clear progress after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      }, 2000);
    }
  };

  const deleteDocument = async (document: KnowledgeDocument) => {
    if (!confirm(`Are you sure you want to delete "${document.file_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Extract the file path without the bucket prefix for storage deletion
      const filePath = document.file_path.replace(/^project-knowledge\//, '');
      
      // 1. Delete from Supabase storage
      const { error: storageError } = await supabase.storage
        .from('project-knowledge')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        throw new Error(`Failed to delete file from storage: ${storageError.message}`);
      }

      // 2. Delete from database
      const { error: dbError } = await supabase
        .from('project_knowledge')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw new Error(`Failed to delete from database: ${dbError.message}`);
      }

      // 3. Delete related embeddings from project_embeddings table
      const { error: embeddingsError } = await supabase
        .from('project_embeddings')
        .delete()
        .eq('knowledge_id', document.id);

      if (embeddingsError) {
        console.error('Embeddings deletion error:', embeddingsError);
        // Don't throw error here as the main document is already deleted
        console.warn(`Failed to delete embeddings for document ${document.id}: ${embeddingsError.message}`);
      } else {
        console.log(`Deleted embeddings for document: ${document.id}`);
      }

      // 4. Reload documents list
      await loadDocuments();

      // 5. Clear any active chunks if the deleted document was selected
      if (selectedDocument?.id === document.id) {
        setSelectedDocument(null);
        setParsedChunks([]);
        setShowChunks(false);
      }

      console.log(`Document deleted successfully: ${document.file_name}`);
      
      // 6. Show success message
      if (onUploadComplete) {
        onUploadComplete(); // Reuse the success callback
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      if (onError) {
        onError(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };

  const handleSpecUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleFileUpload(file, 'spec');
    }
    // Reset input
    event.target.value = '';
  };

  const handleBuildingCodeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleFileUpload(file, 'building_code');
    }
    // Reset input
    event.target.value = '';
  };

  // Handle multiple file upload from modal
  const handleMultipleFileUpload = async (files: File[], uploadType: 'spec' | 'building_code') => {
    if (files.length === 0) return;

    // Close modal and show progress immediately
    setShowMultipleUploadModal(false);
    
    // Set uploading state to true for the entire batch
    setUploading(true);
    
    // Initialize progress state
    setMultipleUploadProgress({
      current: 0,
      total: files.length,
      currentFileName: '',
      isProcessing: false
    });
    
    // Small delay to ensure modal closes and progress shows
    await new Promise(resolve => setTimeout(resolve, 100));
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Update progress to show current file
      setMultipleUploadProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentFileName: file.name,
        isProcessing: true
      } : null);
      
      try {
        console.log(`Starting upload ${i + 1}/${files.length}: ${file.name}`);
        
        // Use the existing upload handler but don't let it manage the uploading state
        // since we're managing it at the batch level
        await handleFileUploadInternal(file, uploadType);
        
        console.log(`Completed upload ${i + 1}/${files.length}: ${file.name}`);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        // Continue with next file even if one fails
      }

      // Small delay between uploads to prevent overwhelming the server
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Clear progress and uploading state after completion
    setTimeout(() => {
      setMultipleUploadProgress(null);
      setUploading(false);
    }, 2000);

    // Reload documents list
    await loadDocuments();

    // Call success callback
    if (onUploadComplete) {
      onUploadComplete();
    }
  };



  // Internal upload handler that doesn't manage the uploading state
  const handleFileUploadInternal = async (file: File, fileType: 'spec' | 'building_code') => {
    if (!projectId) return;
    
    try {
      // 1. Upload file to Supabase storage
      const filePath = `${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('project-knowledge')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 2. Insert record into project_knowledge table
      const { data: insertData, error: dbError } = await supabase
        .from('project_knowledge')
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_path: `project-knowledge/${filePath}`,
          file_type: fileType,
          file_size: file.size,
          uploaded_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        // If database insert fails, clean up the uploaded file
        await supabase.storage
          .from('project-knowledge')
          .remove([filePath]);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      const knowledgeId = insertData.id;
      console.log(`Knowledge record created with ID: ${knowledgeId}`);

      // 3. Process document and generate embeddings if it's a supported file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'docx') {
        console.log(`Processing ${fileExtension} document and generating embeddings...`);
        
        try {
          // Call the parse-document API directly for embedding processing
          const response = await fetch('/api/parse-document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filePath,
              fileName: file.name,
              projectId,
              knowledgeId,
              skipEmbeddings: false
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Document processing failed');
          }

          console.log(`${fileExtension} processing and embedding generation completed successfully`);
        } catch (parseError) {
          console.error(`${fileExtension} processing and embedding generation failed:`, parseError);
        }
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      throw error; // Re-throw so the calling function can handle it
    }
  };

  const handleShowChunks = (document: KnowledgeDocument) => {
    setSelectedDocument(document);
    setShowChunks(true);
    // TODO: Load chunks for the selected document if needed
    // For now, the chunks will be shown if they're already loaded
  };

  return {
    handleSpecUpload,
    handleBuildingCodeUpload,
    handleMultipleFileUpload,
    uploading,
    uploadProgress,
    multipleUploadProgress,
    documents,
    selectedDocument,
    parsedChunks,
    showChunks,
    setShowChunks,
    formatFileSize,
    formatDate,
    deleteDocument,
    handleShowChunks,
    // Multiple file upload state
    showMultipleUploadModal,
    setShowMultipleUploadModal
  };
} 