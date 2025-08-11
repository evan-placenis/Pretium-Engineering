// Batched Parallel Execution Strategy with Parallel Summary Processing
// STREAMING IS ALWAYS ENABLED for real-time progress updates
import { ExecutionStrategy, ExecutionParams, ExecutionResult, GroupingMode } from '../types.ts';

export class BatchedParallelWithParallelSummaryExecutor implements ExecutionStrategy {
  private readonly BATCH_SIZE = 5;
  private readonly MAX_PARALLEL_AGENTS = 3;
  private readonly SUMMARY_CHUNK_SIZE = 3000; // Increased chunk size to reduce processing overhead
  private readonly MAX_PARALLEL_SUMMARY_AGENTS = 3;
  private supabase: any = null;
  private reportId: string = '';

  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const { images, bulletPoints, projectData, llmProvider, promptStrategy, grouping, options } = params;
    
    // Store supabase and reportId for real-time updates
    this.supabase = params.supabase;
    this.reportId = params.reportId || '';
    
    console.log(`🔄 Batched Parallel with Parallel Summary Executor: Processing ${images.length} images in ${grouping} mode with max ${this.MAX_PARALLEL_AGENTS} agents`);

    try {
      let content = '';
      const metadata: any = {};

      // STEP 1: Process images in batches with limited parallel agents (same as original)
      if (grouping === 'grouped') {
        const result = await this.processGroupedImagesBatched(images, params);
        content = result.content;
        Object.assign(metadata, result.metadata);
      } else {
        const result = await this.processUngroupedImagesBatched(images, params);
        content = result.content;
        Object.assign(metadata, result.metadata);
      }

      // STEP 2: Generate final summary using parallel agents
      console.log('📝 Generating final summary using parallel agents (STREAMING ENABLED)...');
      
      // Update report to indicate summary has started
      await this.updateReportContent(content + '\n\n📝 PARALLEL SUMMARY PHASE: Starting final review and formatting...', false);
      
      const finalContent = await this.processSummaryInParallel(content, params);

       // Update report with final content (mark as complete)
       await this.updateReportContent(finalContent, true);

        return {
        content: finalContent,
        metadata: {
          ...metadata,
          finalSummaryGenerated: true,
          originalContentLength: content.length,
          finalContentLength: finalContent.length,
          executionFlow: 'batched_parallel_report_writing -> parallel_summary'
        }
      };

    } catch (error) {
      console.error('Batched Parallel with Parallel Summary Executor Error:', error);
      throw error;
    }
  }

  private async processSummaryInParallel(content: string, params: ExecutionParams): Promise<string> {
    const { llmProvider, promptStrategy, grouping, bulletPoints, projectData, options } = params;
    
    console.log(`📝 Starting parallel summary processing for ${content.length} characters`);
    
    // Split content into chunks for parallel processing
    const contentChunks = this.splitContentIntoChunks(content, grouping);
    console.log(`📝 Split content into ${contentChunks.length} chunks for parallel summary processing`);
    
    // Process chunks in parallel with limited concurrency
    const summaryResults: string[] = [];
    const activePromises: Promise<{ index: number; content: string }>[] = [];
    
         for (let i = 0; i < contentChunks.length; i++) {
       const chunk = contentChunks[i];
       
       // Wait if we've reached the parallel limit
       if (activePromises.length >= this.MAX_PARALLEL_SUMMARY_AGENTS) {
         console.log(`🔄 Waiting for ${activePromises.length} summary chunks to complete before starting chunk ${i + 1} (parallel limit: ${this.MAX_PARALLEL_SUMMARY_AGENTS})`);
         
         // Wait for each chunk individually and update after each one completes
         for (let j = 0; j < activePromises.length; j++) {
           const completedResult = await activePromises[j];
           summaryResults[completedResult.index] = completedResult.content;
           
           // Update report content after each individual chunk completes
           const orderedContent = this.combineSummaryResultsInOrder(summaryResults, params);
           await this.updateReportContent(orderedContent, false);
         }
         
         activePromises.length = 0; // Clear array
         console.log(`✅ Completed summary chunk group, starting next set of ${this.MAX_PARALLEL_SUMMARY_AGENTS} chunks`);
       }
       
       // Start this summary chunk (only after waiting if needed)
       console.log(`🚀 Starting summary chunk ${i + 1}/${contentChunks.length} (${activePromises.length + 1} active)`);
       const chunkResult = this.processSummaryChunk(chunk, i, contentChunks.length, params);
       activePromises.push(chunkResult);
     }

         // Wait for remaining summary chunks
     if (activePromises.length > 0) {
       console.log(`🔄 Waiting for final ${activePromises.length} summary chunks to complete`);
       
       // Wait for each remaining chunk individually and update after each one completes
       for (let j = 0; j < activePromises.length; j++) {
         const completedResult = await activePromises[j];
         summaryResults[completedResult.index] = completedResult.content;
         
         // Update report content after each individual chunk completes
         const orderedContent = this.combineSummaryResultsInOrder(summaryResults, params);
         await this.updateReportContent(orderedContent, false);
       }
     }

    // Combine all summary results in proper order
    const combinedSummary = this.combineSummaryResultsInOrder(summaryResults, params);
    console.log(`✅ Parallel summary processing completed (${combinedSummary.length} characters)`);
    
    // Final formatting pass to ensure consistency
    const finalFormattedContent = await this.finalFormattingPass(combinedSummary, params);
    
    return finalFormattedContent;
  }

  private async processSummaryChunk(chunk: string, chunkIndex: number, totalChunks: number, params: ExecutionParams): Promise<{ index: number; content: string }> {
    const { llmProvider, promptStrategy, grouping, bulletPoints, projectData, options } = params;
    
    const chunkStartTime = Date.now();
    console.log(`📝 [SUMMARY CHUNK ${chunkIndex + 1}] Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} chars)`);
    
    // Create a minimal summary prompt for this chunk
    const summarySystemPrompt = promptStrategy.getSummarySystemPrompt(grouping);

    const summaryTaskPrompt = promptStrategy.generateSummaryPrompt(chunk, {
      mode: params.mode,
      grouping,
      bulletPoints,
      projectData,
      options
    });
    
    const fullSummaryPrompt = `${summarySystemPrompt}\n\n${summaryTaskPrompt}`;
    console.log(`📝 [SUMMARY CHUNK ${chunkIndex + 1}] Summary prompt length: ${fullSummaryPrompt.length} characters`);
    
    // Process the summary chunk with increased maxTokens to prevent content truncation
    const summaryOptions: any = {
      temperature: 0.7,
      maxTokens: 6000  // Increased to prevent content truncation
    };
    
    // Add reasoning effort for GPT-5
    if (params.options?.reasoningEffort) {
      summaryOptions.reasoningEffort = params.options.reasoningEffort;
      summaryOptions.mode = params.mode;
      console.log(`🧠 [SUMMARY CHUNK ${chunkIndex + 1}] Using reasoning effort: ${params.options.reasoningEffort}`);
    }
    
    const response = await llmProvider.generateContent(fullSummaryPrompt, summaryOptions) as any;
    
    if (response.error) {
      console.error(`❌ [SUMMARY CHUNK ${chunkIndex + 1}] Summary error: ${response.error}`);
      return { index: chunkIndex, content: `[ERROR: Failed to process summary chunk ${chunkIndex + 1} - ${response.error}]` };
    }
    
    // Check if response is empty or invalid
    if (!response.content || response.content.trim().length === 0) {
      console.error(`❌ [SUMMARY CHUNK ${chunkIndex + 1}] Empty response received - using original chunk content`);
      return { index: chunkIndex, content: chunk }; // Return original chunk content instead of error
    }
    
    const chunkEndTime = Date.now();
    console.log(`✅ [SUMMARY CHUNK ${chunkIndex + 1}] Summary chunk processing time: ${chunkEndTime - chunkStartTime}ms`);
    console.log(`📄 [SUMMARY CHUNK ${chunkIndex + 1}] Response length: ${response.content.length} characters`);
    
    return { index: chunkIndex, content: response.content };
  }

  private async finalFormattingPass(content: string, params: ExecutionParams): Promise<string> {
    const { llmProvider, promptStrategy, grouping, bulletPoints } = params;
    
    console.log('🔧 Performing final formatting pass to ensure consistency...');
    
    const finalSystemPrompt = `You are a final editor ensuring consistency across multiple summary sections. Your job is to create a cohesive, well-formatted final report.`;
    
    const finalTaskPrompt = `
    Review and format this content to ensure:
    1. Consistent section numbering throughout
    2. Proper formatting and spacing
    3. Logical organization
    4. Follow user instructions: ${bulletPoints}
    
    Content to finalize:
    ${content}`;
    
    const fullFinalPrompt = `${finalSystemPrompt}\n\n${finalTaskPrompt}`;
    
         // Process final formatting with increased maxTokens to prevent content truncation
    const finalOptions: any = {
      temperature: 0.7,
      maxTokens: 8000  // Increased to prevent content truncation
    };
    
    // Add reasoning effort for GPT-5
    if (params.options?.reasoningEffort) {
      finalOptions.reasoningEffort = params.options.reasoningEffort;
      finalOptions.mode = params.mode;
      console.log(`🧠 Final formatting using reasoning effort: ${params.options.reasoningEffort}`);
    }
    
    const response = await llmProvider.generateContent(fullFinalPrompt, finalOptions) as any;
    
    if (response.error) {
      console.error(`❌ Final formatting error: ${response.error}`);
      return content; // Return original content if final formatting fails
    }
    
    console.log(`✅ Final formatting completed (${response.content.length} characters)`);
    return response.content;
  }

  private splitContentIntoChunks(content: string, grouping: GroupingMode): string[] {
    if (grouping === 'ungrouped') {
      return this.splitUngroupedContentIntoChunks(content);
    } else {
      return this.splitGroupedContentIntoChunks(content);
    }
  }

  private splitUngroupedContentIntoChunks(content: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      // If adding this line would exceed chunk size, start a new chunk
      if (currentChunk.length + line.length > this.SUMMARY_CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // Ensure we have at least one chunk
    if (chunks.length === 0) {
      chunks.push(content);
    }
    
    return chunks;
  }

  private splitGroupedContentIntoChunks(content: string): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    
    let currentGroup = '';
    let currentGroupContent = '';
    let currentChunk = '';
    
    for (const line of lines) {
      // Check if this line starts a new group (looks for patterns like "=== GROUP_NAME ===" or "1. GROUP_NAME")
      const isGroupHeader = this.isGroupHeader(line);
      
      if (isGroupHeader) {
        // If we have content from the previous group, process it
        if (currentGroupContent.trim()) {
          const groupChunks = this.splitGroupContentIntoChunks(currentGroupContent, currentGroup);
          chunks.push(...groupChunks);
        }
        
        // Start new group
        currentGroup = this.extractGroupName(line);
        currentGroupContent = line + '\n';
        currentChunk = line + '\n';
      } else {
        // Add line to current group content
        currentGroupContent += line + '\n';
        currentChunk += line + '\n';
        
        // If current chunk exceeds size limit, split it
        if (currentChunk.length > this.SUMMARY_CHUNK_SIZE && currentChunk.length > 0) {
          // Add group header to the chunk if it's not already there
          const chunkWithHeader = currentGroup ? `=== ${currentGroup} ===\n${currentChunk.trim()}` : currentChunk.trim();
          chunks.push(chunkWithHeader);
          currentChunk = '';
        }
      }
    }
    
    // Process the last group
    if (currentGroupContent.trim()) {
      const groupChunks = this.splitGroupContentIntoChunks(currentGroupContent, currentGroup);
      chunks.push(...groupChunks);
    }
    
    // Ensure we have at least one chunk
    if (chunks.length === 0) {
      chunks.push(content);
    }
    
    return chunks;
  }

  private splitGroupContentIntoChunks(groupContent: string, groupName: string): string[] {
    const chunks: string[] = [];
    
    // If group content is small enough, return it as one chunk
    if (groupContent.length <= this.SUMMARY_CHUNK_SIZE) {
      return [groupContent.trim()];
    }
    
    // Split large group content into multiple chunks
    const lines = groupContent.split('\n');
    let currentChunk = '';
    let isFirstChunk = true;
    
    for (const line of lines) {
      // If adding this line would exceed chunk size, start a new chunk
      if (currentChunk.length + line.length > this.SUMMARY_CHUNK_SIZE && currentChunk.length > 0) {
        // Add group header to the first chunk if it doesn't already have one
        const chunkWithHeader = isFirstChunk && !currentChunk.includes('===') ? 
          `=== ${groupName} ===\n${currentChunk.trim()}` : currentChunk.trim();
        chunks.push(chunkWithHeader);
        currentChunk = line;
        isFirstChunk = false;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      // Add group header to the last chunk if it doesn't already have one and it's the first chunk
      const chunkWithHeader = isFirstChunk && !currentChunk.includes('===') ? 
        `=== ${groupName} ===\n${currentChunk.trim()}` : currentChunk.trim();
      chunks.push(chunkWithHeader);
    }
    
    return chunks;
  }

  private isGroupHeader(line: string): boolean {
    // Check for various group header patterns
    return (
      line.includes('===') || // "=== GROUP_NAME ==="
      /^\d+\.\s+[A-Z\s]+$/.test(line.trim()) || // "1. GROUP_NAME"
      /^[A-Z\s]+$/.test(line.trim()) && line.length > 3 && line.length < 50 // "GROUP_NAME" in caps
    );
  }

  private extractGroupName(line: string): string {
    // Extract group name from various header formats
    if (line.includes('===')) {
      return line.replace(/===/g, '').trim();
    } else if (/^\d+\.\s+/.test(line)) {
      return line.replace(/^\d+\.\s+/, '').trim();
    } else {
      return line.trim();
    }
  }

  private combineSummaryResultsInOrder(summaryResults: string[], params: ExecutionParams): string {
    const { options } = params;
    const groupOrder = options?.groupOrder || [];
    
    if (!Array.isArray(groupOrder) || groupOrder.length === 0) {
      // If no group order specified, just combine results in order
      console.log(`📋 No group order specified, combining ${summaryResults.length} content chunks in sequence`);
      return summaryResults.filter(Boolean).join('\n\n');
    }
    
    // Validate that groupOrder has the expected structure
    if (!groupOrder.every(item => typeof item === 'object' && item !== null && 'groupName' in item && 'order' in item)) {
      console.warn(`⚠️ Invalid groupOrder structure, falling back to sequential combination`);
      return summaryResults.filter(Boolean).join('\n\n');
    }
    
    // Create a map to group content by group name
    const groupContentMap = new Map<string, string[]>();
    const ungroupedContent: string[] = [];
    
    // Process each summary result and organize by group
    summaryResults.forEach((content, index) => {
      if (!content) return;
      
      // Try to identify which group this content belongs to
      const groupName = this.identifyGroupFromContent(content, groupOrder as Array<{ groupName: string; order: number }>);
      
      if (groupName) {
        if (!groupContentMap.has(groupName)) {
          groupContentMap.set(groupName, []);
        }
        groupContentMap.get(groupName)!.push(content);
      } else {
        // If we can't identify the group, add to ungrouped content
        ungroupedContent.push(content);
      }
    });
    
    // Combine content in the specified group order
    const orderedContent: string[] = [];
    
    // Add content in group order
    (groupOrder as Array<{ groupName: string; order: number }>).forEach(({ groupName, order }) => {
      const groupContent = groupContentMap.get(groupName);
      if (groupContent && groupContent.length > 0) {
        orderedContent.push(...groupContent);
      }
    });
    
    // Add any ungrouped content at the end
    if (ungroupedContent.length > 0) {
      orderedContent.push(...ungroupedContent);
    }
    
    console.log(`📋 Combined ${orderedContent.length} content chunks in proper order`);
    return orderedContent.join('\n\n');
  }

  private identifyGroupFromContent(content: string, groupOrder: Array<{ groupName: string; order: number }>): string | null {
    // Look for group headers in the content
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Check if this line contains a group name
      for (const { groupName } of groupOrder) {
        if (line.toLowerCase().includes(groupName.toLowerCase()) || 
            line.includes('===') && line.toLowerCase().includes(groupName.toLowerCase())) {
          return groupName;
        }
      }
    }
    
    return null;
  }

  // All the original batch processing methods remain the same
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

    // Update report with final content
    await this.updateReportContent(content, true);

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

    // Update report with final content
    await this.updateReportContent(content, true);

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
    
    // Prepare LLM options with reasoning effort if available
    const llmOptions: any = {
      temperature: 0.7,
      maxTokens: 10000,
    };
    
    // Add reasoning effort for GPT-5
    if (params.options?.reasoningEffort) {
      llmOptions.reasoningEffort = params.options.reasoningEffort;
      llmOptions.mode = params.mode;
      console.log(`🧠 [BATCH ${batchIndex + 1}] Using reasoning effort: ${params.options.reasoningEffort}`);
    }
    
    const response = await llmProvider.generateContent(fullPrompt, llmOptions);
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
    if (!this.supabase || !this.reportId) return;
    
    try {
      let fullContent = content;
      
      if (isComplete) {
        // Remove any existing processing marker
        fullContent = content.replace(/\n\n\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
        fullContent = fullContent.replace(/\n\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
        fullContent = fullContent.replace(/\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
      } else {
        // Add processing marker for in-progress updates
        const status = '[PROCESSING IN PROGRESS...]';
        fullContent = `${content}\n\n${status}`;
      }
      
      await this.supabase
        .from('reports')
        .update({ generated_content: fullContent })
        .eq('id', this.reportId);
        
      console.log(`📝 Updated report content (${content.length} chars, ${isComplete ? 'final update' : 'in progress'})`);
    } catch (error) {
      console.error('Error updating report content:', error);
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