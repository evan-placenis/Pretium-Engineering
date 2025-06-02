'use client';
//hadnel word document uploads for training the AI
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import mammoth from 'mammoth';

export default function Training() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('training_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error) {
        setDocuments(data || []);
      } else {
        console.error('Error fetching documents:', error);
      }
      setLoading(false);
    };

    fetchDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Skip non-docx files
        if (!file.name.endsWith('.docx')) {
          setError('Please upload only .docx files');
          continue;
        }

        // Read the file
        const arrayBuffer = await file.arrayBuffer();
        
        // Extract text using mammoth
        const result = await mammoth.extractRawText({ arrayBuffer });
        const extractedText = result.value;
        
        // Save to database
        const { error } = await supabase
          .from('training_documents')
          .insert([
            {
              filename: file.name,
              content: extractedText,
            },
          ]);

        if (error) throw error;
      }
      
      setSuccess('Document(s) uploaded successfully');
      
      // Refresh the document list
      const { data } = await supabase
        .from('training_documents')
        .select('*')
        .order('created_at', { ascending: false });
      
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      setError(error.message || 'An error occurred during upload');
    } finally {
      setUploading(false);
      // Reset file input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const { error } = await supabase
        .from('training_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update documents list
      setDocuments(documents.filter(doc => doc.id !== id));
      setSuccess('Document deleted successfully');
    } catch (error: any) {
      console.error('Error deleting document:', error);
      setError(error.message || 'An error occurred while deleting the document');
    }
  };

  return (
    <div className="container page-content">
      <header style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "0.5rem", display: "flex" }}>
          <Link
            href="/settings"
            className="mr-2 text-accent"
          >
            ← Back to Settings
          </Link>
        </div>
        <h1>AI Training Documents</h1>
        <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }} className="text-secondary">
          Upload example reports to train the AI on your company's writing style
        </p>
      </header>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem" }}>{error}</div>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem" }}>{success}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: "2rem" }}>
        <div className="card-body">
          <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: "600" }}>Upload Documents</h2>
          <p style={{ marginBottom: "1rem" }} className="text-secondary">
            Upload Word (.docx) files containing example reports. These will be used to help the AI understand your company's writing style.
          </p>
          <div style={{ display: "flex" }}>
            <label className="block">
              <span className="sr-only">Choose files</span>
              <input
                type="file"
                className="form-input"
                onChange={handleFileUpload}
                accept=".docx"
                multiple
                disabled={uploading}
              />
            </label>
            {uploading && <p style={{ marginLeft: "1rem", fontSize: "0.875rem" }} className="text-secondary">Uploading...</p>}
          </div>
        </div>
      </div>

      <div>
        <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: "600" }}>Uploaded Documents</h2>
        {loading ? (
          <p className="text-secondary">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="text-secondary">No documents uploaded yet</p>
        ) : (
          <div className="card">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "var(--color-text-lighter)" }}>
                    File Name
                  </th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "var(--color-text-lighter)" }}>
                    Upload Date
                  </th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "left", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "var(--color-text-lighter)" }}>
                    Content Preview
                  </th>
                  <th style={{ padding: "0.75rem 1.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: "600", textTransform: "uppercase", color: "var(--color-text-lighter)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", fontWeight: "500" }}>
                      {doc.filename}
                    </td>
                    <td style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap", fontSize: "0.875rem", color: "var(--color-text-light)" }}>
                      {new Date(doc.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.75rem 1.5rem", fontSize: "0.875rem", color: "var(--color-text-light)" }}>
                      {doc.content.substring(0, 100)}
                      {doc.content.length > 100 ? '...' : ''}
                    </td>
                    <td style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap", textAlign: "right", fontSize: "0.875rem", fontWeight: "500" }}>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="btn btn-sm"
                        style={{ color: "var(--color-accent)" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 