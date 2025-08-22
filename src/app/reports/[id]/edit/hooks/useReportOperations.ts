'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Section } from '@/lib/jsonTreeModels/types/section';
import { revalidateReportTag } from '@/app/actions';

function useDebounce(value: any, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export function useReportOperations(
    reportId: string,
    onSectionsUpdated: (sections: Section[]) => void,
    showToast: (config: ToastConfig) => void
) {
    const [loading, setLoading] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [lastEditTimestamp, setLastEditTimestamp] = useState<number>(Date.now());
    const debouncedLastEditTimestamp = useDebounce(lastEditTimestamp, 500);

    useEffect(() => {
        const clearHistory = async () => {
            if (!reportId) return;
            console.log(`[History] Clearing undo/redo history for report: ${reportId}`);
            const { error } = await supabase.rpc('clear_report_history', { p_report_id: reportId });
            if (error) {
                console.error('Error clearing report history:', error);
                showToast({ message: `Failed to clear report history: ${error.message}`, type: 'error' });
            }
             // Fetch the initial status after clearing
            updateHistoryStatus();
        };

        clearHistory();
    }, [reportId]); // Run only when reportId changes (i.e., on load)


    const updateHistoryStatus = useCallback(async () => {
        if (!reportId) return;
        const { data, error } = await supabase.rpc('get_history_status', { p_report_id: reportId });
        if (error) {
            console.error('Error fetching history status:', error);
        } else if (data && data.length > 0) {
            setCanUndo(data[0].can_undo);
            setCanRedo(data[0].can_redo);
        }
    }, [reportId]);

    useEffect(() => {
        updateHistoryStatus();
    }, [debouncedLastEditTimestamp, updateHistoryStatus]);
    
    const fetchCurrentSections = useCallback(async (): Promise<Section[] | null> => {
        const { data, error } = await supabase.from('reports').select('sections_json').eq('id', reportId).single();
        if (error) {
            console.error('Failed to fetch current sections:', error);
            return null;
        }
        return data?.sections_json?.sections || [];
    }, [reportId]);

    const undo = useCallback(async (): Promise<Section[] | null> => {
        setLoading(true);
        try {
            const { error } = await supabase.rpc('report_undo', { p_report_id: reportId });
            if (error) throw error;

            // Invalidate the cache before fetching the new state
            const revalidation = await revalidateReportTag(reportId);
            if (revalidation.success) {
                console.log("Cache revalidated for undo.");
            } else {
                console.log(`Cache revalidated failed:${revalidation.error}`);
            }

            const newSections = await fetchCurrentSections();
            setLastEditTimestamp(Date.now()); // Trigger history status refresh
            return newSections;
        } catch (error: any) {
            console.error("Undo failed:", error);
            showToast({ message: `Undo failed: ${error.message}`, type: 'error' });
            return null;
        } finally {
            setLoading(false);
        }
    }, [reportId, showToast, fetchCurrentSections]);

    const redo = useCallback(async (): Promise<Section[] | null> => {
        setLoading(true);
        try {
            const { error } = await supabase.rpc('report_redo', { p_report_id: reportId });
            if (error) throw error;

            // Invalidate the cache before fetching the new state
            const revalidation = await revalidateReportTag(reportId);
            if (revalidation.success) {
                console.log("Cache revalidated for undo.");
            } else {
                console.log(`Cache revalidated failed:${revalidation.error}`);
            }

            const newSections = await fetchCurrentSections();
            setLastEditTimestamp(Date.now()); // Trigger history status refresh
            return newSections;
        } catch (error: any) {
            console.error("Redo failed:", error);
            showToast({ message: `Redo failed: ${error.message}`, type: 'error' });
            return null;
        } finally {
            setLoading(false);
        }
    }, [reportId, showToast, fetchCurrentSections]);

    const signalEdit = useCallback(() => {
        setLastEditTimestamp(Date.now());
    }, []);

    return { undo, redo, canUndo, canRedo, signalEdit, fetchCurrentSections, lastEditTimestamp };
}
