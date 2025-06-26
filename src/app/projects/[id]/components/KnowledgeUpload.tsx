'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { specParser } from '../hooks/spec-parser';

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [parsedChunks, setParsedChunks] = useState<ParsedChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [showChunks, setShowChunks] = useState(false);

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
    if (!file) return;

    console.log(`Starting upload: ${file.name} (${fileType})`);

    setUploading(true);
    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

    try {
      // 1. Upload file to Supabase Storage
      const filePath = `${projectId}/${fileType}/${Date.now()}_${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-knowledge')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log(`File uploaded successfully: ${file.name}`);
      setUploadProgress(prev => ({ ...prev, [file.name]: 50 }));

      // 3. Insert record into project_knowledge table
      const { error: dbError } = await supabase
        .from('project_knowledge')
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_path: `project-knowledge/${filePath}`,
          file_type: fileType,
          file_size: file.size,
          uploaded_at: new Date().toISOString()
        });

      if (dbError) {
        // If database insert fails, clean up the uploaded file
        await supabase.storage
          .from('project-knowledge')
          .remove([filePath]);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

      // 4. Test parsing if it's a supported file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if ( fileExtension === 'docx') {
        console.log(`Testing ${fileExtension} parsing...`);
        
        try {
          await specParser.testDocumentParsing(filePath, file.name);
          console.log(`${fileExtension} parsing test completed successfully`);
        } catch (parseError) {
          console.error(`${fileExtension} parsing test failed:`, parseError);
        }
      }

      // 5. Reload documents list
      await loadDocuments();

      // 6. Call success callback
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

  const testDocumentParsing = async (document: KnowledgeDocument) => {
    setLoadingChunks(true);
    setSelectedDocument(document);
    
    try {
      // Extract the file path without the bucket prefix for the API
      const filePath = document.file_path.replace(/^project-knowledge\//, '');
      
      const result = await specParser.extractTextFromFile(filePath, document.file_name);
      
      // Convert chunks to our format
      const chunks: ParsedChunk[] = result.chunks.map((chunk: string, index: number) => ({
        content: chunk,
        chunkIndex: index + 1
      }));
      
      setParsedChunks(chunks);
      setShowChunks(true);
      
      console.log(`Parsed ${chunks.length} chunks from ${document.file_name}`);
    } catch (error) {
      console.error('Error parsing document:', error);
      if (onError) {
        onError(`Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setLoadingChunks(false);
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

      // 3. Reload documents list
      await loadDocuments();

      // 4. Clear any active chunks if the deleted document was selected
      if (selectedDocument?.id === document.id) {
        setSelectedDocument(null);
        setParsedChunks([]);
        setShowChunks(false);
      }

      console.log(`Document deleted successfully: ${document.file_name}`);
      
      // 5. Show success message
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

  const handleSpecUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'spec');
    }
    // Reset input
    event.target.value = '';
  };

  const handleBuildingCodeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'building_code');
    }
    // Reset input
    event.target.value = '';
  };

  return {
    handleSpecUpload,
    handleBuildingCodeUpload,
    uploading,
    uploadProgress,
    documents,
    selectedDocument,
    parsedChunks,
    loadingChunks,
    showChunks,
    testDocumentParsing,
    setShowChunks,
    formatFileSize,
    formatDate,
    deleteDocument
  };
} 