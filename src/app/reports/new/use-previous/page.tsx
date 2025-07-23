'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Toast } from '@/components/feedback';

interface Report {
  id: string;
  title: string;
  created_at: string;
  project_id: string;
  project: {
    project_name: string;
    "Project Address 1"?: string;
    "Project Address 2"?: string;
  };
  report_images: ReportImage[];
}

interface ReportImage {
  id: string;
  url: string;
  description: string;
  tag: string;
  number: number | null;
  group: string[] | null;
  rotation: number;
}

function UsePreviousPageContent() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');
  const returnTo = searchParams.get('returnTo');

  const fetchReports = async () => {
    if (!projectId) {
      setError('No project ID provided');
      setLoading(false);
      return;
    }

    try {
      // Fetch all reports for this project with their images
      const { data, error } = await supabase
        .from('reports')
        .select(`
          id,
          title,
          created_at,
          project_id,
          project:projects(project_name, "Project Address 1", "Project Address 2"),
          report_images(
            id,
            url,
            description,
            tag,
            number,
            group,
            rotation
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Fetched reports data:', data);
      
      // Filter out reports with no images and fix the project type
      const reportsWithImages = data?.filter(report => 
        report.report_images && report.report_images.length > 0
      ).map(report => ({
        ...report,
        project: Array.isArray(report.project) ? report.project[0] : report.project
      })) || [];

      console.log('Reports with images:', reportsWithImages);
      setReports(reportsWithImages);
    } catch (err: any) {
      setError('Failed to load reports: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    };

    getUser();
    fetchReports();
  }, [projectId, router]);

  const refreshReports = async () => {
    setRefreshing(true);
    try {
      await fetchReports();
      setSuccessMessage('Reports refreshed successfully!');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError('Failed to refresh reports: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const applyTemplate = async (reportId: string) => {
    setApplyingTemplate(true);
    setError(null);

    try {
      const selectedReportData = reports.find(r => r.id === reportId);
      if (!selectedReportData) {
        throw new Error('Selected report not found');
      }

      // Extract the photo structure from the selected report
      // We need to find the corresponding project images by matching URLs
      const reportImageUrls = selectedReportData.report_images.map(img => img.url);
      
      // Fetch the corresponding project images
      const { data: projectImages, error: projectImagesError } = await supabase
        .from('project_images')
        .select('id, url')
        .eq('project_id', projectId)
        .in('url', reportImageUrls);
        
      if (projectImagesError) {
        throw new Error('Failed to fetch project images: ' + projectImagesError.message);
      }
      
      // Create a mapping from URL to project image ID
      const urlToProjectImageId: { [url: string]: string } = {};
      projectImages?.forEach(img => {
        urlToProjectImageId[img.url] = img.id;
      });
      
      const photoStructure = selectedReportData.report_images.map(img => ({
        id: urlToProjectImageId[img.url], // Use the project image ID found by URL
        group: img.group || [],
        number: img.number
      })).filter(item => item.id); // Only include items where we found a matching project image

      // Group images by their group name
      const groupsMapping: { [imageId: string]: string[] } = {};
      const groupNumberingStates: { [groupName: string]: boolean } = {};
      const groupOrder: { groupName: string; order: number }[] = [];

      // Process each image to build the structure
      photoStructure.forEach((img, index) => {
        if (img.id) {
          groupsMapping[img.id] = img.group;
          
          // Track which groups have numbering enabled
          const groupName = img.group && img.group.length > 0 ? img.group[0] : 'Ungrouped';
          if (img.number !== null) {
            groupNumberingStates[groupName] = true;
          }
        }
      });

      // Build group order based on the order they appear in the report
      const seenGroups = new Set<string>();
      photoStructure.forEach(img => {
        const groupName = img.group && img.group.length > 0 ? img.group[0] : 'Ungrouped';
        if (!seenGroups.has(groupName)) {
          seenGroups.add(groupName);
          groupOrder.push({
            groupName,
            order: groupOrder.length + 1
          });
        }
      });

      // Save the template data to localStorage
      const templateData = {
        selectedImages: photoStructure,
        groupNumberingStates,
        groupOrder,
        timestamp: Date.now()
      };

      localStorage.setItem(`report-template-${projectId}`, JSON.stringify(templateData));
      localStorage.setItem(`report-groups-${projectId}`, JSON.stringify(photoStructure));

      setSuccessMessage('Template applied successfully! Redirecting...');
      
      // Redirect back to the new report page
      setTimeout(() => {
        if (returnTo === 'reports') {
          router.push(`/reports/new?project_id=${projectId}&useTemplate=true`);
        } else {
          router.push(`/reports/new?project_id=${projectId}&useTemplate=true`);
        }
      }, 1500);

    } catch (err: any) {
      setError('Failed to apply template: ' + err.message);
    } finally {
      setApplyingTemplate(false);
    }
  };

  const getGroupedImages = (reportImages: ReportImage[]) => {
    const grouped: { [groupName: string]: ReportImage[] } = {};
    
    reportImages.forEach(img => {
      const groupName = img.group && img.group.length > 0 ? img.group[0] : 'Ungrouped';
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(img);
    });

    // Sort images within each group by number
    Object.keys(grouped).forEach(groupName => {
      grouped[groupName].sort((a, b) => {
        if (a.number && b.number) return a.number - b.number;
        if (a.number && !b.number) return -1;
        if (!a.number && b.number) return 1;
        return 0;
      });
    });

    return grouped;
  };

  if (loading) {
    return (
      <div className="container page-content">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #2b579a',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto'
          }} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p>Loading previous reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <header style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "0.5rem", display: "flex" }}>
          <Link
            href={`/reports/new?project_id=${projectId}`}
            className="text-accent"
            style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}
          >
            ← Back to New Report
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>
              Use Previous Report Format
            </h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Select a previous report to use its photo groupings and numbering as a template for your new report.
            </p>
          </div>
          <button
            onClick={refreshReports}
            disabled={refreshing}
            className="btn btn-outline"
            style={{ minWidth: '100px' }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <Toast message={error} type="error" />
      )}

      {successMessage && (
        <Toast message={successMessage} type="success" />
      )}

      {reports.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>
              No previous reports found
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
              Create your first report to use this feature in the future.
            </p>
            <Link href={`/reports/new?project_id=${projectId}`} className="btn btn-primary">
              Create New Report
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {reports.map((report) => {
            const groupedImages = getGroupedImages(report.report_images);
            const totalImages = report.report_images.length;
            const totalGroups = Object.keys(groupedImages).length;
            const numberedImages = report.report_images.filter(img => img.number !== null).length;

            return (
              <div key={report.id} className="card">
                <div className="card-body">
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <h3 style={{ marginBottom: '0.5rem' }}>
                        {report.title || `Report ${report.id.slice(-8)}`}
                      </h3>
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: 'var(--color-text-secondary)',
                        marginBottom: '0.5rem'
                      }}>
                        {new Date(report.created_at).toLocaleDateString()} • {totalImages} photos • {totalGroups} sections
                        {numberedImages > 0 && ` • ${numberedImages} numbered`}
                      </p>
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: 'var(--color-text-secondary)'
                      }}>
                        Project: {report.project?.project_name} • {report.project?.["Project Address 1"] || 'No address'}
                      </p>
                    </div>
                    <button
                      onClick={() => applyTemplate(report.id)}
                      disabled={applyingTemplate}
                      className="btn btn-primary"
                      style={{ minWidth: '120px' }}
                    >
                      {applyingTemplate && selectedReport === report.id ? 'Applying...' : 'Use This Format'}
                    </button>
                  </div>

                  {/* Preview of the photo structure */}
                  <div style={{ 
                    border: '1px solid var(--color-border)', 
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-secondary)'
                  }}>
                    <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Photo Structure Preview:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {Object.entries(groupedImages).map(([groupName, images]) => (
                        <div key={groupName} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          fontSize: '0.875rem'
                        }}>
                          <span style={{ 
                            fontWeight: '500', 
                            minWidth: '120px',
                            color: 'var(--color-primary)'
                          }}>
                            {groupName}:
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            {images.length} photo{images.length !== 1 ? 's' : ''}
                            {images.some(img => img.number !== null) && (
                              <span style={{ marginLeft: '0.5rem' }}>
                                (numbered: {images.filter(img => img.number !== null).map(img => img.number).join(', ')})
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Loading fallback component
function UsePreviousPageLoading() {
  return (
    <div className="container page-content">
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #2b579a',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem auto'
        }} />
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p>Loading...</p>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function UsePreviousPage() {
  return (
    <Suspense fallback={<UsePreviousPageLoading />}>
      <UsePreviousPageContent />
    </Suspense>
  );
} 