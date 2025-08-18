// Batched Parallel Execution Strategy with Max 3 Agents
// STREAMING IS ALWAYS ENABLED for real-time progress updates
import { v4 as uuidv4 } from 'uuid';
import { ExecutionStrategy, ExecutionParams, ExecutionResult, GroupingMode, ImageReference, Section } from '../../types';
import { getRelevantKnowledgeChunks } from '../report-knowledge/guards';
import { SectionModel } from './SectionModel';

import { globalLlmLimit } from './limiter';
export class BatchedParallelWithParallelSummaryExecutor implements ExecutionStrategy {
  
  private readonly BATCH_SIZE = 5;
  private readonly MAX_PARALLEL_AGENTS = 3;
  private supabase: any = null;
  private reportId: string = '';

  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const { images, bulletPoints, projectData, llmProvider, promptStrategy, grouping, options, projectId } = params;
    
    // Guard clause to ensure projectId is present
    if (!projectId) {
      throw new Error('projectId is required to execute the report generation.');
    }

    // Store supabase and reportId for real-time updates
    this.supabase = params.supabase;
    this.reportId = params.reportId || ''; // Use the correct reportId
    
    console.log(`🔄 Batched Parallel Executor: Processing ${images.length} images in ${grouping} mode with max ${this.MAX_PARALLEL_AGENTS} agents`);

    try {
      const batches = this.chunkArray(images, this.BATCH_SIZE);
      const allSections: Section[] = [];
      const metadata: any = {};
      
      await this.updateReportContent({
        type: 'status',
        message: `🤖 IMAGE AGENT: Analyzing ${images.length} observations in ${batches.length} batches...`,
      });

      const allPromises: Promise<void>[] = [];
      const activePromises =  new Set<Promise<void>>();

      for (const batch of batches) {
        // If the pool is full, wait for the *fastest* active task to finish, opening up a slot.
        while (activePromises.size >= this.MAX_PARALLEL_AGENTS) {
          await Promise.race(activePromises);
        }

        const promise = this.processBatch(batch, params).then(async (batchSections) => {
          if (batchSections.length > 0) {
            allSections.push(...batchSections);
            const streamingPayload = this.prepareStreamingPayload(allSections);
            await this.updateReportContent({
              type: 'intermediateResult',
              message: `IMAGE AGENT: Analyzed ${allSections.length} of ${images.length} observations...`,
              payload: streamingPayload,
            });
          }
        });

      // Ensure removal happens before the next admission check
      const wrapped = promise.finally(() => activePromises.delete(wrapped as Promise<void>)) as Promise<void>;
      activePromises.add(wrapped);
      allPromises.push(wrapped);
    }

      // Drain remaining
      await Promise.all(allPromises);
            
      await this.updateReportContent({
        type: 'status',
        message: `IMAGE AGENT COMPLETE: Produced ${allSections.length} initial sections. Moving to summary agent...`,
      });

      // STEP 2: Generate final summary sequentially
      console.log('📝 Generating final summary sequentially...');
      
      const summarySystemPrompt = promptStrategy.getSummarySystemPrompt(grouping);
      const summaryTaskPrompt = promptStrategy.generateSummaryPrompt('', {}, allSections);
      
      const fullSummaryPrompt = `${summarySystemPrompt}\n\n${summaryTaskPrompt}`;

      console.log(`📝 Summary prompt length: ${fullSummaryPrompt.length} characters`);
      
      // Add timeout safeguard for summary generation
      const summaryOptions: any = {
        temperature: 0.7,
        maxTokens: 12000  // Increased to prevent content truncation
      };
      
      // Add reasoning effort for GPT-5
      if (params.options?.reasoningEffort) {
        summaryOptions.reasoningEffort = params.options.reasoningEffort;
        summaryOptions.mode = params.mode;
        console.log(`🧠 Summary generation using reasoning effort: ${params.options.reasoningEffort}`);
      }
      
      const summaryPromise = llmProvider.generateContent(fullSummaryPrompt, summaryOptions);

      // Set a timeout of 15 mins for summary generation (increased due to larger content from embeddings)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Summary generation timed out after 15 minutes')), 900000);
      });

      const summaryResponse = await Promise.race([summaryPromise, timeoutPromise]) as any;

      if (summaryResponse.error) {
        console.error(`[ERROR] SUMMARY ERROR: ${summaryResponse.error}`);
        throw new Error(`Summary generation failed: ${summaryResponse.error}`);
      }

      let summaryContent = summaryResponse.content || '';
      let finalSections: Section[] = [];
      try {
        const parsedJson = JSON.parse(summaryContent);
        // NEW: Handle title-only summary response
        if (Array.isArray(parsedJson.titles) && parsedJson.titles.length === allSections.length) {
          console.log('✅ Parsed title-only summary. Merging with original sections.');
          // Map the new titles back to the original sections
          finalSections = allSections.map((section, index) => ({
            ...section,
            title: parsedJson.titles[index] || section.title, // Fallback to old title if new one is empty
          }));
          summaryContent = JSON.stringify({ sections: finalSections }); // Re-serialize for downstream use
        } else if (parsedJson.sections) {
          // OLD FALLBACK: Handle full-section summary response
          console.warn("Summary response was not title-only, falling back to full section parsing.");
          const model = SectionModel.fromJSON(parsedJson);
          finalSections = model.getState().sections;
          summaryContent = JSON.stringify(model.toJSON());
          console.log('Parsed and auto-numbered JSON sections for summary');
        } else {
          console.warn("Summary JSON is missing 'titles' or 'sections' property. Falling back to initial sections.");
          finalSections = allSections; // Fallback to initial sections
        }
      } catch (e: any) {
        console.error('Failed to parse final summaryContent as JSON:', e.message, "Returning raw sections from batches.");
        finalSections = allSections; // Fallback to initial sections if summary parsing fails
      }
      
      console.error(`[DEBUG] EXECUTION COMPLETE: Report generation finished.`);

      const groupedSections = this.createGroupedHierarchy(finalSections);
      await this.supabase.from('reports').update({ sections_json: { sections: groupedSections } }).eq('id', this.reportId);

      // Final success message
      await this.updateReportContent({
        type: 'status',
        message: '✅ Report Generation Complete',
      });

      return {
        content: summaryContent,
        sections: groupedSections,
        metadata: {
          ...metadata,
          finalSummaryGenerated: true,
          initialSectionCount: allSections.length,
          finalSectionCount: finalSections.length,
          executionFlow: 'image_agent -> summary_agent'
        }
      };

    } catch (error) {
      console.error('❌ Batched Parallel Executor Error:', error);
      
      // Try to update the report with error information while preserving existing content
      try {
        if (this.supabase && this.reportId) {
          const errorMessage = `❌ REPORT GENERATION FAILED\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nPlease try generating again.`;
          await this.updateReportContent({ type: 'status', message: errorMessage });
          console.log('📝 Updated report with error message');
        }
      } catch (updateError) {
        console.error('❌ Failed to update report with error:', updateError);
      }
      
      throw error;
    }
  }

  private prepareStreamingPayload(sections: Section[]): Section[] {
    // This function now performs the same grouping as the final step
    // to ensure the streaming data has the same shape as the final data.
    const groupMap = new Map<string, Section[]>();

    // Step 1: Group sections by title
    sections.forEach(section => {
      const title = section.title ? section.title.trim() : 'Untitled';
      if (!groupMap.has(title)) {
        groupMap.set(title, []);
      }
      groupMap.get(title)!.push(section);
    });

    // Step 2: Create a new parent section for each group
    const parentSections: Section[] = [];
    for (const [title, children] of groupMap.entries()) {
      const parentSection: Section = {
        id: uuidv4(),
        title: title,
        number: '',
        children: children.map(child => ({
          id: child.id || uuidv4(), // Reuse ID if available
          number: '',
          bodyMd: child.bodyMd,
          images: child.images,
        })),
      };
      parentSections.push(parentSection);
    }

    // Step 3: Renumber the structure for display
    const model = new SectionModel(parentSections);
    // model.autoNumberSections(); // DO NOT re-number during streaming to keep it fast.
    return model.getState().sections;
  }

  private createGroupedHierarchy(sections: Section[]): Section[] {
    const groupMap = new Map<string, Section[]>();

    // Step 1: Group sections by title
    sections.forEach(section => {
      const title = section.title ? section.title.trim() : 'Untitled';
      if (!groupMap.has(title)) {
        groupMap.set(title, []);
      }
      groupMap.get(title)!.push(section);
    });

    // Step 2: Create a new parent section for each group
    const parentSections: Section[] = [];
    for (const [title, children] of groupMap.entries()) {
      // Create a new parent section
      const parentSection: Section = {
        id: uuidv4(),
        title: title,
        number: '',
        children: children.map(child => ({
          id: uuidv4(),
          number: '',
          bodyMd: child.bodyMd,
          images: child.images || [],
        })),
      };
      parentSections.push(parentSection);
    }

    // Step 3: Renumber the final hierarchical structure
    const model = new SectionModel(parentSections);
    model.autoNumberSections();
    return model.getState().sections;
  }

  private async processBatch(batch: any[], params: ExecutionParams): Promise<Section[]> {
    const { llmProvider, promptStrategy, grouping, projectId, supabase } = params;
  
    if (!projectId || !supabase) {
      console.error('processBatch called without projectId or supabase client.');
      return [];
    }
  
    // One stateless "agent" definition per batch
    const systemPrompt = promptStrategy.getImageSystemPrompt();
  
    // Helper: safe JSON parse → sections[]
    const parseSections = (content?: string): Section[] => {
      if (!content) return [];
      try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed?.sections) ? parsed.sections : [];
      } catch (e: any) {
        console.error('parse error:', e.message);
        return [];
      }
    };
  
    // Map images → globally-throttled per-image tasks
    const perImageTasks = batch.map((img) =>
      globalLlmLimit(async () => {
        const imageTag = `[IMAGE:${img.number}:${img.group?.[0] || ''}]`;
        const description = img.description || '';
        const sectionTitle = img.group?.[0]
          ? `(Section Title: ${img.group[0]})`
          : '(Section Title: N/A - choose section title)';
        const observation = `${sectionTitle} Description: ${description} Image: ${imageTag}`.trim();
  
        // Per-image RAG (can also be throttled if DB/API load becomes an issue)
        const specsText = await getRelevantKnowledgeChunks(supabase, projectId, observation);
        const specifications = specsText ? specsText.split('\n') : [];
        console.log(`📝 [img ${img.number}] specs=${specifications.length}`);
  
        // Tiny per-image prompt (arrays of length 1 keep your builder intact)
        const userPrompt = promptStrategy.generateUserPrompt([observation], specifications, [], grouping);
  
        // Stateless call: same systemPrompt, unique tiny userPrompt
        const resp = await llmProvider.generateContent(
          `${systemPrompt}\n\n${userPrompt}`,
          {
            temperature: 0.3,
            maxTokens: 1500,
            ...(params.options?.reasoningEffort
              ? { reasoningEffort: params.options.reasoningEffort, mode: params.mode }
              : {}),
          }
        );
  
        if (resp?.error) {
          console.error(`[img ${img.number}] LLM error: ${resp.error}`);
          return [] as Section[];
        }
  
        return parseSections(resp.content);
      })
    );
  
    // Collect all sections from this batch (calls are globally throttled)
    const results = await Promise.all(perImageTasks);
    const batchSections = results.flat();
  
    return batchSections;
  }

  private async updateReportContent(log: { type: 'status' | 'intermediateResult', message: string, payload?: any }) {
    console.error(`[STATUS UPDATE] ${log.message}`);
    
    if (!this.supabase || !this.reportId) {
      console.error('[ERROR] UPDATE ERROR: Missing supabase or reportId');
      return;
    }
    
    try {
      const { error } = await this.supabase
        .from('reports')
        .update({ generated_content: JSON.stringify(log) })
        .eq('id', this.reportId);
        
      if (error) {
        console.error(`[ERROR] UPDATE DB ERROR: ${error.message}`);
      }
        
    } catch (error) {
      console.error('[ERROR] UPDATE EXCEPTION:', error);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}


