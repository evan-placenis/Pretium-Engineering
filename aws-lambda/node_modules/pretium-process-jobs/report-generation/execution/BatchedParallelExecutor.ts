// Batched Parallel Execution Strategy with Max 3 Agents
// STREAMING IS ALWAYS ENABLED for real-time progress updates
import { ExecutionStrategy, ExecutionParams, ExecutionResult, GroupingMode } from '../types.ts';

export class BatchedParallelExecutor implements ExecutionStrategy {
  private readonly BATCH_SIZE = 5;
  private readonly MAX_PARALLEL_AGENTS = 3;
  private supabase: any = null;
  private reportId: string = '';

  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const { images, bulletPoints, projectData, llmProvider, promptStrategy, grouping, options } = params;
    
    // Store supabase and reportId for real-time updates
    this.supabase = params.supabase;
    this.reportId = params.reportId || ''; // Use the correct reportId
    
    console.log(`🔄 Batched Parallel Executor: Processing ${images.length} images in ${grouping} mode with max ${this.MAX_PARALLEL_AGENTS} agents`);

    try {
      let content = '';
      const metadata: any = {};

      // STEP 1: Process images in batches with limited parallel agents
      if (grouping === 'grouped') {
        const result = await this.processGroupedImagesBatched(images, params);
        content = result.content;
        Object.assign(metadata, result.metadata);
      } else {
        const result = await this.processUngroupedImagesBatched(images, params);
        content = result.content;
        Object.assign(metadata, result.metadata);
      }

      // STEP 2: Generate final summary sequentially
      console.error('[DEBUG] STARTING SUMMARY PHASE');
      console.log('📝 Generating final summary sequentially (STREAMING ENABLED)...');
      
      // Update report to indicate summary has started
      await this.updateReportContent(content + '\n\n📝 SUMMARY PHASE: Starting final review and formatting...', false);
      
      const summarySystemPrompt = promptStrategy.getSummarySystemPrompt(grouping);
      const summaryTaskPrompt = promptStrategy.generateSummaryPrompt(content, {
        mode: params.mode,
        grouping,
        bulletPoints,
        projectData,
        options
      });
      
      const fullSummaryPrompt = `${summarySystemPrompt}\n\n${summaryTaskPrompt}`;

      console.log(`📝 Summary prompt length: ${fullSummaryPrompt.length} characters`);
      
      // Add timeout safeguard for summary generation
      const summaryPromise = llmProvider.generateContent(fullSummaryPrompt, {
        temperature: 0.7,
        maxTokens: 12000  // Increased to prevent content truncation
      });

      // Set a timeout of 180 seconds for summary generation (increased due to larger content from embeddings)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Summary generation timed out after 6 minutes')), 360000);
      });

      const summaryResponse = await Promise.race([summaryPromise, timeoutPromise]) as any;

      console.error(`[DEBUG] SUMMARY RESPONSE: hasError=${!!summaryResponse.error}, hasContent=${!!summaryResponse.content}, contentLength=${summaryResponse.content?.length || 0}`);

      if (summaryResponse.error) {
        console.error(`[ERROR] SUMMARY ERROR: ${summaryResponse.error}`);
        throw new Error(`Summary generation failed: ${summaryResponse.error}`);
      }

      if (!summaryResponse.content || summaryResponse.content.trim().length === 0) {
        console.error(`[ERROR] SUMMARY EMPTY: No content returned`);
        throw new Error(`Summary generation returned empty content`);
      }

      console.error(`[DEBUG] SUMMARY SUCCESS: Updating report with ${summaryResponse.content.length} characters`);
      
      // Update report with final summary content
      await this.updateReportContent(summaryResponse.content, true);
      
      console.error(`[DEBUG] SUMMARY COMPLETE: Report updated successfully`);

      return {
        content: summaryResponse.content,
        metadata: {
          ...metadata,
          finalSummaryGenerated: true,
          originalContentLength: content.length,
          finalContentLength: summaryResponse.content.length,
          executionFlow: 'batched_parallel_report_writing -> sequential_summary'
        }
      };

    } catch (error) {
      console.error('❌ Batched Parallel Executor Error:', error);
      
      // Try to update the report with error information while preserving existing content
      try {
        if (this.supabase && this.reportId) {
          // Get current content first
          const { data: currentReport } = await this.supabase
            .from('reports')
            .select('generated_content')
            .eq('id', this.reportId)
            .single();
          
          let currentContent = currentReport?.generated_content || '';
          
          // Remove processing marker if it exists
          currentContent = currentContent.replace(/\n\n\[PROCESSING IN PROGRESS\.\.\.\]/g, '\n\n❌ REPORT GENERATION FAILED');
          currentContent = currentContent.replace(/\n\[PROCESSING IN PROGRESS\.\.\.\]/g, '\n\n❌ REPORT GENERATION FAILED');
          currentContent = currentContent.replace(/\[PROCESSING IN PROGRESS\.\.\.\]/g, '\n\n❌ REPORT GENERATION FAILED');
          
          // Only append error message if there's existing content to preserve
          if (currentContent.trim().length > 0) {
            const errorMessage = `\n\n❌ REPORT GENERATION FAILED\n\nError: ${error}\n\nYour content has been preserved. You can continue editing or try generating again.`;
            const updatedContent = currentContent + errorMessage;
            
            await this.supabase
              .from('reports')
              .update({ generated_content: updatedContent })
              .eq('id', this.reportId);
          } else {
            // If no existing content, just show the error
            const errorMessage = `❌ REPORT GENERATION FAILED\n\nError: ${error}\n\nPlease try generating again.`;
            await this.supabase
              .from('reports')
              .update({ generated_content: errorMessage })
              .eq('id', this.reportId);
          }
          console.log('📝 Updated report with error message');
        }
      } catch (updateError) {
        console.error('❌ Failed to update report with error:', updateError);
      }
      
      throw error;
    }
  }

  private async processGroupedImagesBatched(images: any[], params: ExecutionParams): Promise<{ content: string; metadata: any }> {
    const { llmProvider, promptStrategy, projectData, options } = params;
    
    // Group images by their group
    const groupedImages = this.groupImages(images);
    const groupNames = Object.keys(groupedImages);
    
    console.log(`📦 Processing ${groupNames.length} groups: ${groupNames.join(', ')}`);

    // Process each group in batches
    const allGroupResults: string[] = [];
    const groupPromises: Promise<{ groupName: string; content: string }>[] = [];

    for (const groupName of groupNames) {
      const groupImages = groupedImages[groupName];
      
      // Process this group in batches
      const groupResult = this.processGroupInBatches(groupImages, groupName, params);
      groupPromises.push(groupResult);
      
      // Limit concurrent groups to MAX_PARALLEL_AGENTS
      if (groupPromises.length >= this.MAX_PARALLEL_AGENTS) {
        // Wait for each group individually and update after each one completes
        for (let j = 0; j < groupPromises.length; j++) {
          const completedResult = await groupPromises[j];
          allGroupResults.push(completedResult.content);
          
          // Update report content after each individual group completes
          const currentContent = allGroupResults.join('\n\n');
          await this.updateReportContent(currentContent, false);
        }
        
        groupPromises.length = 0; // Clear array
      }
    }

    // Wait for remaining groups
    if (groupPromises.length > 0) {
      // Wait for each remaining group individually and update after each one completes
      for (let j = 0; j < groupPromises.length; j++) {
        const completedResult = await groupPromises[j];
        allGroupResults.push(completedResult.content);
        
        // Update report content after each individual group completes
        const currentContent = allGroupResults.join('\n\n');
        await this.updateReportContent(currentContent, false);
      }
    }

    const content = allGroupResults.join('\n\n');

    // Update report with content from image processing (not final yet)
    await this.updateReportContent(content, false);

    return {
      content,
      metadata: {
        groupsProcessed: groupNames.length,
        totalImages: images.length,
        batchSize: this.BATCH_SIZE,
        maxParallelAgents: this.MAX_PARALLEL_AGENTS,
        executionType: 'batched-parallel-grouped'
      }
    };
  }

  private async processUngroupedImagesBatched(images: any[], params: ExecutionParams): Promise<{ content: string; metadata: any }> {
    const { llmProvider, promptStrategy, projectData, options } = params;
    
    console.log(`📦 Processing ${images.length} ungrouped images in batches of ${this.BATCH_SIZE}`);

    // Split images into batches
    const batches = this.chunkArray(images, this.BATCH_SIZE);
    const allBatchResults: string[] = [];
    const activePromises: Promise<string>[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Wait if we've reached the parallel limit
      if (activePromises.length >= this.MAX_PARALLEL_AGENTS) {
        console.log(`🔄 Waiting for ${activePromises.length} batches to complete before starting batch ${i + 1} (parallel limit: ${this.MAX_PARALLEL_AGENTS})`);
        
        // Wait for each batch individually and update after each one completes
        for (let j = 0; j < activePromises.length; j++) {
          const completedResult = await activePromises[j];
          allBatchResults.push(completedResult);
          
          // Update report content after each individual batch completes
          const currentContent = allBatchResults.join('\n\n');
          await this.updateReportContent(currentContent, false);
        }
        
        activePromises.length = 0; // Clear array
        console.log(`✅ Completed batch group, starting next set of ${this.MAX_PARALLEL_AGENTS} batches`);
      }
      
      // Start this batch (only after waiting if needed)
      console.log(`🚀 Starting batch ${i + 1}/${batches.length} (${activePromises.length + 1} active)`);
      const batchResult = this.processBatch(batch, i, batches.length, params);
      activePromises.push(batchResult);
    }

          // Wait for remaining batches
      if (activePromises.length > 0) {
        console.log(`🔄 Waiting for final ${activePromises.length} batches to complete`);
        
        // Wait for each remaining batch individually and update after each one completes
        for (let j = 0; j < activePromises.length; j++) {
          const completedResult = await activePromises[j];
          allBatchResults.push(completedResult);
          
          // Update report content after each individual batch completes
          const currentContent = allBatchResults.join('\n\n');
          await this.updateReportContent(currentContent, false);
        }
      }

    const content = allBatchResults.join('\n\n');

    // Update report with content from image processing (not final yet)
    await this.updateReportContent(content, false);

    return {
      content,
      metadata: {
        batchesProcessed: batches.length,
        totalImages: images.length,
        batchSize: this.BATCH_SIZE,
        maxParallelAgents: this.MAX_PARALLEL_AGENTS,
        executionType: 'batched-parallel-ungrouped'
      }
    };
  }

  private async processGroupInBatches(groupImages: any[], groupName: string, params: ExecutionParams): Promise<{ groupName: string; content: string }> {
    const { llmProvider, promptStrategy, projectData, options } = params;
    
    // Split group images into batches
    const batches = this.chunkArray(groupImages, this.BATCH_SIZE);
    const batchResults: string[] = [];
    const activePromises: Promise<string>[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Wait if we've reached the parallel limit
      if (activePromises.length >= this.MAX_PARALLEL_AGENTS) {
        console.log(`🔄 [GROUP: ${groupName}] Waiting for ${activePromises.length} batches to complete before starting batch ${i + 1} (parallel limit: ${this.MAX_PARALLEL_AGENTS})`);
        const completedResults = await Promise.all(activePromises);
        batchResults.push(...completedResults);
        activePromises.length = 0; // Clear array
        console.log(`✅ [GROUP: ${groupName}] Completed batch group, starting next set of ${this.MAX_PARALLEL_AGENTS} batches`);
      }
      
      // Start this batch (only after waiting if needed)
      console.log(`🚀 [GROUP: ${groupName}] Starting batch ${i + 1}/${batches.length} (${activePromises.length + 1} active)`);
      const batchResult = this.processBatch(batch, i, batches.length, params);
      activePromises.push(batchResult);
    }

    // Wait for remaining batches
    if (activePromises.length > 0) {
      console.log(`🔄 [GROUP: ${groupName}] Waiting for final ${activePromises.length} batches to complete`);
      const remainingResults = await Promise.all(activePromises);
      batchResults.push(...remainingResults);
    }

    const groupContent = batchResults.join('\n\n');
    return {
      groupName,
      content: promptStrategy.generateGroupHeader(groupName) + groupContent
    };
  }
// kinda like main function
  private async processBatch(batch: any[], batchIndex: number, totalBatches: number, params: ExecutionParams): Promise<string> {
    const { llmProvider, promptStrategy, projectData, options } = params;
    
    const batchStartTime = Date.now();
    console.log(`📦 [BATCH ${batchIndex + 1}] Starting batch ${batchIndex + 1}/${totalBatches} with ${batch.length} images (STREAMING ENABLED)`);

    // Get batch prompt from prompt strategy
    const promptStartTime = Date.now();
    const batchPrompt = await promptStrategy.generateBatchPrompt(batch, batchIndex, totalBatches, {
      grouping: params.grouping,
      projectId: params.projectId,
      supabase: params.supabase,
      projectData,
      options
    });
    const promptEndTime = Date.now();
    console.log(`📝 [BATCH ${batchIndex + 1}] Prompt generation took ${promptEndTime - promptStartTime}ms`);

    // Create the full prompt with system prompt
    const systemPrompt = promptStrategy.getImageSystemPrompt();
    const fullPrompt = `${systemPrompt}\n\n${batchPrompt}`;
    console.log(`📋 [BATCH ${batchIndex + 1}] Full prompt length: ${fullPrompt.length} characters`);

    // Process the batch
    const llmStartTime = Date.now();
    console.log(`🤖 [BATCH ${batchIndex + 1}] Starting LLM generation...`);
    const response = await llmProvider.generateContent(fullPrompt, {
      temperature: 0.7,
      maxTokens: 10000,
    });
    const llmEndTime = Date.now();
    console.log(`✅ [BATCH ${batchIndex + 1}] LLM generation took ${llmEndTime - llmStartTime}ms`);

    if (response.error) {
      console.error(`❌ [BATCH ${batchIndex + 1}] LLM error: ${response.error}`);
      return `[ERROR: Failed to process batch ${batchIndex + 1} - ${response.error}]`;
    }

    const batchEndTime = Date.now();
    console.log(`🎉 [BATCH ${batchIndex + 1}] Total batch processing time: ${batchEndTime - batchStartTime}ms`);
    console.log(`📄 [BATCH ${batchIndex + 1}] Response length: ${response.content.length} characters`);

    return response.content;
  }

  private groupImages(images: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    images.forEach(image => {
      const groupName = image.group?.[0] || 'UNGROUPED';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(image);
    });

    return groups;
  }

  private async updateReportContent(content: string, isComplete: boolean = false) {
    console.error(`[DEBUG] UPDATE REPORT: isComplete=${isComplete}, contentLength=${content.length}, reportId=${this.reportId}`);
    
    if (!this.supabase || !this.reportId) {
      console.error('[ERROR] UPDATE ERROR: Missing supabase or reportId');
      return;
    }
    
    try {
      let fullContent = content;
      
      if (isComplete) {
        // Remove any existing processing marker (handle various line break patterns)
        let cleanedContent = content;
        cleanedContent = cleanedContent.replace(/\n\n\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
        cleanedContent = cleanedContent.replace(/\n\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
        cleanedContent = cleanedContent.replace(/\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
        
        // Just use the cleaned content without adding a completion message
        fullContent = cleanedContent;
        console.error(`[DEBUG] UPDATE COMPLETE: Final content length: ${fullContent.length}`);
      } else {
        // Add processing marker for in-progress updates
        const status = '[PROCESSING IN PROGRESS...]';
        fullContent = `${content}\n\n${status}`;
      }
      
      console.error(`[DEBUG] UPDATE DB: Updating report ${this.reportId} with ${fullContent.length} characters`);
      
      const { error } = await this.supabase
        .from('reports')
        .update({ generated_content: fullContent })
        .eq('id', this.reportId);
        
      if (error) {
        console.error(`[ERROR] UPDATE DB ERROR: ${error.message}`);
      } else {
        console.error(`[DEBUG] UPDATE DB SUCCESS: Report updated`);
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


/*
1. execute(params) - Main Orchestrator
Purpose: Main entry point that coordinates the entire report generation process
What it does:
Routes to grouped vs ungrouped processing
Runs image analysis agents (parallel)
Runs summary agent (sequential)
Returns final formatted report
2. processGroupedImagesBatched(images, params) - Grouped Image Handler
Purpose: Handles images that are organized into groups (e.g., "Roofing", "Foundation")
What it does:
Groups images by their group name
Processes each group in parallel (max 3 groups at once)
Combines all group results
Returns raw observations from all groups
3. processUngroupedImagesBatched(images, params) - Ungrouped Image Handler
Purpose: Handles images that aren't organized into groups
What it does:
Splits all images into batches of 5
Processes batches in parallel (max 3 batches at once)
Combines all batch results
Returns raw observations from all images
4. processGroupInBatches(groupImages, groupName, params) - Group Batch Processor
Purpose: Processes a single group's images in batches
What it does:
Takes images from one group
Splits them into batches of 5
Processes each batch sequentially
Adds group header to results
5. processBatch(batch, batchIndex, totalBatches, params) - Individual Batch Processor
Purpose: Processes a single batch of 5 images with one LLM call
What it does:
Takes 5 images
Gets spec knowledge for each image
Creates prompt for all 5 images
Calls LLM once for the entire batch
Returns observations for all 5 images
6. groupImages(images) - Image Grouper
Purpose: Organizes images by their group names
What it does:
Creates a map of group names to image arrays
Handles images without groups (puts in "UNGROUPED")
7. chunkArray(array, size) - Array Splitter
Purpose: Splits arrays into smaller chunks
What it does:
Takes an array and chunk size
Returns array of smaller arrays
Used to split images into batches of 5
*/