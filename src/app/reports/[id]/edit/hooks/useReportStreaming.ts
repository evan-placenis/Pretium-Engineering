import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Section } from '../operations/types';
import { SectionModel } from '@/lib/jsonTreeModels/SectionModel';
import { ObservationReportStrategy } from '@/lib/report_strucutres/strategies/ObservationReportStrategy';

export function useReportStreaming(reportId: string, isStreaming: boolean, setIsStreaming: (isStreaming: boolean) => void, setSections: (sections: Section[]) => void) {
  const [streamingStatus, setStreamingStatus] = useState('');
  const [streamingSections, setStreamingSections] = useState<Section[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reportStrategy = new ObservationReportStrategy();

  useEffect(() => {
    if (!isStreaming) return;

    const pollForUpdates = () => {
      let pollCount = 0;
      const maxPolls = 900;

      const pollInterval = setInterval(async () => {
        try {
          pollCount++;
          if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            setStreamingStatus('Generation timeout - please refresh and try again');
            return;
          }

          const { data: reportData, error } = await supabase
            .from('reports')
            .select('generated_content, sections_json')
            .eq('id', reportId)
            .single();

          if (error) {
            console.error('Error polling report:', error);
            setStreamingStatus('Connection issue - retrying...');
            return;
          }

          let statusMessage = 'Waiting for generation to start...';
          let log: any = null;

          if (reportData?.generated_content) {
            try {
              log = JSON.parse(reportData.generated_content);
              statusMessage = log.message || 'Processing...';
              if (log.type === 'intermediateResult' && Array.isArray(log.payload)) {
                setStreamingSections(log.payload);
              }
            } catch (e) {
              statusMessage = reportData.generated_content;
            }
          }
          setStreamingStatus(statusMessage);

          if (statusMessage.includes('✅') || statusMessage.includes('❌')) {
            console.log('Generation finished - stopping polling.');
            
            // Prioritize final sections_json, but fall back to payload
            if (statusMessage.includes('✅')) {
              if (reportData.sections_json) {
                console.log('Loading final sections_json after completion signal.');
                try {
                  const finalSections = SectionModel.fromJSON(reportData.sections_json).getState().sections;
                  setSections(finalSections);
                } catch (jsonError) {
                  console.error('Failed to parse final sections_json:', jsonError, 'Raw data:', reportData.sections_json);
                  setStreamingStatus('Error loading final report - please refresh.');
                }
              } else if (log && log.type === 'intermediateResult' && Array.isArray(log.payload)) {
                // Fallback to the last payload if sections_json isn't ready
                setSections(log.payload);
              }
            }
            
            setIsStreaming(false);
            clearInterval(pollInterval);
            
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('streaming');
            newUrl.searchParams.delete('model');
            window.history.replaceState({}, '', newUrl.toString());
          }
        } catch (e: any) {
          console.error('Error in polling interval:', e);
          setStreamingStatus('An error occurred during polling.');
        }
      }, 2000);

      eventSourceRef.current = { close: () => clearInterval(pollInterval) } as any;
    };

    pollForUpdates();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [reportId, isStreaming, setIsStreaming, setSections]);

  return { streamingStatus, streamingSections };
}
