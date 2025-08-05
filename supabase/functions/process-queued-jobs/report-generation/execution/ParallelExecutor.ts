// Parallel Execution Strategy
import { ExecutionStrategy, ExecutionParams, ExecutionResult, GroupingMode } from '../types.ts';

export class ParallelExecutor implements ExecutionStrategy {
  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const { images, bulletPoints, projectData, llmProvider, promptStrategy, grouping, options } = params;
    
    console.log(`🔄 Parallel Executor: Processing ${images.length} images in ${grouping} mode`);

    try {
      let content = '';
      const metadata: any = {};

      // STEP 1: Process images in parallel (report writing)
      if (grouping === 'grouped') {
        // Process grouped images in parallel
        const result = await this.processGroupedImages(images, params);
        content = result.content;
        Object.assign(metadata, result.metadata);
      } else {
        // Process ungrouped images in parallel
        const result = await this.processUngroupedImages(images, params);
        content = result.content;
        Object.assign(metadata, result.metadata);
      }

      // STEP 2: Generate final summary sequentially (always sequential for summary)
      console.log('📝 Generating final summary sequentially...');
      
      // Combine system prompt + task prompt for SUMMARY AGENT
      const summarySystemPrompt = promptStrategy.getSummarySystemPrompt(grouping);
      const summaryTaskPrompt = promptStrategy.generateSummaryPrompt(content, {
        mode: params.mode, // Use actual mode from params
        grouping,
        bulletPoints,
        projectData,
        options
      });
      
      const fullSummaryPrompt = `${summarySystemPrompt}\n\n${summaryTaskPrompt}`;

      const summaryResponse = await llmProvider.generateContent(fullSummaryPrompt, {
        temperature: 0.7,
        maxTokens: 8000
      });

      if (summaryResponse.error) {
        throw new Error(`Summary generation failed: ${summaryResponse.error}`);
      }

      return {
        content: summaryResponse.content,
        metadata: {
          ...metadata,
          finalSummaryGenerated: true,
          originalContentLength: content.length,
          finalContentLength: summaryResponse.content.length,
          executionFlow: 'parallel_report_writing -> sequential_summary'
        }
      };

    } catch (error) {
      console.error('Parallel Executor Error:', error);
      throw error;
    }
  }

  private async processGroupedImages(images: any[], params: ExecutionParams): Promise<{ content: string; metadata: any }> {
    const { llmProvider, promptStrategy, projectData, options } = params;
    
    // Group images by their group
    const groupedImages = this.groupImages(images);
    const groupNames = Object.keys(groupedImages);
    
    console.log(`📦 Processing ${groupNames.length} groups: ${groupNames.join(', ')}`);

    // Process each group in parallel
    const groupPromises = groupNames.map(async (groupName) => {
      const groupImages = groupedImages[groupName];
      
             // Process images within the group in parallel
       const imagePromises = groupImages.map(async (image: any) => {
         // Combine system prompt + task prompt for IMAGE ANALYSIS AGENT
         const systemPrompt = promptStrategy.getImageSystemPrompt();
         const taskPrompt = await promptStrategy.generateImagePrompt(image, {
          mode: params.mode || 'brief', // Use actual mode from params
          grouping: 'grouped',
          projectData,
          projectId: params.projectId,
          supabase: params.supabase,
          options
        });
        
        const fullPrompt = `${systemPrompt}\n\n${taskPrompt}`;

        const response = await llmProvider.generateContent(fullPrompt, {
          temperature: 0.7,
          maxTokens: 2000
        });

        if (response.error) {
          return `[ERROR: Failed to process image ${image.number} - ${response.error}]`;
        }

        return response.content;
      });

      const imageResults = await Promise.all(imagePromises);
      const groupContent = imageResults.join('\n\n');
      
      return {
        groupName,
        content: promptStrategy.generateGroupHeader(groupName) + groupContent
      };
    });

    const groupResults = await Promise.all(groupPromises);
    const content = groupResults.map(result => result.content).join('\n\n');

    return {
      content,
      metadata: {
        groupsProcessed: groupNames.length,
        totalImages: images.length,
        executionType: 'parallel-grouped'
      }
    };
  }

  private async processUngroupedImages(images: any[], params: ExecutionParams): Promise<{ content: string; metadata: any }> {
    const { llmProvider, promptStrategy, projectData, options } = params;
    
    console.log(`📦 Processing ${images.length} ungrouped images in parallel`);

         // Process all images in parallel
     const imagePromises = images.map(async (image: any) => {
               // Combine system prompt + task prompt for IMAGE ANALYSIS AGENT
         const systemPrompt = promptStrategy.getImageSystemPrompt();
         const taskPrompt = await promptStrategy.generateImagePrompt(image, {
          mode: params.mode, // Use actual mode from params
          grouping: 'ungrouped',
          projectData,
          projectId: params.projectId,
          supabase: params.supabase,
          options
        });
        
        const fullPrompt = `${systemPrompt}\n\n${taskPrompt}`;

              const response = await llmProvider.generateContent(fullPrompt, {
          temperature: 0.7,
          maxTokens: 2000
        });

      if (response.error) {
        return `[ERROR: Failed to process image ${image.number} - ${response.error}]`;
      }

      return response.content;
    });

    const imageResults = await Promise.all(imagePromises);
    const content = imageResults.join('\n\n');

    return {
      content,
      metadata: {
        imagesProcessed: images.length,
        executionType: 'parallel-ungrouped'
      }
    };
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
} 