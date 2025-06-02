'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  file_path: string;
  is_active: boolean;
  created_at: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p className="text-secondary">Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="container page-content" style={{ maxWidth: "800px", padding: "2rem", marginTop: "4rem"}}>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "0.5rem", display: "flex" }}>
          <Link
            href="/settings"
            className="mr-2 text-accent"
          >
            ← Back to Settings
          </Link>
        </div>
        <h1 style={{ marginBottom: "0.5rem" }}>Report Templates</h1>
        <p className="text-secondary">
          Manage templates used for generating reports
        </p>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: "2rem" }}>
        <Link href="/settings/templates/upload" className="btn btn-primary">
          Upload New Template
        </Link>
      </div>

      {templates.length > 0 ? (
        <div className="card">
          <div className="card-body">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>Status</th>
                  <th style={{ textAlign: 'left' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.name}</td>
                    <td>
                      {template.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-secondary">Inactive</span>
                      )}
                    </td>
                    <td>{new Date(template.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <p className="text-secondary">No templates uploaded yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}