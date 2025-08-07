'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Project, Report } from '@/lib/supabase';
import { handleExcelUpload, validateProjectData } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useViewPreference } from '@/hooks/useViewPreference';
import KnowledgeUpload from './components/KnowledgeUpload';
import KnowledgeViewer from './components/KnowledgeViewer';
import Breadcrumb from '@/components/Breadcrumb';
import { getReportImage } from '@/lib/image-utils';

export default function ProjectPage({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [fileData, setFileData] = useState<any>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [knowledgeUploadError, setKnowledgeUploadError] = useState<string | null>(null);
  const [knowledgeUploadSuccess, setKnowledgeUploadSuccess] = useState<string | null>(null);
  const [isProjectDetailsExpanded, setIsProjectDetailsExpanded] = useState(false);
  const router = useRouter();
  
  // Use the view preference hook for persistent view state
  const { viewMode: reportViewMode, toggleViewMode: toggleReportViewMode } = useViewPreference('project-reports');

  // Initialize knowledge upload functionality
  const knowledgeUpload = KnowledgeUpload({
    projectId: id,
    onUploadComplete: () => {
      setKnowledgeUploadSuccess('File uploaded successfully!');
      setKnowledgeUploadError(null);
      setTimeout(() => setKnowledgeUploadSuccess(null), 3000);
    },
    onError: (error: string) => {
      setKnowledgeUploadError(error);
      setKnowledgeUploadSuccess(null);
    }
  });

  useEffect(() => {
    const fetchProjectAndReports = async () => {
      try {
        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch associated reports
        const { data: reportsData, error: reportsError } = await supabase
          .from('reports')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false });

        if (reportsError) throw reportsError;
        setReports(reportsData || []);
      } catch (err: any) {
        console.error('Error fetching project data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndReports();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      
      // 1. Delete project images from storage (project-images/{projectId}/)
      const { data: projectImages } = await supabase
        .from('project_images')
        .select('url')
        .eq('project_id', id);

      if (projectImages && projectImages.length > 0) {
        // Extract the correct file paths from URLs
        const projectImagePaths = projectImages.map(img => {
          const url = new URL(img.url);
          const pathParts = url.pathname.split('/');
          // Find the index of 'project-images' and get everything after it
          const projectImagesIndex = pathParts.findIndex(part => part === 'project-images');
          if (projectImagesIndex !== -1) {
            return pathParts.slice(projectImagesIndex + 1).join('/');
          }
          // Fallback: try to extract from the end if the above doesn't work
          return pathParts.slice(-2).join('/');
        });

        // Delete from storage
        const { error: projectStorageError } = await supabase.storage
          .from('project-images')
          .remove(projectImagePaths);

        if (projectStorageError) {
          console.warn('Failed to delete some project images from storage:', projectStorageError);
        }
      }

      // Note: Report images reference the same files in project-images bucket,
      // so no separate cleanup of reports-images bucket is needed

      // 3. Delete knowledge documents from storage (project-knowledge/{projectId}/)
      const { data: knowledgeDocs } = await supabase
        .from('project_knowledge')
        .select('file_path')
        .eq('project_id', id);

      if (knowledgeDocs && knowledgeDocs.length > 0) {
        // Extract file paths for storage deletion
        const knowledgePaths = knowledgeDocs.map(doc => 
          doc.file_path.replace(/^project-knowledge\//, '')
        );

        // Delete from storage
        const { error: knowledgeStorageError } = await supabase.storage
          .from('project-knowledge')
          .remove(knowledgePaths);

        if (knowledgeStorageError) {
          console.warn('Failed to delete some knowledge documents from storage:', knowledgeStorageError);
        }
      }

      // 4. Finally, delete the project (this will cascade delete all related records)
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error deleting project:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleteLoading(reportId);
      const { error: deleteError } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId);

      if (deleteError) throw deleteError;
      
      // Update the reports list
      setReports(reports.filter(report => report.id !== reportId));
    } catch (err: any) {
      console.error('Error deleting report:', err);
      setError(err.message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear any previous errors
    setError(null);

    const result = await handleExcelUpload(file);
    
    if (result.success && result.data) {
      setFileData(result.data);
    } else {
      setError(result.error || 'An error occurred while processing the file');
      // Clear any cached fileData on error
      setFileData(null);
    }
  };

  const handleUpdateProject = async () => {
    if (!fileData || Object.keys(fileData).length === 0) {
      setError('Please upload an Excel file with project data.');
      return;
    }

    setUploadLoading(true);
    setError(null);

    try {
      // Validate and sanitize the fileData
      const validation = validateProjectData(fileData);
      
      // Log any invalid fields that were filtered out
      if (validation.invalidFields.length > 0) {
        console.warn('⚠️ Filtered out invalid database fields:', validation.invalidFields);
        
        if (validation.invalidContractors.length > 0) {
          console.warn('❌ Invalid contractor numbers detected:', validation.invalidContractors);
        }
      }

      // Check if we have any valid data left after filtering
      if (!validation.hasValidData) {
        throw new Error('No valid database fields found in the uploaded data. Please check your Excel file format.');
      }



      const { error: updateError } = await supabase
        .from('projects')
        .update(validation.sanitizedData)
        .eq('id', id);

      if (updateError) throw updateError;

      // Refresh project data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);
      setShowEditModal(false);
      setFileData(null);
    } catch (err: any) {
      console.error('Error updating project:', err);
      setError(err.message || 'An error occurred while updating the project');
    } finally {
      setUploadLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container page-content">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container page-content">
        <div className="alert alert-error">
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container page-content">
        <div className="alert alert-error">
          <div>Project not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <div style={{ width: "100%" }}>
        <div style={{ marginBottom: "2rem" }}>
          {/* Breadcrumb navigation */}
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: `${project.project_name} Project`, isCurrent: true }
            ]}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>{project.project_name}</h1>
          </div>
        </div>

        {showEditModal && (
          <div className="modal" style={{ display: 'block' }}>
            <div className="modal-content" style={{ maxWidth: '500px', margin: '2rem auto' }}>
              <div className="modal-header">
                <h2>Edit Project</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setFileData(null);
                    setError(null);
                  }}
                  className="btn btn-close"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="card">
                  <div className="card-body">
                    <h3 style={{ marginBottom: "1rem" }}>Import from Excel</h3>
                    <p style={{ marginBottom: "1rem" }} className="text-secondary">
                      Upload an Excel file to update the project details. The Excel file should have the same format as the original project data.
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
                    {fileData && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setFileData(null);
                            setError(null);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: "0.75rem" }}
                        >
                          Clear Excel Data
                        </button>
                        <p style={{ fontSize: "0.75rem", color: "var(--color-text-light)", marginTop: "0.25rem" }}>
                          {Object.keys(fileData).length} fields loaded from Excel
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setFileData(null);
                    setError(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProject}
                  disabled={!fileData || uploadLoading}
                  className="btn btn-primary"
                >
                  {uploadLoading ? 'Updating...' : 'Update Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: "0.75rem" }}>
          <div className="card-body">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: '0rem',
              borderRadius: '6px',
              backgroundColor: 'var(--color-background)',
              transition: 'all 0.2s ease'
            }} 
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background-hover)';
            }} 
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-background)';
            }}
            onClick={() => setIsProjectDetailsExpanded(!isProjectDetailsExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  opacity: 0.8,
                  transform: isProjectDetailsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s ease'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div style={{ width: '24px', height: '24px', opacity: 0.8 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 style={{ margin: 0, color: "var(--color-text)" }}>Project Details</h3>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-lighter)" }}>
                  Project Information & Details
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{ 
                    backgroundColor: 'black', 
                    color: 'white', 
                    border: '1px solid black',
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem'
                  }}
                >
                  Update Project Info
                </button>
              </div>
            </div>
            
            {isProjectDetailsExpanded && (
              <div style={{ 
                transition: 'all 0.3s ease',
                opacity: isProjectDetailsExpanded ? 1 : 0,
                maxHeight: isProjectDetailsExpanded ? 'none' : '0',
                overflow: 'hidden',
                marginTop: '1rem'
              }}>
                {/* Sectioned dropdowns for project info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Pretium Information */}
                  <details>
                    <summary style={{ fontWeight: 600, fontSize: '1rem' }}>Pretium Information</summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      {["Name", "Title", "Office", "Tel", "Cell", "Email", "Fax", "Project No."].map((key) =>
                        project[key] ? (
                          <div key={key}>
                            <label className="form-label">{key}</label>
                            <div>{String(project[key])}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                  {/* Client Information */}
                  <details>
                    <summary style={{ fontWeight: 600, fontSize: '1rem' }}>Client Information</summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      {["Client Contact Name", "Client Company Name", "Client Address 1", "Client Address 2", "Client Email", "Client Tel", "Client Fax"].map((key) =>
                        project[key] ? (
                          <div key={key}>
                            <label className="form-label">{key}</label>
                            <div>{String(project[key])}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                  {/* Project Information */}
                  <details>
                    <summary style={{ fontWeight: 600, fontSize: '1rem' }}>Project Information</summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      {["Project Title", "Project Address 1", "Project Address 2", "Tender Meeting Date & Time", "Tender Closing Date & Time", "Project Type", "Project Date"].map((key) =>
                        project[key] ? (
                          <div key={key}>
                            <label className="form-label">{key}</label>
                            <div>{String(project[key])}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                  {/* Owner Information */}
                  <details>
                    <summary style={{ fontWeight: 600, fontSize: '1rem' }}>Owner Information</summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      {["Owner / Condo Corp / Building Name", "Owner Address 1 (if applicable)", "Owner Address 2 (if applicable)", "Owner Contact Name (if applicable)"].map((key) =>
                        project[key] ? (
                          <div key={key}>
                            <label className="form-label">{key}</label>
                            <div>{String(project[key])}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                  {/* Contractor Invite */}
                  <details>
                    <summary style={{ fontWeight: 600, fontSize: '1rem' }}>Contractor Invite</summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      {["Contractor Name 1", "Contractor Contact Name 1", "Contractor Name 2", "Contractor Contact Name 2", "Contractor Name 3", "Contractor Contact Name 3", "Contractor Name 4", "Contractor Contact Name 4", "Contractor Name 5", "Contractor Contact Name 5", "Contractor Name 6", "Contractor Contact Name 6", "Contractor Name 7", "Contractor Contact Name 7", "Contractor Name 8", "Contractor Contact Name 8"].map((key) =>
                        project[key] ? (
                          <div key={key}>
                            <label className="form-label">{key}</label>
                            <div>{String(project[key])}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                  {/* Tender Summary */}
                  <details>
                    <summary style={{ fontWeight: 600, fontSize: '1rem' }}>Tender Summary</summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      {["Contractor Name", "Total Stipulated Price (Excluding HST)", "Specification Date", "Tender Date"].map((key) =>
                        project[key] ? (
                          <div key={key}>
                            <label className="form-label">{key}</label>
                            <div>{String(project[key])}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                  {/* Contractor Award Information */}
                  <details>
                    <summary style={{ fontWeight: 600, fontSize: '1rem' }}>Contractor Award Information</summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      {["Contractor Contact Name", "Contractor Company Name", "Contractor Address 1", "Contractor Address 2", "Contractor Email", "Contractor Tel"].map((key) =>
                        project[key] ? (
                          <div key={key}>
                            <label className="form-label">{key}</label>
                            <div>{String(project[key])}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                  {/* Autocad TitleBlock Information */}
                  <details>
                    <summary style={{ fontWeight: 600, fontSize: '1rem' }}>Autocad TitleBlock Information</summary>
                    <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                      {["Drafted By {Initials}", "Reviewed By {Initials}", "Revision No."].map((key) =>
                        project[key] ? (
                          <div key={key}>
                            <label className="form-label">{key}</label>
                            <div>{String(project[key])}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </details>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Knowledge Documents Viewer */}
        <KnowledgeViewer
          documents={knowledgeUpload.documents}
          selectedDocument={knowledgeUpload.selectedDocument}
          parsedChunks={knowledgeUpload.parsedChunks}
          loadingChunks={false}
          showChunks={knowledgeUpload.showChunks}
          onDeleteDocument={knowledgeUpload.deleteDocument}
          onCloseChunks={() => knowledgeUpload.setShowChunks(false)}
          formatFileSize={knowledgeUpload.formatFileSize}
          formatDate={knowledgeUpload.formatDate}
          onSpecUpload={knowledgeUpload.handleSpecUpload}
          onBuildingCodeUpload={knowledgeUpload.handleBuildingCodeUpload}
          uploading={knowledgeUpload.uploading}
          uploadError={error}
          uploadSuccess={knowledgeUploadSuccess}
          projectId={id}
          // Multiple file upload props
          handleMultipleFileUpload={knowledgeUpload.handleMultipleFileUpload}
          multipleUploadProgress={knowledgeUpload.multipleUploadProgress}
          showMultipleUploadModal={knowledgeUpload.showMultipleUploadModal}
          setShowMultipleUploadModal={knowledgeUpload.setShowMultipleUploadModal}
        />

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button
            className="btn btn-primary btn-md"
            style={{ flex: '1', maxWidth: '300px' }}
            onClick={() => router.push(`/projects/${project.id}/images`)}
          >
            View All Project Images
          </button>
          <button
            className="btn btn-secondary btn-md"
            style={{ flex: '1', maxWidth: '300px' }}
            onClick={() => router.push(`/reports/new?project_id=${project.id}`)}
          >
            Create New Report
          </button>
        </div>

        <div>
          <h3 style={{ marginBottom: "1rem", display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Reports</span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: '1rem' }}
              onClick={toggleReportViewMode}
            >
              {reportViewMode === 'grid' ? 'List View' : 'Grid View'}
            </button>
          </h3>
          {reports.length === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: "center", padding: "2rem" }}>
                <div style={{ width: '100px', height: '100px', margin: '0 auto 1.5rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '100%', height: '100%', color: 'var(--color-text-lighter)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 style={{ marginBottom: "0.5rem" }}>No reports yet</h4>
                <p style={{ marginBottom: "1rem" }} className="text-secondary">
                  Create your first report using the "Create New Report" button above.
                </p>
              </div>
            </div>
          ) : (
            reportViewMode === 'grid' ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
                {reports.map((report, index) => (
                  <div
                    key={report.id}
                    className="card"
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', aspectRatio: '5.5/7' }}
                    onClick={() => router.push(`/reports/${report.id}/edit`)}
                  >
                    <div className="card-image" style={{ flex: '1', minHeight: '80px' }}>
                      <img 
                        src={getReportImage(index)} 
                        alt="Report" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div className="card-body" style={{ flex: '0 0 auto', padding: '0.5rem' }}>
                      <h4 style={{ marginBottom: "0.25rem", fontSize: "0.9rem" }}>
                        {report.title || `Report ${index + 1}`}
                      </h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: "0.7rem", color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
                        <span>Created on {new Date(report.created_at).toLocaleDateString()}</span>
                        <span>
                          {report.delivered_at 
                            ? `Delivered on ${new Date(report.delivered_at).toLocaleDateString('en-US', { 
                                month: 'long', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}`
                            : 'Not Delivered'
                          }
                        </span>
                      </div>
                      <div className="report-actions">
                        <Link
                          href={`/reports/${report.id}/edit`}
                          className="btn btn-secondary btn-sm"
                          onClick={e => e.stopPropagation()}
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/reports/${report.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={e => e.stopPropagation()}
                        >
                          Detail
                        </Link>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteReport(report.id, e); }}
                          disabled={deleteLoading === report.id}
                          className="btn btn-danger btn-sm"
                        >
                          {deleteLoading === report.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {reports.map((report, index) => (
                  <div
                    key={report.id}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '0.75rem 1rem', cursor: 'pointer' }}
                    onClick={() => router.push(`/reports/${report.id}/edit`)}
                  >
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: "500", fontSize: "1rem" }}>
                        {report.title || `Report ${index + 1}`}
                      </span>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
                        |
                      </span>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
                        Created {new Date(report.created_at).toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </span>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
                        |
                      </span>
                      <span style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
                        {report.delivered_at
                         ? `Delivered ${new Date(report.delivered_at).toLocaleDateString('en-US', { 
                           month: 'long', 
                           day: 'numeric', 
                           year: 'numeric' 
                         })}`
                         : 'Not Delivered'
                       }
                      </span>
                    </div>
                    <div className="report-actions">
                      <Link
                        href={`/reports/${report.id}/edit`}
                        className="btn btn-secondary btn-sm"
                        onClick={e => e.stopPropagation()}
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/reports/${report.id}`}
                        className="btn btn-primary btn-sm"
                        onClick={e => e.stopPropagation()}
                      >
                        Details
                      </Link>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteReport(report.id, e); }}
                        disabled={deleteLoading === report.id}
                        className="btn btn-danger btn-sm"
                      >
                        {deleteLoading === report.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <button
            onClick={handleDelete}
            className="btn btn-danger"
            disabled={loading}
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
} 