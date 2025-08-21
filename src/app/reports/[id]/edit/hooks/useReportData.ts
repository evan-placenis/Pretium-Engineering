import { useState, useEffect } from 'react';
import { supabase, Project, Report } from '@/lib/supabase';
import { Section } from '../operations/types';
import { SectionModel } from '@/lib/jsonTreeModels/SectionModel';
import { ReportImage as ReportImageType } from '@/types/reportImage';

export function useReportData(reportId: string) {
  const [report, setReport] = useState<Report | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [content, setContent] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [reportImages, setReportImages] = useState<ReportImageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', reportId)
          .maybeSingle();

        if (reportError) throw reportError;
        if (!reportData) {
          setError('Report not found');
          setIsLoading(false);
          return;
        }
        
        setReport(reportData);
        setReportTitle(reportData.title || '');
        setDeliveredAt(reportData.delivered_at || '');

        let loadedSections: Section[] = [];
        if (reportData.sections_json && reportData.sections_json.sections) {
          console.log('Loading from sections_json');
          loadedSections = SectionModel.fromJSON(reportData.sections_json).getState().sections;
        } else {
          console.log('No sections_json found, starting with an empty report.');
        }
        setSections(loadedSections);
        setContent(loadedSections.length > 0 ? new SectionModel(loadedSections).toMarkdown() : '');

        const { data: imagesData, error: imagesError } = await supabase
          .from('report_images')
          .select('*')
          .eq('report_id', reportId)
          .order('number', { ascending: true });
        if (imagesError) throw imagesError;

        const bucket = 'report_images';
        const imagesWithUrls = await Promise.all(
            (imagesData || []).map(async (image) => {
              if (image.url?.startsWith('http')) {
                return { ...image, signedUrl: image.url };
              }

              const filePath = image.storage_path || `${reportId}/${image.url.split('/').pop()}`;

              try {
                const { data: signed, error: signErr } = await supabase.storage
                  .from(bucket)
                  .createSignedUrl(filePath, 3600); 

                if (signErr) {
                  console.error(`Could not sign ${filePath}`, signErr);
                  return { ...image, signedUrl: '' }; 
                }
                return { ...image, signedUrl: signed.signedUrl };
              } catch (e) {
                console.error(`Exception during signing for ${filePath}`, e)
                return { ...image, signedUrl: '' }; 
              }
            })
        );
        setReportImages(imagesWithUrls as ReportImageType[]);

        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', reportData.project_id)
          .single();
        if (projectError) throw projectError;
        setProject(projectData);

      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [reportId]);

  useEffect(() => {
    if (sections && sections.length > 0) {
      setContent(new SectionModel(sections).toMarkdown());
    } else {
      setContent('');
    }
  }, [sections]);

  return {
    report,
    project,
    sections,
    setSections,
    content,
    setContent,
    reportTitle,
    setReportTitle,
    deliveredAt,
    setDeliveredAt,
    reportImages,
    isLoading,
    error,
  };
}