'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase, Project, Report } from '@/lib/supabase';
import { createWordDocumentWithImages} from '@/hooks/word-utils';
import { ReportEditor, StructuredReportChat } from './components';
import Breadcrumb from '@/components/Breadcrumb';
import './report_style.css';
import { Section } from './operations/types';
import { SectionModel } from '@/lib/jsonTreeModels/SectionModel';
import { ObservationReportStrategy } from '@/lib/report_strucutres/strategies/ObservationReportStrategy';
import { useReportData } from './hooks/useReportData';
import { useReportStreaming } from './hooks/useReportStreaming';

export default function EditReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reportId = params.id as string;
  const [user, setUser] = useState<any>(null);
  
  const [isStreaming, setIsStreaming] = useState(searchParams.get('streaming') === 'true');
  const {
    report,
    project,
    sections,
    setSections,
    reportTitle,
    setReportTitle,
    deliveredAt,
    setDeliveredAt,
    reportImages,
    isLoading: isDataLoading,
    error: dataError,
    content,
    setContent,
  } = useReportData(reportId);

  const { streamingStatus, streamingSections } = useReportStreaming(reportId, isStreaming, setIsStreaming, setSections);
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);

  // This is a placeholder for the undo/redo functionality
  // since useOperations was removed.
  const undo = async () => console.log("Undo action triggered");
  const redo = async () => console.log("Redo action triggered");
  const canUndo = false;
  const canRedo = false;

  const reportStrategy = new ObservationReportStrategy();

  const router = useRouter();
  
  const handleChatComplete = (updatedSections: Section[]) => {
    if (updatedSections) {
      console.log("Chat complete, updating sections on main page.");
      setSections(updatedSections);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (dataError) {
      setError(dataError);
    }
  }, [dataError]);

  const handleDownload = async () => {
    if (!report || !project) return;
    
    setIsDownloading(true);
    setDownloadStatus('Preparing document...');
    
    try {
      await createWordDocumentWithImages(
        sections,
        reportImages,
        `${reportTitle || 'Report'}.docx`,
        project
      );
      
      setDownloadStatus('Downloaded');
      setTimeout(() => {
        setDownloadStatus('');
      }, 3000);
    } catch (error: any) {
      console.error('Error downloading report:', error);
      setDownloadStatus('Failed to download');
      setError(error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddDefaultSections = () => {
    const defaultSections = reportStrategy.getDefaultSections();
    const newSections = [...sections, ...defaultSections];
    const newSectionModel = new SectionModel(newSections, reportStrategy);
    newSectionModel.autoNumberSections();
    setSections(newSectionModel.getState().sections);
  };

  if (isDataLoading) {
    return <div>Loading report...</div>;
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      background: '#f8f9fa'
    }}>
      {/* Top Navigation Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        background: '#0E2841',
        color: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.8rem',
            fontWeight: '500',
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}>
            Report Editor
          </h1>
          
          {project && (
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: `${project.project_name} Project`, href: `/projects/${project.id}` },
                { label: 'Edit Report', isCurrent: true }
              ]}
              customStyle={{
                color: 'white',
                marginBottom: '0'
              }}
            />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            style={{
              background: isDownloading ? '#666' : '#2196F3',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              color: 'white',
              cursor: isDownloading ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {isDownloading ? 'Preparing...' : downloadStatus || 'Download to Word'}
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            style={{
              background: showChat ? '#666' : '#2196F3',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            {showChat ? 'Hide Chat' : 'Show Chat'}
          </button>
        </div>
      </div>

      {/* Add Sections Dropdown and Report Details */}
      <div style={{
        padding: '1rem',
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end', // Aligns items to the bottom, lining up with the input fields
        gap: '1rem'
      }}>
        <button 
          onClick={handleAddDefaultSections}
          style={{
            background: '#f8f9fa', // More subtle background
            border: '1px solid #dee2e6', // A light border
            borderRadius: '4px',
            padding: '0.375rem 0.75rem', // Smaller padding
            color: '#495057', // Darker text for contrast
            cursor: 'pointer',
            fontSize: '0.875rem', // Smaller font size
            lineHeight: 1.5, // Standard line height for buttons
          }}
        >
          Add Default Sections
        </button>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          flex: 1
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
            <label style={{ fontSize: '0.875rem', color: '#666' }}>Report Title</label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Enter report title"
              style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '0.5rem',
                fontSize: '1rem',
                width: '100%'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#666' }}>Delivery Date</label>
            <input
              type="date"
              value={deliveredAt}
              onChange={(e) => setDeliveredAt(e.target.value)}
              style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        gap: '2rem',
        maxWidth: "95%",
        width: "100%", 
        margin: "0 auto", 
        padding: "2rem",
        minHeight: "calc(100vh - 180px)"
      }}>
        <div style={{ 
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ReportEditor
            reportId={reportId}
            sections={isStreaming ? streamingSections : sections}
            onSectionsChange={setSections}
            reportImages={reportImages}
            isStreaming={isStreaming}
            streamingStatus={streamingStatus}
            strategy={reportStrategy}
            content={content}
            setContent={setContent}
          />
        </div>

        {showChat && (
          <div style={{ 
            width: '500px',
            flexShrink: 0
          }}>
            <StructuredReportChat
              reportId={reportId}
              project={project}
              report={report}
              user={user}
              reportImages={reportImages}
              sections={sections}
              undo={undo}
              redo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onChatComplete={handleChatComplete}
            />
          </div>
        )}
      </div>
      

    </div>
  );
} 


