'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Project, Report } from '@/lib/supabase';
import { handleExcelUpload } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useViewPreference } from '@/hooks/useViewPreference';
import KnowledgeUpload from './components/KnowledgeUpload';
import KnowledgeViewer from './components/KnowledgeViewer';

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

    const result = await handleExcelUpload(file);
    if (result.success && result.data) {
      setFileData(result.data);
    } else {
      setError(result.error || 'An error occurred while processing the file');
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
      const { error: updateError } = await supabase
        .from('projects')
        .update(fileData)
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
          <div style={{ marginBottom: "0.5rem", display: "flex" }}>
            <Link
              href="/dashboard"
              className="text-accent"
              style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}
            >
              ← Back to Dashboard
            </Link>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>{project.project_name}</h1>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => setShowEditModal(true)}
                className="btn btn-secondary"
              >
                Update Project Info
              </button>
              
            </div>
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

        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="card-body">
            <h3 style={{ marginBottom: "1rem" }}>Project Details</h3>
            {/* Sectioned dropdowns for project info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Pretium Information */}
              <details>
                <summary style={{ fontWeight: 600, fontSize: '1.1rem' }}>Pretium Information</summary>
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
                <summary style={{ fontWeight: 600, fontSize: '1.1rem' }}>Client Information</summary>
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
                <summary style={{ fontWeight: 600, fontSize: '1.1rem' }}>Project Information</summary>
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
                <summary style={{ fontWeight: 600, fontSize: '1.1rem' }}>Owner Information</summary>
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
                <summary style={{ fontWeight: 600, fontSize: '1.1rem' }}>Contractor Invite</summary>
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
                <summary style={{ fontWeight: 600, fontSize: '1.1rem' }}>Tender Summary</summary>
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
                <summary style={{ fontWeight: 600, fontSize: '1.1rem' }}>Contractor Award Information</summary>
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
                <summary style={{ fontWeight: 600, fontSize: '1.1rem' }}>Autocad TitleBlock Information</summary>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
                {reports.map((report, index) => (
                  <div
                    key={report.id}
                    className="card"
                    style={{ height: '100%', cursor: 'pointer' }}
                    onClick={() => router.push(`/reports/${report.id}/edit`)}
                  >
                    <div className="card-image">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="card-body">
                      <h4 style={{ marginBottom: "0.5rem" }}>
                        {report.title || `Report ${index + 1}`}
                      </h4>
                      <p className="text-secondary" style={{ marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                        Created on {new Date(report.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-secondary" style={{ marginBottom: "0.75rem", fontSize: "0.875rem" }}>
                        {report.delivered_at 
                          ? `Delivered on ${new Date(report.delivered_at).toLocaleDateString('en-US', { 
                              month: 'long', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}`
                          : 'Not Delivered'
                        }
                      </p>
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