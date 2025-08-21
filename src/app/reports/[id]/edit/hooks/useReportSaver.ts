import { useState, useCallback } from 'react';
import type { Section } from '@/lib/jsonTreeModels/types/section';

export function useReportSaver(reportId: string) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveSections = useCallback(async (sections: Section[]): Promise<boolean> => {
    if (!reportId) {
      setSaveError("Report ID is not available.");
      return false;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/reports/${reportId}/sections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sections }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save sections');
      }

      console.log("Sections saved successfully.");
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while saving.';
      console.error('Save error:', errorMessage);
      setSaveError(errorMessage);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [reportId]);

  return { isSaving, saveError, saveSections };
}
