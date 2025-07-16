'use client';
//page to create a new project
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { handleExcelUpload, validateProjectData } from '@/lib/utils';

export default function NewProject() {

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [project_name, setProjectName] = useState('');
  const [showExcelUpload, setShowExcelUpload] = useState(false);

  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          setUser(data.session.user);
        } else {
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await handleExcelUpload(file);
    if (result.success && result.data) {
      setFileData(result.data);
    } else {
      setError(result.error || 'An error occurred while processing the file');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to create a project');
      return;
    }

    if (!project_name.trim()) {
      setError('Please enter a project name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let sanitizedFileData: Record<string, any> = {};
      
      // If we have Excel data, validate it against database schema
      if (fileData && Object.keys(fileData).length > 0) {
        const validation = validateProjectData(fileData);

        if (validation.invalidFields.length > 0) {
          console.warn('⚠️ Filtered out invalid database fields during project creation:', validation.invalidFields);
          
          if (validation.invalidContractors.length > 0) {
            console.warn('❌ Invalid contractor numbers detected:', validation.invalidContractors);
          }
        }

        sanitizedFileData = validation.sanitizedData;

      }

      const projectData = {
        project_name: project_name.trim(),
        user_id: user.id,
        created_at: new Date().toISOString(),
        ...sanitizedFileData // Use sanitized data instead of raw fileData
      };
      
      const { error: insertError } = await supabase
        .from('projects')
        .insert(projectData);
      
      if (insertError) {
        throw new Error(insertError.message);
      }
      
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error creating project:', error);
      setError(error.message || 'An error occurred while creating the project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page-content">
      <div style={{ maxWidth: "42rem", margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>New Project</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.875rem" }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="form-group">
            <label htmlFor="project_name" className="form-label">
              Project Name (Display Name) *
            </label>
            <input
              type="text"
              id="project_name"
              value={project_name}
              onChange={(e) => setProjectName(e.target.value)}
              required
              className="form-input"
              placeholder="Enter project name..."
            />
          </div>

          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Import from Excel (Optional)</h3>
                <button
                  type="button"
                  onClick={() => setShowExcelUpload(!showExcelUpload)}
                  className="btn btn-secondary btn-sm"
                >
                  {showExcelUpload ? 'Hide Upload' : 'Add Excel Data'}
                </button>
              </div>
              
              {showExcelUpload && (
                <>
                  <p style={{ marginBottom: "1rem" }} className="text-secondary">
                    Upload an Excel file to automatically fill in the project details. The Excel file should have columns for Project Name, Location, Date, and Description.
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="excel-upload"
                  />
                  <label htmlFor="excel-upload" className="btn btn-secondary" style={{ marginBottom: "1rem" }}>
                    Upload Info Sheet (Excel File)
                  </label>
                  {fileData && (
                    <p style={{ fontSize: "0.875rem", color: "var(--color-success)" }}>
                      ✓ Excel file loaded successfully
                    </p>
                  )}
                </>
              )}
              
              {!showExcelUpload && (
                <p className="text-secondary" style={{ fontSize: '0.875rem' }}>
                  You can add detailed project information later by uploading an Excel file from the project page.
                </p>
              )}
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button
              type="submit"
              disabled={loading || !project_name.trim()}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 