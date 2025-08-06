'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, Project, Report, ChatMessage, ReportImage } from '@/lib/supabase';
import { createWordDocumentWithImages} from '@/lib/word-utils';
import { useChatMessages } from '@/app/reports/[id]/edit/hooks/chat-utils';
import { ReportEditor, EnhancedReportChat } from './components';
import { EmbeddingTestPanel } from './components/EmbeddingTestPanel';
import './report_style.css';

const SECTION_TEMPLATES: Record<string, string> = {
  locationPlan: '[SECTION:LOCATION_PLAN]\n',
  generalProjectStatus: '[SECTION:GENERAL_PROJECT_STATUS]\n',
  stagingArea: '[SECTION:SITE_STAGING_AREA]\n',
};

function renderSpecialSection(paragraph: string): string | null {
  if (paragraph.includes('[SECTION:LOCATION_PLAN]')) {
    return `
      <div class="report-row" style="flex-direction: column; align-items: flex-start;">
        <div class="report-header">Location Plan</div>
        <img src="/placeholder.png" alt="Location Plan Placeholder" class="report-image" style="margin-top: 1rem;" />
      </div>
    `;
  }
  if (paragraph.includes('[SECTION:GENERAL_PROJECT_STATUS]')) {
    return `
      <div>
        <div class="report-header">GENERAL PROJECT STATUS</div>
        <div class="report-boxed-list">
          <div class="report-boxed-item"><span class="report-boxed-num">x.1</span> Projected Completion Date: <u>Currently</u> on schedule <span class="report-boxed-blue">(Modify subheadings as necessary)</span></div>
          <div class="report-boxed-item"><span class="report-boxed-num">x.2</span> Original Estimated Project Completion Date: August 16, 2024 (weather permitting)</div>
          <div class="report-boxed-item"><span class="report-boxed-num">x.3</span> Projected Completion Date: <u>Currently</u> on schedule</div>
        </div>
      </div>
    `;
  }
  if (paragraph.includes('[SECTION:SITE_STAGING_AREA]')) {
    return `
    <div>
    <div class="report-header">Site / Staging Area - Construction Set Up</div>
      <div class="report-row">
          <div class="report-text">
            <div class="report-boxed-item"><span class="report-boxed-num">x.1</span>Items without photo are a row in the table and can be inserted in the table where required to ensure proper ordering of items.</div>
            <div class="report-boxed-item"><span class="report-boxed-num">x.2</span>You can add sub-headings and the row will expand if needed</div>
          </div>
          <div class="report-image-block">
            <img src="/placeholder.png" alt="Site / Staging Area Placeholder" class="report-image" />
            <p class="report-image-caption"><strong>Site / Staging Area</strong></p>
          </div>
      </div>
        
    </div>
      `;
  }
  return null;
}

/**
 * Group bullet points by image reference in the content.
 * Returns an object: { [imageId]: [bullet1, bullet2, ...] }
 */
function groupBulletsByImageAndText(rawContent: string) {
  const lines = rawContent.split(/\n/).map(l => l.trim()).filter(Boolean);
  // Updated regex to handle both grouped [IMAGE:number:group] and ungrouped [IMAGE:number] formats
  const imageRegex = /\[IMAGE:(\d+)(?::([^\]]+))?\]/g;
  const groups: Record<string, string[]> = {};
  const noImageParagraphs: string[] = [];

  for (const line of lines) {
    const imageMatches = [...line.matchAll(imageRegex)];
    if (imageMatches.length > 0) {
      imageMatches.forEach(match => {
        const imageId = match[1];
        const groupName = match[2] || 'Ungrouped'; // Default to 'Ungrouped' if no group name
        if (!groups[imageId]) groups[imageId] = [];
        // Remove the image tag and clean up spaces
        let cleanText = line.replace(imageRegex, '').replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
        groups[imageId].push(cleanText);
      });
    } else {
      noImageParagraphs.push(line);
    }
  }
  return { groups, noImageParagraphs };
}

const processContentWithImages = (rawContent: string, images: ReportImage[]): string => {
  let html = '<div style="width:100%;text-align:center;margin-bottom:1.5rem;"><img src="/pretium_header.png" alt="Pretium Header" style="max-width:100%;height:auto;" /></div>';

  if (images.length === 0) {
    return html + `<div class="report-text">${rawContent}</div>`;
  }

  // Render special sections
  if (rawContent.includes('[SECTION:LOCATION_PLAN]')) {
    html += renderSpecialSection('[SECTION:LOCATION_PLAN]');
  }
  if (rawContent.includes('[SECTION:GENERAL_PROJECT_STATUS]')) {
    html += renderSpecialSection('[SECTION:GENERAL_PROJECT_STATUS]');
  }
  html += '<div class="report-header">OBSERVATIONS</div>';
  if (rawContent.includes('[SECTION:SITE_STAGING_AREA]')) {
    html += renderSpecialSection('[SECTION:SITE_STAGING_AREA]');
  }

  // --- Single-pass, in-order rendering ---
  const lines = rawContent.split(/\n/).map(l => l.trim());
  // Updated regex to handle both grouped [IMAGE:number:group] and ungrouped [IMAGE:number] formats
  const imageRegex = /\[IMAGE:(\d+)(?::([^\]]+))?\]/g;
  const imageBullets: Record<string, string[]> = {};
  const renderedImages = new Set<string>();

  // First pass: collect all bullets for each image (by key)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const imageMatches = [...line.matchAll(imageRegex)];
    if (imageMatches.length > 0) {
      let imageId = imageMatches[0][1];
      let groupName = imageMatches[0][2] || 'Ungrouped'; // Default to 'Ungrouped' if no group name
      let bullet = '';
      if (line.replace(imageRegex, '').trim() === '') {
        // Look back for previous non-empty line
        let prevIdx = i - 1;
        let foundText = '';
        while (prevIdx >= 0) {
          const prevLine = lines[prevIdx].trim();
          if (prevLine && !prevLine.match(imageRegex)) {
            foundText = prevLine;
            break;
          }
          prevIdx--;
        }
        bullet = foundText;
      } else {
        bullet = line.replace(imageRegex, '').replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
      }
      const key = `${imageId}|||${groupName}`;
      if (!imageBullets[key]) {
        imageBullets[key] = [];
      }
      if (bullet) {
        imageBullets[key].push(bullet);
      }
    }
  }

  // Second pass: render in original order, only rendering each image once
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes('[SECTION:LOCATION_PLAN]') ||
      line.includes('[SECTION:GENERAL_PROJECT_STATUS]') ||
      line.includes('[SECTION:SITE_STAGING_AREA]')
    ) {
      continue;
    }
    const imageMatches = [...line.matchAll(imageRegex)];
    if (imageMatches.length > 0) {
      let imageId = imageMatches[0][1];
      let groupName = imageMatches[0][2] || 'Ungrouped'; // Ensure groupName is never undefined
      const key = `${imageId}|||${groupName}`;
      if (!renderedImages.has(key)) {
        renderedImages.add(key);
        const bullets = imageBullets[key] || [];
        const imageNum = parseInt(imageId);
        // First try to find by number only (for ungrouped images)
        let img = images.find(img => img.number === imageNum);
        
        // If groupName is not 'Ungrouped', try to find by group and number
        if (groupName !== 'Ungrouped' && img) {
          const hasGroup = img.group && img.group.length > 0;
          const groupMatches = hasGroup && img.group!.some(g => g === groupName);
          if (!groupMatches) {
            img = undefined; // Reset if group doesn't match
          }
        }
        //
        // If not found with exact match, try fuzzy matching (only for grouped images)
        if (!img && groupName !== 'Ungrouped') {
          const fuzzyImg = images.find(img => {
            if (img.number !== imageNum) return false;
            const hasGroup = img.group && img.group.length > 0;
            if (!hasGroup) return false;
            
            const exactMatch = img.group!.some(g => g === groupName);
            const normalizedMatch = img.group!.some(g =>
              g.toLowerCase().replace(/[^a-z0-9]/g, '') === groupName.toLowerCase().replace(/[^a-z0-9]/g, '')
            );
            const containsMatch = img.group!.some(g =>
              g.toLowerCase().includes(groupName.toLowerCase()) || groupName.toLowerCase().includes(g.toLowerCase())
            );
            return exactMatch || normalizedMatch || containsMatch;
          });
          if (fuzzyImg) {
            img = fuzzyImg;
          }
        }
        html += `
          <div class="report-row">
            <div class="report-text">
              ${bullets.map(bullet => `<div class="report-bullet">${bullet}</div>`).join('')}
            </div>
            <div class="report-image-block">
              ${img ? `
                <img src="${img.url}" alt="${img.description || 'Report image'}" class="report-image" />
                <p class="report-image-caption">
                  <strong>Photo ${imageNum}${groupName !== 'Ungrouped' ? ` (${groupName})` : ''}:</strong> ${img.description || 'No description available'}
                </p>
              ` : `
                <p class="report-image-caption" style="color: red;">
                  <strong>Image not found:</strong> Photo ${imageNum}${groupName !== 'Ungrouped' ? ` from group "${groupName}"` : ''}
                </p>
              `}
            </div>
          </div>
        `;
      }
      continue;
    }
    // Otherwise, render as header, subheading, or normal text
    const isHeader = /^\d+\.\s/.test(line.trim());
    const isSubheading = /^\d+\.\d+\s/.test(line.trim());
    const isSubBullet = line.trim().startsWith('-');
    const numberedMatch = line.match(/^(\d+(?:\.\d+)+)\s+/);
    const isSubNumbered = numberedMatch && numberedMatch[1].split('.').length > 2;
    const indentClass = (isSubBullet || isSubNumbered) ? ' report-indent' : '';
    let text = line;
    if (isHeader) {
      html += `<div class="report-header">${text}</div>`;
    } else if (isSubheading) {
      html += `<div class="report-subheading">${text}</div>`;
    } else if (text) {
      html += `<div class="report-row"><div class="report-text${indentClass}">${text}</div></div>`;
    }
  }

  return html;
};

interface SectionSelection {
  locationPlan: boolean;
  generalProjectStatus: boolean;
  observations: boolean;
  stagingArea: boolean;
}

// Helper to robustly remove a section tag and any following whitespace/newlines
const removeSectionTag = (content: string, tag: string) =>
  content.replace(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\s\n]*', 'g'), '');

export default function EditReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [content, setContent] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [reportImages, setReportImages] = useState<ReportImage[]>([]);
  const [processedContent, setProcessedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState('');
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [showEmbeddingTest, setShowEmbeddingTest] = useState(false);
  const [sectionSelection, setSectionSelection] = useState<SectionSelection>({
    locationPlan: false,
    generalProjectStatus: false,
    observations: true,
    stagingArea: false
  });
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const reportId = params.id as string;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const nonSpecialContentRef = useRef('');

  // Check if user is authenticated and handle streaming
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    };

    const fetchData = async () => {
      if (!reportId) return;

      try {
        // Fetch report
        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (reportError) throw reportError;
        if (!reportData) throw new Error('Report not found');

        console.log('Fetched report data:', reportData);

        setReport(reportData);
        setContent(reportData.generated_content);
        
        // Preserve the original title from the database, only set default if truly empty
        const title = reportData.title || '';
        setReportTitle(title);
        
        setDeliveredAt(reportData.delivered_at || '');

        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', reportData.project_id)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch report images
        const { data: imagesData, error: imagesError } = await supabase
          .from('report_images')
          .select('*')
          .eq('report_id', reportId)
          .order('number', { ascending: true, nullsFirst: false });

        if (imagesError) {
          console.error('Error fetching report images:', imagesError);
        } else {
          console.log('Fetched report images with ordering:', imagesData?.map(img => ({ id: img.id, number: img.number, description: img.description, rotation: img.rotation })));
          
          // Debug: Show all unique groups
          const allGroups = new Set<string>();
          imagesData?.forEach(img => {
            if (img.group && img.group.length > 0) {
              img.group.forEach((g: string) => allGroups.add(g));
            }
          });
          console.log('Available groups in database:', Array.from(allGroups));
          
          setReportImages(imagesData || []);
        }

        // Check if we should start streaming
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('streaming') === 'true') {
          setIsStreaming(true);
          setStreamingStatus('Starting report generation...');
          pollForUpdates(reportId);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(error.message);
      }
    };

    checkAuth();
    fetchData();
  }, [reportId, router]);

  // Process content when report images or content changes
  useEffect(() => {
    if (content && reportImages.length > 0) {
      // Create a sequential mapping of images that respects groups
      const sortedImages = [...reportImages].sort((a, b) => {
        // First sort by group name (alphabetically)
        const aGroup = (a.group && a.group.length > 0) ? a.group[0] : '';
        const bGroup = (b.group && b.group.length > 0) ? b.group[0] : '';
        
        if (aGroup !== bGroup) {
          return aGroup.localeCompare(bGroup);
        }
        
        // Within the same group, sort by number
        if (a.number && b.number) {
          return a.number - b.number;
        } else if (a.number && !b.number) {
          return -1; // Numbered images first
        } else if (!a.number && b.number) {
          return 1; // Numbered images first
        }
        
        // If neither has a number, sort by creation date
        return 0; // No created_at field in ReportImage, so just maintain order
      });
      
      console.log('Sorted images for processing:', sortedImages.map((img, index) => ({
        index: index + 1,
        group: img.group?.[0] || 'ungrouped',
        number: img.number,
        description: img.description
      })));
      
      const processed = processContentWithImages(content, sortedImages);
      setProcessedContent(processed);
    } else {
      setProcessedContent(content);
    }
  }, [content, reportImages]);

  // Focus textarea and adjust height on initial load and when content changes
  useEffect(() => {
    const adjustAndShow = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.max(800, textareaRef.current.scrollHeight)}px`;
        textareaRef.current.focus();
        textareaRef.current.blur();
      }
    };

    const timer = setTimeout(adjustAndShow, 200);
    return () => clearTimeout(timer);
  }, [report, content]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSectionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveReport = async () => {
    if (!report) return;
    
    setIsSaving(true);
    setSaveStatus('Saving...');
    
    try {
      const { error } = await supabase
        .from('reports')
        .update({ 
          generated_content: content,
          title: reportTitle.trim() || null,
          delivered_at: deliveredAt || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);
      
      if (error) throw error;
      setSaveStatus('Saved');
      
      setTimeout(() => {
        setSaveStatus('');
      }, 3000);
    } catch (error: any) {
      console.error('Error saving report:', error);
      setSaveStatus('Failed to save');
      setError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!report || !project) return;
    
    setIsDownloading(true);
    setDownloadStatus('Preparing document...');
    
    // Debug: Log image rotation data
    console.log('Edit page - Images being passed to Word export:', reportImages.map(img => ({
      id: img.id,
      description: img.description,
      rotation: img.rotation,
      url: img.url
    })));
    
    try {
      await createWordDocumentWithImages(
        content,
        reportImages,
        `${reportTitle || 'Report'}.docx`,
        project,
        sectionSelection
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

  // Poll for database updates during streaming
  const pollForUpdates = async (reportId: string) => {
    let pollCount = 0;
    const maxPolls = 900; // 15 minutes max (matches Lambda timeout)
    
    console.log('Starting polling for report:', reportId);
    
    const pollInterval = setInterval(async () => {
      try {
        pollCount++;
        console.log(`Polling attempt ${pollCount}/${maxPolls} for report ${reportId}`);
        
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          setIsStreaming(false);
          setStreamingStatus('Generation timeout - please refresh and try again');
          setError('Report generation timed out - but your content has been preserved. You can continue editing, try generating again, or continue waiting for the current job to finish.');
          return;
        }

        const { data: reportData, error } = await supabase
          .from('reports')
          .select('generated_content, updated_at')
          .eq('id', reportId)
          .single();

        if (error) {
          console.error('Error polling report:', error);
          // Don't clear content on polling errors - just log and continue
          setStreamingStatus('Connection issue - retrying...');
          return;
        }

        if (reportData?.generated_content) {
          const currentContent = reportData.generated_content;
          // Content received
          
          // Always preserve content, even if there are errors
          setContent(currentContent);
          
          // Check if the content contains error indicators
          if (currentContent.includes('ERROR:') || currentContent.includes('FAILED:') || currentContent.includes('❌')) {
            console.log('Generation failed - stopping polling but preserving content');
            setIsStreaming(false);
            setStreamingStatus('Generation failed - but your content has been preserved');
            setError('Report generation failed - but your content has been preserved. You can continue editing or try generating again.');
            clearInterval(pollInterval);
            return;
          }
          
          // Check if generation is complete (either no processing marker or has completion message)
          if (!currentContent.includes('[PROCESSING IN PROGRESS...]') || currentContent.includes('✅ REPORT GENERATION COMPLETE')) {
            console.log('Generation complete - stopping polling');
            setIsStreaming(false);
            setStreamingStatus('Report generation complete!');
            clearInterval(pollInterval);
            
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('streaming');
            newUrl.searchParams.delete('model');
            window.history.replaceState({}, '', newUrl.toString());
          } else {
            if (currentContent.includes('Starting report generation')) {
              setStreamingStatus('Initializing generation...');
            } else if (currentContent.includes('Images resized')) {
              setStreamingStatus('Images processed, generating content...');
            } else if (currentContent.includes('Processing batch')) {
              const batchMatch = currentContent.match(/Processing batch (\d+)\/(\d+)/);
              if (batchMatch) {
                setStreamingStatus(`Processing batch ${batchMatch[1]} of ${batchMatch[2]}...`);
              } else {
                setStreamingStatus('Generating report sections...');
              }
            } else if (currentContent.includes('Starting final review')) {
              setStreamingStatus('Reviewing and polishing report...');
            } else {
              setStreamingStatus('Generating report content...');
            }
          }
        } else {
          // No content yet
          setStreamingStatus('Waiting for generation to start...');
        }
      } catch (error) {
        console.error('Error during polling:', error);
        // Don't clear content on polling errors - preserve what we have
        setStreamingStatus('Connection issue - retrying...');
      }
    }, 2000);

    eventSourceRef.current = { close: () => clearInterval(pollInterval) } as any;
  };

  // Update the section selection handler (only updates selection)
  const handleSectionSelection = (section: keyof typeof SECTION_TEMPLATES, checked: boolean) => {
    setSectionSelection(prev => ({ ...prev, [section]: checked }));
  };

  // useEffect to always rebuild content with enabled special sections at the top
  useEffect(() => {
    setContent(currentContent => {
      let nonSpecial = currentContent;
      Object.values(SECTION_TEMPLATES).forEach(tag => {
        nonSpecial = removeSectionTag(nonSpecial, tag);
      });

      let specialSections = '';
      
      // First add location plan and general project status
      if (sectionSelection.locationPlan) specialSections += SECTION_TEMPLATES.locationPlan;
      if (sectionSelection.generalProjectStatus) specialSections += SECTION_TEMPLATES.generalProjectStatus;
      if (sectionSelection.stagingArea) specialSections += SECTION_TEMPLATES.stagingArea;

      // Add proper spacing between special sections and normal content
      if (specialSections && nonSpecial.trim()) {
        specialSections += '\n\n'; // Add two newlines for spacing
      }

      return (specialSections + nonSpecial).trim();
    });
  }, [sectionSelection]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => router.push(`/projects/${project?.id}`)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ← Back to Project
          </button>
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.8rem',
            fontWeight: '500',
            color: 'white',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}>
            Report Editor
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={saveReport}
            disabled={isSaving}
            style={{
              background: isSaving ? '#666' : '#4CAF50',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              color: 'white',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {isSaving ? 'Saving...' : saveStatus || 'Save'}
          </button>
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
          <button
            onClick={() => setShowEmbeddingTest(true)}
            style={{
              background: '#FF9800',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Test Embeddings
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
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <label style={{ 
            fontSize: '0.875rem', 
            color: '#666',
            display: 'block',
            marginBottom: '0.25rem'
          }}>
            Report Template Sections
          </label>
          <button
            onClick={() => setShowSectionDropdown(!showSectionDropdown)}
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            Add Sections
            <span style={{ fontSize: '0.8rem' }}>▼</span>
          </button>
          {showSectionDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '0.5rem',
              zIndex: 1000,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={sectionSelection.locationPlan}
                    onChange={(e) => handleSectionSelection('locationPlan', e.target.checked)}
                  />
                  Location Plan
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={sectionSelection.generalProjectStatus}
                    onChange={(e) => handleSectionSelection('generalProjectStatus', e.target.checked)}
                  />
                  General Project Status
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={sectionSelection.stagingArea}
                    onChange={(e) => handleSectionSelection('stagingArea', e.target.checked)}
                  />
                  Site Staging Area
                </label>
              </div>
            </div>
          )}
        </div>
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
            content={content}
            setContent={setContent}
            isStreaming={isStreaming}
            streamingStatus={streamingStatus}
            processedContent={processedContent}
            error={error}
            showChat={showChat}
          />
        </div>

        {showChat && (
          <div style={{ 
            width: '500px',
            flexShrink: 0
          }}>
            <EnhancedReportChat
              reportId={reportId}
              content={content}
              project={project}
              report={report}
              user={user}
              reportImages={reportImages}
              setContent={setContent}
            />
          </div>
        )}
      </div>
      
      {showEmbeddingTest && (
        <EmbeddingTestPanel
          project={project}
          onClose={() => setShowEmbeddingTest(false)}
        />
      )}
    </div>
  );
} 


