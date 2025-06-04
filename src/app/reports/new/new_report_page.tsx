'use client';
//page to create a new report - fullscreen bullet points entry
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, Project } from '@/lib/supabase';
import Link from 'next/link';
import { Document, Packer, Paragraph, ImageRun, HeadingLevel, AlignmentType } from 'docx';

export default function NewReport() {
  const [project, setProject] = useState<Project | null>(null);
  const [bulletPoints, setBulletPoints] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [allImages, setAllImages] = useState<{ id: string; url: string; tag: 'overview' | 'deficiency' | null; description: string }[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');
  const reportId = searchParams.get('reportId');
  const selectedImageIds = searchParams.get('selected_images');

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    };

    const fetchProject = async () => {
      if (!projectId) {
        router.push('/dashboard');
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error || !data) {
        console.error('Error fetching project:', error);
        router.push('/dashboard');
        return;
      }

      setProject(data);
    };

    getUser();
    fetchProject();
  }, [projectId, router]);

  // Load selected images when returning from image selection
  useEffect(() => {
    const loadSelectedImages = async () => {
      if (!selectedImageIds || !projectId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const imageIds = selectedImageIds.split(',');
        const { data, error } = await supabase
          .from('project_images')
          .select('*')
          .in('id', imageIds);
          
        if (error) throw error;
        
        setAllImages(prev => {
          // Avoid duplicates by id
          const newImages = (data || []).filter(img => !prev.some(existing => existing.id === img.id));
          return [...prev, ...newImages];
        });
        
        // Clear the URL parameter after loading
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('selected_images');
        window.history.replaceState({}, '', newUrl.toString());
        
      } catch (error: any) {
        setError('Failed to load selected images: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadSelectedImages();
  }, [selectedImageIds, projectId]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload only image files');
        return;
      }
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = fileName;
      const { data, error: uploadError } = await supabase.storage
        .from('reports-images')
        .upload(filePath, file);
      if (uploadError) {
        setError('Error uploading image');
        continue;
      }
      // Get signed URL (valid for 8 hours)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('reports-images')
        .createSignedUrl(filePath, 60 * 60 * 8);
      if (signedUrlError || !signedUrlData) {
        setError('Error generating image URL');
        continue;
      }
      setAllImages(prev => [
        ...prev,
        {
          id: filePath,
          url: signedUrlData.signedUrl,
          tag: 'overview',
          description: ''
        }
      ]);
    }
  };

  const handleImportProjectImages = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('project_images')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Avoid duplicates by id
      setAllImages(prev => ([
        ...prev,
        ...((data || []).filter(img => !prev.some(existing => existing.id === img.id)))
      ]));
    } catch (error: any) {
      setError('Failed to load project images: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!bulletPoints.trim()) {
      setError('Please enter some bullet points to generate a report');
      return;
    }

    if (allImages.length === 0) {
      setError('Please add at least one image to the report');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Starting report generation with:', {
        bulletPoints,
        projectName: project?.project_name,
        uploadedImagesCount: allImages.length,
      });

      // Save the initial report data to the database first
      const { error: saveError, data: reportData } = await supabase
        .from('reports')
        .insert([
          {
            project_id: project!.id,
            bullet_points: bulletPoints,
            generated_content: '', // Will be updated after generation
            user_id: user.id, // Add user tracking
          },
        ])
        .select()
        .single();

      if (saveError) throw saveError;
      console.log('Created report record:', reportData);

      // Now generate the report with the report ID
      console.log('Calling generate-report API with reportId:', reportData.id);

      const response = await fetch('/api/generate-report-simple', { // WHERE YOU CHANGE THE API CALL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bulletPoints,
          projectName: project?.name,
          location: project?.location,
          reportId: reportData.id,
          images: allImages // Send the images we just uploaded
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const { generatedContent, images: responseImages } = await response.json();

      // Update the report with the generated content
      const { error: updateError } = await supabase
        .from('reports')
        .update({ generated_content: generatedContent })
        .eq('id', reportData.id);

      if (updateError) throw updateError;

      // Insert all images into report_images with report_id
      await supabase.from('report_images').insert(allImages.map(img => ({
        report_id: reportData.id,
        url: img.url,
        tag: img.tag,
        description: img.description,
        user_id: user.id // Add user tracking
      })));

      // Redirect to the report editor
      router.push(`/reports/${reportData.id}/edit`);
    } catch (error: any) {
      console.error('Error generating report:', error);
      setError(error.message || 'An error occurred while generating the report');
      setLoading(false);
    }
  };


  if (!project) {
    return (
      <div className="loading-container">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="container page-content">
        <header style={{ marginBottom: "2rem" }}>
          <div style={{ marginBottom: "0.5rem", display: "flex" }}>
            {project && (
              <Link
                href={`/projects/${project.id}`}
                className="text-accent"
                style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}
              >
                ← Back to Project
              </Link>
            )}
            {reportId && (
              <Link
                href={`/reports/${reportId}`}
                className="text-accent"
                style={{ marginRight: "0.5rem", fontSize: "0.875rem" }}
              >
                ← Back to Report Details
              </Link>
            )}
          </div>
        </header>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>New Report for {project.name}</h1>
            <p className="text-secondary">
              Location: {project.location}
            </p>
          </div>
          <button
            onClick={generateReport}
            disabled={loading || !bulletPoints.trim()}
            className="btn btn-primary"
          >
            {loading ? 'Generating Report...' : 'Generate Report'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-body">
            <h3 style={{ marginBottom: "1rem" }}>Report Images</h3>
            <div style={{ marginBottom: "1rem", display: 'flex', gap: '1rem' }}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="image-upload"
              />
              
              <button 
                type="button"
                onClick={() => router.push(`/projects/${projectId}/images?mode=select&returnTo=reports`)}
                className="btn btn-secondary"
                disabled={loading}
              >
                Select Photos
              </button>
              <label htmlFor="image-upload" className="btn btn-secondary">
                Import From Local Files
              </label>
              {/* <button 
                onClick={testImageDocument}
                className="btn btn-primary"
                disabled={allImages.length === 0}
              >
                Test Image Document
              </button> */}
            </div>

            {allImages.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <h4 style={{ marginBottom: "1rem" }}>Project Images</h4>
                {allImages.map((image, idx) => (
                  <div key={image.id} className="card" style={{ display: 'flex', gap: '1.5rem', padding: '1rem', marginBottom: '2rem' }}>
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <textarea
                          value={image.description || ''}
                          onChange={(e) => {
                            setAllImages(prev => prev.map((img, i) => i === idx ? { ...img, description: e.target.value } : img));
                          }}
                          placeholder="Enter notes for this image..."
                          style={{
                            width: '100%',
                            minHeight: '200px',
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            border: '1px solid var(--color-border)',
                            borderRadius: '0.25rem',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            name={`noteType-${idx}`}
                            checked={image.tag === 'overview'}
                            onChange={() => {
                              setAllImages(prev => prev.map((img, i) => i === idx ? { ...img, tag: 'overview' } : img));
                            }}
                            style={{ margin: 0 }}
                          />
                          Overview
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            name={`noteType-${idx}`}
                            checked={image.tag === 'deficiency'}
                            onChange={() => {
                              setAllImages(prev => prev.map((img, i) => i === idx ? { ...img, tag: 'deficiency' } : img));
                            }}
                            style={{ margin: 0 }}
                          />
                          Deficiency
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAllImages(prev => prev.filter((_, i) => i !== idx))}
                        className="btn btn-danger btn-sm"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Remove Image
                      </button>
                    </div>
                    <div style={{ flex: '1' }}>
                      <img
                        src={image.url}
                        alt={image.description || 'Project image'}
                        style={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: '300px',
                          objectFit: 'contain',
                          borderRadius: '0.25rem'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ minHeight: "400px", position: "relative" }}>
          <div className="card-body">
            <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }} className="text-secondary">
              Enter your observation notes as bullet points below. These will be used to generate a detailed report. Press "Generate Report" when you're ready.
            </p>
            <textarea
              value={bulletPoints}
              onChange={(e) => setBulletPoints(e.target.value)}
              style={{ 
                width: "100%", 
                minHeight: "300px",
                padding: "1rem",
                fontSize: "1rem",
                lineHeight: "1.5",
                border: "1px solid var(--color-border)",
                borderRadius: "0.25rem",
                resize: "vertical"
              }}
              placeholder={'• Observed water damage in northwest corner \n \
• Ceiling tiles showing discoloration \n \
• HVAC system making unusual noise \n \
• Foundation appears to be settling on the east side \n \
• ...'}
              disabled={loading}
            />
            
            {loading && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10
              }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  border: "5px solid #f3f3f3",
                  borderTop: "5px solid #2b579a",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  marginBottom: "1rem"
                }} />
                <style jsx>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                <p style={{ fontSize: "1.125rem", fontWeight: 500 }}>Generating Your Report</p>
                <p style={{ color: "#666", maxWidth: "400px", textAlign: "center", marginTop: "0.5rem" }}>
                  This may take up to a minute as we analyze your bullet points and create a detailed engineering report.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 




// ///TESTING IMAGE DOCUMENT GENERATION
// const testImageDocument = async () => {
//   try {
//     const imagesToTest = allImages;
//     const doc = new Document({
//       sections: [{
//         properties: {},
//         children: [
//           new Paragraph({
//             text: "ENGINEERING REPORT",
//             heading: HeadingLevel.TITLE,
//             alignment: AlignmentType.CENTER,
//           }),
//           new Paragraph({
//             text: `${project?.name || 'Project Name'}`,
//             heading: HeadingLevel.HEADING_1,
//             alignment: AlignmentType.CENTER,
//           }),
//           new Paragraph({
//             text: `Location: ${project?.location || 'Location'}`,
//             alignment: AlignmentType.CENTER,
//           }),
//           new Paragraph({
//             text: `Date: ${new Date().toLocaleDateString()}`,
//             alignment: AlignmentType.CENTER,
//           }),
//           new Paragraph({ text: "" }),
//           new Paragraph({
//             text: "OBSERVATIONS / COMMENTS",
//             heading: HeadingLevel.HEADING_1,
//           }),
//           new Paragraph({
//             text: "1. GENERAL",
//             heading: HeadingLevel.HEADING_2,
//           }),
//           new Paragraph({ text: "" }),
//         ],
//       }],
//     });
//     for (const image of imagesToTest) {
//       try {
//         const imageData = await fetch(image.url).then(res => res.arrayBuffer());
//         const section = {
//           properties: {},
//           children: [
//             new Paragraph({
//               text: image.description || 'No description',
//               spacing: { before: 200, after: 200 },
//             }),
//             new Paragraph({
//               children: [
//                 new ImageRun({
//                   data: imageData,
//                   type: 'png',
//                   transformation: { width: 400, height: 300 },
//                   floating: {
//                     horizontalPosition: { offset: 0 },
//                     verticalPosition: { offset: 0 },
//                     wrap: { type: 1, side: 'bothSides' },
//                   },
//                 }),
//               ],
//             }),
//           ],
//         };
//         (doc as any).addSection(section);
//       } catch (error) {
//         console.error('Error processing image:', error);
//         continue;
//       }
//     }
//     const buffer = await Packer.toBuffer(doc);
//     const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
//     const url = window.URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = 'test-image-document.docx';
//     document.body.appendChild(a);
//     a.click();
//     window.URL.revokeObjectURL(url);
//     document.body.removeChild(a);
//     console.log('Test document generated successfully');
//   } catch (error) {
//     console.error('Error testing image document:', error);
//     setError('Failed to generate test document: ' + (error as Error).message);
//   }
// };