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
  bullet_points: string;
  generated_content: string;
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
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

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
          bullet_points,
          generated_content,
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
        bulletPoints: selectedReportData.bullet_points || '',
        generatedContent: selectedReportData.generated_content || '',
        timestamp: Date.now()
      };

      localStorage.setItem(`report-template-${projectId}`, JSON.stringify(templateData));
      localStorage.setItem(`report-groups-${projectId}`, JSON.stringify(photoStructure));
      
      // Also save bullet points and content separately for easy access
      if (selectedReportData.bullet_points) {
        localStorage.setItem(`report-bullet-points-${projectId}`, selectedReportData.bullet_points);
      }
      if (selectedReportData.generated_content) {
        localStorage.setItem(`report-generated-content-${projectId}`, selectedReportData.generated_content);
      }

      setSuccessMessage('Template applied successfully! Photo structure, bullet points, and content copied. Redirecting...');
      
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
              Select a previous report to use its photo groupings, numbering, bullet points, and content as a template for your new report.
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
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {reports.map((report) => {
            const groupedImages = getGroupedImages(report.report_images);
            const totalImages = report.report_images.length;
            const totalGroups = Object.keys(groupedImages).length;
            const numberedImages = report.report_images.filter(img => img.number !== null).length;

            return (
              <div key={report.id} className="card">
                <div className="card-body" style={{ padding: '0.75rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem'
                  }}>
                    <div>
                      <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{report.title || `Report ${report.id.slice(-8)}`}</span>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: 'var(--color-text-secondary)',
                          fontWeight: 'normal'
                        }}>
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </h3>
                    </div>
                    <button
                      onClick={() => applyTemplate(report.id)}
                      disabled={applyingTemplate}
                      className="btn btn-primary"
                      style={{ minWidth: '100px', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                    >
                      {applyingTemplate && selectedReport === report.id ? 'Applying...' : 'Use This Format'}
                    </button>
                  </div>

                  

                                    {/* Simple Bullet Points Preview */}
                  {report.bullet_points && (
                    <div style={{ 
                      border: '1px solid var(--color-border)', 
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      backgroundColor: 'var(--color-bg-secondary)'
                    }}>
                                              <button
                          onClick={() => {
                            const newExpanded = new Set(expandedReports);
                            if (newExpanded.has(report.id)) {
                              newExpanded.delete(report.id);
                            } else {
                              newExpanded.add(report.id);
                            }
                            setExpandedReports(newExpanded);
                          }}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'var(--color-bg)',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: 'var(--color-text)',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg)';
                        }}
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: '600', marginBottom: '0.125rem' }}>
                            📝 Original Bullet Points & Photos
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--color-text-secondary)' }}>
                            {totalImages} photos • {totalGroups} sections • {numberedImages} numbered
                          </div>
                        </div>
                        <span style={{ 
                          fontSize: '1.2rem', 
                          transition: 'transform 0.2s ease',
                          transform: expandedReports.has(report.id) ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}>
                          ▼
                        </span>
                      </button>
                      
                                            {expandedReports.has(report.id) && (
                        <div style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--color-bg)',
                          borderTop: '1px solid var(--color-border)',
                          maxHeight: '400px',
                          overflow: 'auto'
                        }}>
                          {/* Bullet Points Section */}
                          <div style={{ marginBottom: '1rem' }}>
                            <h5 style={{ 
                              fontSize: '0.875rem', 
                              fontWeight: '600',
                              marginBottom: '0.5rem',
                              color: 'var(--color-text)'
                            }}>
                              📝 Original Bullet Points
                            </h5>
                            <div style={{
                              fontSize: '0.875rem',
                              lineHeight: '1.5',
                              whiteSpace: 'pre-wrap',
                              padding: '0.5rem',
                              backgroundColor: 'var(--color-bg-secondary)',
                              borderRadius: '0.25rem'
                            }}>
                              {report.bullet_points}
                            </div>
                          </div>

                          {/* Photo Preview Section */}
                          <div>
                            <h5 style={{ 
                              fontSize: '0.875rem', 
                              fontWeight: '600',
                              marginBottom: '0.5rem',
                              color: 'var(--color-text)'
                            }}>
                              📸 Photo Preview ({totalImages} photos)
                            </h5>
                            
                            {/* Photo Grid */}
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                              gap: '0.75rem',
                              maxHeight: '300px',
                              overflow: 'auto'
                            }}>
                              {report.report_images.slice(0, 20).map((image, index) => (
                                <div key={image.id} style={{ 
                                  position: 'relative',
                                  borderRadius: '0.375rem',
                                  overflow: 'hidden',
                                  border: '1px solid var(--color-border)',
                                  backgroundColor: 'var(--color-bg)'
                                }}>
                                  <img 
                                    src={image.url} 
                                    alt={image.description || `Photo ${index + 1}`}
                                    style={{
                                      width: '100%',
                                      height: '90px',
                                      objectFit: 'cover',
                                      display: 'block'
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (nextElement) {
                                        nextElement.style.display = 'flex';
                                      }
                                    }}
                                  />
                                  <div style={{
                                    display: 'none',
                                    width: '100%',
                                    height: '90px',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '2rem'
                                  }}>
                                    📷
                                  </div>
                                  
                                  {/* Photo Info Overlay */}
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'rgba(0, 0, 0, 0.8)',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {image.description || `Photo ${index + 1}`}
                                  </div>
                                  
                                  {/* Group Badge */}
                                  {image.group && image.group.length > 0 && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '0.25rem',
                                      right: '0.25rem',
                                      background: 'var(--color-primary)',
                                      color: 'white',
                                      fontSize: '0.625rem',
                                      padding: '0.25rem 0.375rem',
                                      borderRadius: '0.25rem',
                                      fontWeight: '600'
                                    }}>
                                      {image.group[0]}
                                    </div>
                                  )}
                                  
                                  {/* Number Badge */}
                                  {image.number && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '0.25rem',
                                      left: '0.25rem',
                                      background: 'var(--color-accent)',
                                      color: 'white',
                                      fontSize: '0.625rem',
                                      padding: '0.25rem 0.375rem',
                                      borderRadius: '0.25rem',
                                      fontWeight: '600'
                                    }}>
                                      #{image.number}
                                    </div>
                                  )}
                                </div>
                              ))}
                              
                              {/* Show more indicator */}
                              {report.report_images.length > 20 && (
                                <div style={{ 
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  height: '90px',
                                  backgroundColor: 'var(--color-bg-secondary)',
                                  borderRadius: '0.375rem',
                                  border: '1px solid var(--color-border)',
                                  fontSize: '0.875rem',
                                  color: 'var(--color-text-secondary)'
                                }}>
                                  +{report.report_images.length - 20} more photos
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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