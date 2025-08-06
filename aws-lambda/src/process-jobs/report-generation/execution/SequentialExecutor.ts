// Sequential Execution Strategy
import { ExecutionStrategy, ExecutionParams, ExecutionResult, GroupingMode } from '../types.ts';

export class SequentialExecutor implements ExecutionStrategy {
  async execute(params: ExecutionParams): Promise<ExecutionResult> {
    const { images, bulletPoints, projectData, llmProvider, promptStrategy, grouping, options } = params;
    
    console.log(`🔄 Sequential Executor: Processing ${images.length} images in ${grouping} mode (Note: Parallel is preferred for report writing)`);

    try {
      let content = '';
      const metadata: any = {};

      // STEP 1: Process images sequentially (fallback for very large datasets)
      if (grouping === 'grouped') {
        // Process grouped images sequentially
        const result = await this.processGroupedImagesSequentially(images, params);
        content = result.content;
        Object.assign(metadata, result.metadata);
      } else {
        // Process ungrouped images sequentially
        const result = await this.processUngroupedImagesSequentially(images, params);
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
          executionFlow: 'sequential_report_writing -> sequential_summary'
        }
      };

    } catch (error) {
      console.error('Sequential Executor Error:', error);
      throw error;
    }
  }

  private async processGroupedImagesSequentially(images: any[], params: ExecutionParams): Promise<{ content: string; metadata: any }> {
    const { llmProvider, promptStrategy, projectData, options } = params;
    
    // Group images by their group
    const groupedImages = this.groupImages(images);
    const groupNames = Object.keys(groupedImages);
    
    console.log(`📦 Processing ${groupNames.length} groups sequentially: ${groupNames.join(', ')}`);

    const groupContents: string[] = [];
    let totalImagesProcessed = 0;

    // Process each group sequentially
    for (const groupName of groupNames) {
      const groupImages = groupedImages[groupName];
      const groupImageContents: string[] = [];
      
      // Process images within the group sequentially
      for (const image of groupImages) {
        console.log(`🖼️ Processing image ${image.number} in group ${groupName}`);
        
        // Combine system prompt + task prompt for IMAGE ANALYSIS AGENT
        const systemPrompt = promptStrategy.getImageSystemPrompt();
        const taskPrompt = await promptStrategy.generateImagePrompt(image, {
          mode: params.mode, // Use actual mode from params
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
          groupImageContents.push(`[ERROR: Failed to process image ${image.number} - ${response.error}]`);
        } else {
          groupImageContents.push(response.content);
        }
        
        totalImagesProcessed++;
      }

      const groupContent = promptStrategy.generateGroupHeader(groupName) + groupImageContents.join('\n\n');
      groupContents.push(groupContent);
    }

    const content = groupContents.join('\n\n');

    return {
      content,
      metadata: {
        groupsProcessed: groupNames.length,
        totalImages: totalImagesProcessed,
        executionType: 'sequential-grouped'
      }
    };
  }

  private async processUngroupedImagesSequentially(images: any[], params: ExecutionParams): Promise<{ content: string; metadata: any }> {
    const { llmProvider, promptStrategy, projectData, options } = params;
    
    console.log(`📦 Processing ${images.length} ungrouped images sequentially`);

    const imageContents: string[] = [];

    // Process all images sequentially
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      console.log(`🖼️ Processing image ${i + 1}/${images.length}: ${image.number}`);
      
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
        imageContents.push(`[ERROR: Failed to process image ${image.number} - ${response.error}]`);
      } else {
        imageContents.push(response.content);
      }
    }

    const content = imageContents.join('\n\n');

    return {
      content,
      metadata: {
        imagesProcessed: images.length,
        executionType: 'sequential-ungrouped'
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