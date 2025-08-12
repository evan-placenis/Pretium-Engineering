import { useState, useCallback, useEffect } from 'react';
import { 
  Section, 
  Operation, 
  OperationResult,
  RenameSectionOp,
  SetSectionBodyOp,
  InsertSectionOp,
  DeleteSectionOp,
  MoveSectionOp
} from '../operations/types';
import { supabase } from '@/lib/supabase';
import { SectionModel } from '@/app/api/chat/models/SectionModel'; // Add if needed, adjust path

// Placeholder parser
async function parseMarkdownToSections(markdown: string): Promise<Section[]> {
  return await SectionModel.fromMarkdown(markdown);
}

export type OperationInput = 
  | Omit<RenameSectionOp, 'id' | 'timestamp' | 'version' | 'prevTitle'>
  | Omit<SetSectionBodyOp, 'id' | 'timestamp' | 'version' | 'prevBody'>
  | Omit<InsertSectionOp, 'id' | 'timestamp' | 'version'>
  | Omit<DeleteSectionOp, 'id' | 'timestamp' | 'version'>
  | Omit<MoveSectionOp, 'id' | 'timestamp' | 'version'>;

  export type { OperationResult }; // If not already exported from types

interface UseOperationsProps {
  reportId: string;
  onSectionsChange?: (sections: Section[]) => void;
  addDebugLog?: (log: string) => void; // Add optional
}

interface UseOperationsReturn {
  applyOperation: (operation: OperationInput) => Promise<OperationResult>;
  undo: () => Promise<OperationResult | null>;
  redo: () => Promise<OperationResult | null>;
  canUndo: boolean;
  canRedo: boolean;
  isLoading: boolean;
  error: string | null;
  sections: Section[];
  operations: Operation[];
  currentVersion: number;
  syncFromMarkdown: (markdown: string) => Promise<void>;
}

export function useOperations({
  reportId,
  onSectionsChange,
  addDebugLog
}: UseOperationsProps): UseOperationsReturn {
  const [sections, setSections] = useState<Section[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [maxVersion, setMaxVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial state from database
  useEffect(() => {
    const loadInitialState = async () => {
      setIsLoading(true);
      try {
        // Try to get current_version
        let { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select('current_version')
          .eq('id', reportId)
          .single();

        let currVersion = reportData?.current_version ?? 0;

        if (reportError?.code === 'PGRST204') {
          // Column doesn't exist - set to 0 and log warning
          console.warn('current_version column missing in reports table. Please add it to Supabase schema (integer, default 0). Using 0 as fallback.');
          currVersion = 0;
          
          // Optionally, attempt to update with current_version (will fail if column missing)
          await supabase
            .from('reports')
            .update({ current_version: 0 })
            .eq('id', reportId);
        } else if (reportError) {
          throw reportError;
        }

        setCurrentVersion(currVersion);

        // Load snapshot for current version
        const { data: snapshotData, error: snapshotError } = await supabase
          .from('report_snapshots')
          .select('sections')
          .eq('report_id', reportId)
          .eq('version', currVersion)
          .single();

        if (snapshotError || !snapshotData?.sections) {
          // No snapshot - create initial from report content
          const { data: contentData, error: contentError } = await supabase
            .from('reports')
            .select('generated_content')
            .eq('id', reportId)
            .single();
          
          if (contentError) throw contentError;
          
          const initialSections = await parseMarkdownToSections(contentData.generated_content || '');
          
          // Use upsert for initial snapshot to avoid duplicate key error
          const { error: insertError } = await supabase
            .from('report_snapshots')
            .upsert({
              report_id: reportId,
              version: currVersion,
              sections: initialSections,
              created_at: new Date().toISOString()
            }, {
              onConflict: 'report_id,version' // Assumes unique constraint on (report_id, version)
            });
          
          if (insertError) throw insertError;
          
          setSections(initialSections);
        } else {
          setSections(snapshotData.sections);
        }

        // Load operations up to current version
        const { data: opsData, error: opsError } = await supabase
          .from('report_operations')
          .select('*')
          .eq('report_id', reportId)
          .lte('version', currVersion)
          .order('version', { ascending: true });

        if (opsError) throw opsError;
        setOperations(opsData ?? []);

        // Get max version for redo
        const { data: maxData, error: maxError } = await supabase
          .rpc('get_max_snapshot_version', { rep_id: reportId });

        if (maxError) throw maxError;
        setMaxVersion(maxData ?? currVersion);

      } catch (err) {
        console.error('Detailed error loading report state:', err);
        
        // Fallback: Initialize empty state and create initial snapshot
        const initialSections: Section[] = [];
        
        // Ensure current_version is set to 0
        const { error: updateVersionError } = await supabase
          .from('reports')
          .update({ current_version: 0 })
          .eq('id', reportId);
        
        if (updateVersionError) {
          console.error('Failed to set initial version:', updateVersionError);
        }
        
        // Use upsert here too
        const { error: insertError } = await supabase
          .from('report_snapshots')
          .upsert({
            report_id: reportId,
            version: 0,
            sections: initialSections,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'report_id,version'
          });
        
        if (insertError) {
          console.error('Failed to create initial snapshot:', insertError);
          setError('Failed to initialize report state');
        } else {
          setSections(initialSections);
          setCurrentVersion(0);
          setMaxVersion(0);
          setOperations([]);
        }
      } finally {
        setIsLoading(false);
        addDebugLog?.(`Operations hook loaded - currentVersion: ${currentVersion}`);
      }
    };

    loadInitialState();
  }, [reportId]);

  // Helper to find a section by ID in the section tree
  const findSection = useCallback((sections: Section[], id: string): [Section | null, Section | null, number] => {
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].id === id) {
        return [sections[i], null, i];
      }
      for (let j = 0; j < sections[i].children.length; j++) {
        if (sections[i].children[j].id === id) {
          return [sections[i].children[j], sections[i], j];
        }
      }
    }
    return [null, null, -1];
  }, []);

  // Helper to create a deep copy of sections
  const cloneSections = useCallback((sectionsToClone: Section[]): Section[] => {
    return JSON.parse(JSON.stringify(sectionsToClone));
  }, []);

  const applyOperation = useCallback(async (
    operationData: OperationInput
  ): Promise<OperationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const newSections = cloneSections(sections);
      
      let additionalOpData = {};

      switch (operationData.type) {
        case 'rename_section': {
          const [section] = findSection(newSections, operationData.sectionId);
          if (!section) throw new Error(`Section ${operationData.sectionId} not found`);
          additionalOpData = { prevTitle: section.title };
          section.title = operationData.newTitle;
          break;
        }
        case 'set_section_body': {
          const [section] = findSection(newSections, operationData.sectionId);
          if (!section) throw new Error(`Section ${operationData.sectionId} not found`);
          additionalOpData = { prevBody: section.bodyMd };
          section.bodyMd = operationData.newBody;
          break;
        }
        case 'insert_section': {
          const [afterSection, parent, afterIndex] = findSection(newSections, operationData.afterId);
          if (!afterSection) throw new Error(`Section ${operationData.afterId} not found`);
          const insertIndex = afterIndex + 1;
          if (parent) {
            parent.children.splice(insertIndex, 0, operationData.section);
          } else {
            newSections.splice(insertIndex, 0, operationData.section);
          }
          additionalOpData = { insertedIndex: insertIndex, parentId: parent?.id };
          break;
        }
        case 'delete_section': {
          const [section, parent, index] = findSection(newSections, operationData.section.id);
          if (!section) throw new Error(`Section ${operationData.section.id} not found`);
          additionalOpData = { deletedSection: section, parentId: parent?.id, deletedIndex: index };
          if (parent) {
            parent.children.splice(index, 1);
          } else {
            newSections.splice(index, 1);
          }
          break;
        }
        case 'move_section': {
          const [section, fromParent, fromIndex] = findSection(newSections, operationData.sectionId);
          if (!section) throw new Error(`Section ${operationData.sectionId} not found`);
          const [, toParent] = findSection(newSections, operationData.toParentId);
          additionalOpData = { fromParentId: fromParent?.id, fromIndex };
          
          // Remove from old
          if (fromParent) {
            fromParent.children.splice(fromIndex, 1);
          } else {
            newSections.splice(fromIndex, 1);
          }
          
          // Add to new
          const toIndex = operationData.toIndex ?? (toParent?.children.length ?? newSections.length);
          if (toParent) {
            toParent.children.splice(toIndex, 0, section);
          } else {
            newSections.splice(toIndex, 0, section);
          }
          break;
        }
      }

      // Get current version
      const { data: reportData, error: versionError } = await supabase
        .from('reports')
        .select('current_version')
        .eq('id', reportId)
        .single();

      if (versionError) {
        console.error('Version fetch error:', versionError);
        throw versionError;
      }
      
      const newVersion = (reportData.current_version ?? 0) + 1;

      // Create operation
      const operation: Operation = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        version: newVersion,
        ...operationData,
        ...additionalOpData
      } as Operation; // Type assertion to satisfy union

      // Save operation
      const { error: opError } = await supabase
        .from('report_operations')
        .insert({
          id: operation.id,
          report_id: reportId,
          version: newVersion,
          operation_type: operation.type,
          operation_data: operation,  // Store full op with additional data
          created_at: operation.timestamp
        });

      if (opError) {
        console.error('Operation insert error:', opError);
        throw opError;
      }

      // Save new snapshot
      const { error: snapshotError } = await supabase
        .from('report_snapshots')
        .insert({
          report_id: reportId,
          version: newVersion,
          sections: newSections,
          created_at: operation.timestamp
        });

      if (snapshotError) {
        console.error('Snapshot insert error:', snapshotError);
        throw snapshotError;
      }

      // Update current version
      const { error: updateError } = await supabase
        .from('reports')
        .update({ current_version: newVersion })
        .eq('id', reportId);

      if (updateError) {
        console.error('Current version update error:', updateError);
        throw updateError;
      }

      // Verify the update by re-fetching
      const { data: verifiedData, error: verifyError } = await supabase
        .from('reports')
        .select('current_version')
        .eq('id', reportId)
        .single();

      if (verifyError || verifiedData.current_version !== newVersion) {
        console.error('Current version update verification failed:', verifyError, 'DB value:', verifiedData?.current_version);
        throw new Error('Failed to verify version update');
      }

      // Refresh maxVersion
      const { data: maxData, error: maxError } = await supabase
        .rpc('get_max_snapshot_version', { rep_id: reportId });

      if (maxError) {
        console.error('Max version refresh error:', maxError);
        throw maxError;
      }
      const updatedMax = maxData ?? newVersion;

      // Update state
      setSections(newSections);
      setOperations(prev => {
        const newOps = [...prev, operation];
        return newOps;
      });
      setCurrentVersion(newVersion);
      setMaxVersion(updatedMax);
      onSectionsChange?.(newSections);

      return {
        success: true,
        operation,
        newVersion
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply operation';
      console.error('Apply operation failed:', err);
      setError(errorMessage);
      return {
        success: false,
        operation: operationData as Operation,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [sections, operations, reportId, findSection, cloneSections, onSectionsChange, maxVersion, currentVersion]); // Added currentVersion to deps if needed for reactivity

  const saveMarkdown = useCallback(async (sections: Section[]): Promise<void> => {
    if (sections.length === 0) {
      console.log('Skipping autosave - empty sections');
      return;
    }
    const markdown = new SectionModel(sections).toMarkdown();
    console.log('Autosaving markdown to DB');

    const { error } = await supabase
      .from('reports')
      .update({ generated_content: markdown, updated_at: new Date().toISOString() })
      .eq('id', reportId);

    if (error) {
      console.error('Autosave error:', error);
    } else {
      console.log('Autosave succeeded');
    }
  }, [reportId]);

  const syncFromMarkdown = useCallback(async (markdown: string): Promise<void> => {
    console.log('Sync called with markdown length: ' + markdown.length);
    try {
      console.log('Parsing markdown to sections');
      const newSections = await parseMarkdownToSections(markdown);
      console.log('Parsed sections: ' + newSections.length + ' - Step completed');

      console.log('Fetching current version for sync');
      const { data: reportData, error: versionError } = await supabase
        .from('reports')
        .select('current_version')
        .eq('id', reportId)
        .single();

      if (versionError) throw versionError;
      console.log('Version fetch completed');

      const newVersion = (reportData.current_version ?? 0) + 1;

      console.log('Saving sync operation for version ' + newVersion);
      const syncOperation = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        version: newVersion,
        type: 'sync',
        data: { fromMarkdown: true } // Custom type for sync
      };
      let opType = 'sync';
      const { error: opError } = await supabase
        .from('report_operations')
        .insert({
          id: syncOperation.id,
          report_id: reportId,
          version: newVersion,
          operation_type: opType,
          operation_data: syncOperation,
          created_at: syncOperation.timestamp
        });

      if (opError && opError.code === '23514') {
        console.log('Sync operation type not allowed, falling back to insert_section');
        opType = 'insert_section';
        const { error: fallbackError } = await supabase
          .from('report_operations')
          .insert({
            id: syncOperation.id,
            report_id: reportId,
            version: newVersion,
            operation_type: opType,
            operation_data: syncOperation,
            created_at: syncOperation.timestamp
          });

        if (fallbackError) throw fallbackError;
      }

      // Continue with snapshot save even if operation failed
      const { error: snapshotError } = await supabase
        .from('report_snapshots')
        .insert({
          report_id: reportId,
          version: newVersion,
          sections: newSections,
          created_at: new Date().toISOString()
        });

      if (snapshotError) throw snapshotError;
      console.log('Snapshot saved - Step completed');

      console.log('Updating current version to ' + newVersion);
      const { error: updateError } = await supabase
        .from('reports')
        .update({ current_version: newVersion })
        .eq('id', reportId);

      if (updateError) throw updateError;
      console.log('Current version updated - Step completed');

      setSections(newSections);
      setCurrentVersion(newVersion);
      console.log('Local state updated to version ' + newVersion);

      // After update current_version, refresh maxVersion
      const { data: maxData, error: maxError } = await supabase
        .rpc('get_max_snapshot_version', { rep_id: reportId });

      if (maxError) throw maxError;
      setMaxVersion(maxData ?? newVersion);

      await saveMarkdown(newSections);

    } catch (err) {
      console.error('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown'));
    }
  }, [reportId, parseMarkdownToSections, setSections, setCurrentVersion, setMaxVersion]);

  const loadSnapshot = async (version: number) => {
    console.log(`Loading snapshot for version ${version}`);
    const { data, error } = await supabase
      .from('report_snapshots')
      .select('sections')
      .eq('report_id', reportId)
      .eq('version', version)
      .single();

    if (error) {
      console.error('Snapshot load error:', error);
      if (error.code === 'PGRST116') {
        console.log('No snapshot found for version ' + version + ' - falling back to original content');

        const { data: reportData, error: contentError } = await supabase
          .from('reports')
          .select('generated_content')
          .eq('id', reportId)
          .single();

        if (contentError) throw contentError;

        const fallbackMarkdown = reportData.generated_content || '';
        const fallbackSections = await parseMarkdownToSections(fallbackMarkdown);
        console.log('Fallback sections loaded:', fallbackSections.length);
        return fallbackSections;
      }
      throw error;
    }
    return data.sections || [];
  };

  const undo = useCallback(async () => {
    if (currentVersion <= 0) {
      return null;
    }
    setIsLoading(true);

    try {
      const newVersion = currentVersion - 1;

      // Update current version in DB
      const { error: updateError } = await supabase
        .from('reports')
        .update({ current_version: newVersion })
        .eq('id', reportId);

      if (updateError) {
        console.error('Undo update error:', updateError);
        throw updateError;
      }

      // Load previous snapshot
      const prevSections = await loadSnapshot(newVersion);

      const safeSections = prevSections ?? [];
      setSections(safeSections);
      console.log('Undo loaded sections:', safeSections.length);

      // Load operations up to new version
      const { data: opsData, error: opsError } = await supabase
        .from('report_operations')
        .select('*')
        .eq('report_id', reportId)
        .lte('version', newVersion)
        .order('version', { ascending: true });

      if (opsError) {
        console.error('Undo ops load error:', opsError);
        throw opsError;
      }

      setOperations(opsData ?? []);
      setCurrentVersion(newVersion);
      onSectionsChange?.(safeSections);

      return { 
        success: true, 
        operation: {} as Operation,
        newVersion 
      };
    } catch (err) {
      console.error('Undo failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to undo');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentVersion, reportId, onSectionsChange]);

  const redo = useCallback(async () => {
    if (currentVersion >= maxVersion) {
      return null;
    }
    setIsLoading(true);

    try {
      const newVersion = currentVersion + 1;

      // Update current version
      const { error: updateError } = await supabase
        .from('reports')
        .update({ current_version: newVersion })
        .eq('id', reportId);

      if (updateError) {
        console.error('Redo update error:', updateError);
        throw updateError;
      }

      // Load next snapshot
      const nextSections = await loadSnapshot(newVersion);

      // Load additional operation
      const { data: opData, error: opError } = await supabase
        .from('report_operations')
        .select('*')
        .eq('report_id', reportId)
        .eq('version', newVersion)
        .single();

      if (opError) {
        console.error('Redo op load error:', opError);
        throw opError;
      }

      setSections(nextSections);
      setOperations(prev => [...prev, opData]);
      setCurrentVersion(newVersion);
      onSectionsChange?.(nextSections);

      return { 
        success: true, 
        operation: {} as Operation,
        newVersion 
      };
    } catch (err) {
      console.error('Redo failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to redo');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentVersion, maxVersion, reportId, onSectionsChange]);

  return {
    applyOperation,
    undo,
    redo,
    canUndo: currentVersion > 0,
    canRedo: currentVersion < maxVersion,
    isLoading,
    error,
    sections,
    operations,
    currentVersion,
    syncFromMarkdown
  };
}