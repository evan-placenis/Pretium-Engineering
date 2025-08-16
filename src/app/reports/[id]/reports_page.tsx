'use client';
//page to view individal report
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Project, Report } from '@/lib/supabase';
import { ReportImage } from '@/types/reportImage';
import { createWordDocumentWithImages } from '@/hooks/word-utils';
import { extractStorageRelativePath, extractStorageBucketName } from '@/hooks/utils';
import Breadcrumb from '@/components/Breadcrumb';
import { SectionModel } from '@/lib/jsonTreeModels/SectionModel';
import { Section } from '@/lib/jsonTreeModels/types/section';

interface ReportViewProps {
  id: string;
}

export default function ReportView({ id }: ReportViewProps) {
  const [report, setReport] = useState<Report & { sections_json?: { sections: Section[] } } | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<ReportImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchReportAndProject = async () => {
      if (!id) {
        console.error('No report ID provided');
        setError('Invalid report ID');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      // Fetch report
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*, projects(*)')
        .eq('id', id)
        .single();
      
      if (reportError) {
        console.error('Error fetching report:', reportError);
        setError('Failed to load report. Please try again.');
        setLoading(false);
        return;
      }

      if (!reportData) {
        console.error('No report data found for ID:', id);
        setError('Report not found');
        setLoading(false);
        return;
      }
      
      setReport(reportData);
      if (reportData.projects) {
        setProject(reportData.projects);
      }
      
      // Fetch report images
      const { data: imagesData } = await supabase
        .from('report_images')
        .select('id, report_id, url, description, tag, user_id, rotation')
        .eq('report_id', id);

      if (imagesData) {
        console.log('Raw image data:', imagesData);
        

        
        // Get the signed URLs for the images
        const imagesWithUrls = await Promise.all(
          imagesData.map(async (image) => {
            try {
              // If URL is already a full public URL, use it directly (no need for signed URL)
              if (image.url.startsWith('https://') && image.url.includes('/storage/v1/object/public/')) {
                console.log('Using existing public URL:', image.url);
                return image;
              }
              
              // Extract relative path for signed URL generation
              const relativePath = extractStorageRelativePath(image.url);
              if (!relativePath) {
                console.warn('Could not extract relative path, using original URL:', image.url);
                return image;
              }
              
              // Determine which bucket to use based on the URL
              const bucketName = extractStorageBucketName(image.url);
              
              // Generate a signed URL that's valid for 8 hours
              const { data, error } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(relativePath, 60 * 60 * 8); // 8 hours in seconds

              if (error) {
                console.error('Error generating signed URL for path:', relativePath, 'Error:', error);
                return image; // Return original image if signed URL fails
              }

              console.log('Generated signed URL for path:', relativePath, 'URL:', data.signedUrl);
              return {
                ...image,
                url: data.signedUrl
              };
            } catch (urlError) {
              console.error('Error processing image URL:', image.url, 'Error:', urlError);
              return image; // Return original image if processing fails
            }
          })
        );
        console.log('Final images with URLs:', imagesWithUrls);
        setImages(imagesWithUrls);
      }
      
      setLoading(false);
    };

    fetchReportAndProject();
  }, [id]);

  const handleExportWord = async () => {
    if (!report) return;
    
    try {
      setIsDownloading(true);
      
      // Generate a filename
      const filename = `${project?.project_name || 'Report'}_${new Date().toISOString().split('T')[0]}.docx`;
      
      // Use the working Word document function with actual images
      let sections: Section[];
      if (report.sections_json && report.sections_json.sections) {
        sections = report.sections_json.sections;
      } else {
        sections = await SectionModel.fromMarkdown(report.generated_content || '');
      }
      await createWordDocumentWithImages(sections, images, filename, project);
      
    } catch (error) {
      console.error('Error generating Word document:', error);
      setError('Error downloading Word document');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!window.confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    setDeleteLoading(true);
    try {
      // Delete associated chat messages first
      const { error: chatError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('report_id', id);

      if (chatError) throw chatError;

      // Delete associated images from storage
      const { data: images } = await supabase
        .from('report_images')
        .select('url')
        .eq('report_id', id);

      if (images) {
        const deletePromises = images.map(image => 
          supabase.storage
            .from('reports-images')
            .remove([image.url])
        );
        await Promise.all(deletePromises);
      }

      // Delete image records
      const { error: imageError } = await supabase
        .from('report_images')
        .delete()
        .eq('report_id', id);

      if (imageError) throw imageError;

      // Finally, delete the report
      const { error: reportError } = await supabase
        .from('reports')
        .delete()
        .eq('id', id);

      if (reportError) throw reportError;

      // Redirect to project page
      if (project) {
        router.push(`/projects/${project.id}`);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      setError('Failed to delete report. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container loading-container">
        <p className="text-secondary">Loading report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="container loading-container">
        <p className="text-secondary">Report not found</p>
      </div>
    );
  }

  return (
    <>
      {/* Main Content */}
      <div className="container page-content">
        <header style={{ marginBottom: "2rem" }}>
          {/* Breadcrumb navigation */}
          {project && (
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: `${project.project_name} Project`, href: `/projects/${project.id}` },
                { label: report?.title || 'Report', isCurrent: true }
              ]}
            />
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h1>
              {project?.project_name || 'Project'}: {report?.title || 'Report 1'}
            </h1>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleExportWord}
                disabled={isDownloading}
                className="btn btn-primary"
              >
                {isDownloading ? 'Downloading...' : 'Export to Word'}
              </button>
              <Link
                href={`/reports/${id}/edit`}
                className="btn btn-secondary"
              >
                Edit Report
              </Link>
              <button
                onClick={handleDeleteReport}
                disabled={deleteLoading}
                className="btn btn-danger"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Report'}
              </button>
            </div>
          </div>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }} className="text-secondary">
            Created on {new Date(report.created_at).toLocaleString()}
          </p>
        </header>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.875rem" }}>{error}</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridGap: "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            <div className="card">
              <div className="card-body">
                <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: "600" }}>Original Bullet Points</h2>
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {report.bullet_points}
                </div>
              </div>
            </div>

            {images.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: "600" }}>Report Images</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
                    {images.map((image, index) => (
                      <div key={index} className="image-container">
                        <img 
                          src={image.url} 
                          alt={image.description || `Report image ${index + 1}`}
                          style={{ 
                            width: '100%', 
                            height: '200px', 
                            objectFit: 'cover',
                            borderRadius: '0.5rem'
                          }}
                        />
                        {image.description && (
                          <p style={{ 
                            marginTop: "0.5rem", 
                            fontSize: "0.875rem",
                            color: "var(--color-text-light)"
                          }}>
                            {image.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 