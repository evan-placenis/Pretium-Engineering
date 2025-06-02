'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function UploadTemplate() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // First verify authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication error:', authError);
        throw new Error('You must be signed in to upload templates');
      }
      console.log('User authenticated:', user.id);

      // 1. Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `templates/${fileName}`;

      console.log('Attempting to upload file:', {
        bucket: 'report-template',
        path: filePath,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      // First check if we have access to the bucket
      const { data: bucketData, error: bucketError } = await supabase
        .storage
        .getBucket('report-template');

      if (bucketError) {
        console.error('Bucket access error details:', {
          error: bucketError,
          message: bucketError.message
        });
        throw new Error(`Unable to access storage bucket: ${bucketError.message}`);
      }

      console.log('Bucket access successful:', bucketData);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('report-template')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error details:', {
          error: uploadError,
          message: uploadError.message
        });
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData);

      // Generate a signed URL for the uploaded file
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('report-template')
        .createSignedUrl(filePath, 60 * 60 * 8); // 8 hours in seconds

      if (signedUrlError) {
        console.error('Error generating signed URL:', signedUrlError);
        throw new Error(`Failed to generate signed URL: ${signedUrlError.message}`);
      }

      console.log('Generated signed URL:', signedUrlData);

      // 2. Create template record
      const { data: insertData, error: dbError } = await supabase
        .from('report_templates')
        .insert([
          {
            name,
            file_path: filePath,
            is_active: true,
            signed_url: signedUrlData.signedUrl // Store the signed URL
          }
        ])
        .select();

      if (dbError) {
        console.error('Database insert error details:', {
          error: dbError,
          message: dbError.message
        });
        // If database insert fails, try to delete the uploaded file
        const { error: deleteError } = await supabase.storage
          .from('report-template')
          .remove([filePath]);
        
        if (deleteError) {
          console.error('Failed to clean up uploaded file:', deleteError);
        }
        
        throw new Error(`Failed to save template record: ${dbError.message}`);
      }

      console.log('Template record created successfully:', insertData);
      setSuccess(true);
      setFile(null);
      setName('');
    } catch (error: any) {
      console.error('Error in template upload:', {
        message: error.message,
        error: error
      });
      setError(error.message || 'An error occurred during upload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '2rem auto' , paddingTop: '4rem'}}>
      <div className="card">
        <div className="card-body">
          <h1 style={{ marginBottom: '1.5rem' }}>Upload Template</h1>
          
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          {success && (
            <div className="alert alert-success" role="alert">
              Template uploaded successfully!
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="name" className="form-label">Template Name</label>
              <input
                type="text"
                id="name"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter template name"
                required
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="file" className="form-label">Template File</label>
              <input
                type="file"
                id="file"
                className="form-control"
                onChange={handleFileChange}
                accept=".docx,.pdf"
                required
              />
              <small className="text-secondary">
                Supported formats: .docx, .pdf
              </small>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !file || !name}
              >
                {loading ? 'Uploading...' : 'Upload Template'}
              </button>
              <Link href="/settings/templates" className="btn btn-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 