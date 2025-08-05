/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-ignore - Deno environment
// ReportGenerator Integration - Replace MCP with new decorator pattern
import { ReportGenerator } from './report-generation/ReportGenerator.ts';

export async function processGenerateReportWithNewGenerator(supabase: any, job: any): Promise<any> {
  try {
    const { 
      bulletPoints, 
      projectId, 
      contractName, 
      location, 
      reportId, 
      imagesWithNumbering, 
      groupOrder, 
      selectedModel, 
      isUngroupedMode,
      mode // 'brief' or 'elaborate' from user selection
    } = job.input_data;

    console.log(`🚀 ReportGenerator: Starting ${mode} report generation...`);
    console.log(`📋 Job data:`, {
      reportId,
      projectId,
      selectedModel,
      mode,
      isUngroupedMode,
      imageCount: imagesWithNumbering?.length || 0
    });

    // Verify report exists
    const { data: reportData, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !reportData) {
      throw new Error(`Report not found: ${reportId}`);
    }

    // Update initial processing status
    await supabase
      .from('reports')
      .update({ 
        generated_content: `Starting ${mode} report generation with ${selectedModel}...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);

    // Update progress: Images resized
    await supabase
      .from('reports')
      .update({ 
        generated_content: `Starting ${mode} report generation with ${selectedModel}\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);

    // Get project data
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.warn('Could not fetch project data:', projectError.message);
    }

    // Resize images for AI processing
    const resizedImages = await Promise.all(
      imagesWithNumbering.map(async (img: any) => {
        const resizedUrl = await resizeImageForAI(img.url);
        return {
          id: img.id,
          url: resizedUrl,
          description: img.description || '',
          tag: img.tag || undefined,
          group: img.group || [],
          number: img.number
        };
      })
    );

    // Determine the actual mode based on the image data, not the frontend parameter
    const hasGroups = resizedImages.some(img => img.group && img.group.length > 0);
    const actualMode = hasGroups ? 'grouped' : 'ungrouped';

    // Initialize ReportGenerator
    console.log(`🔧 Initializing ReportGenerator...`);
    const generator = new ReportGenerator();
    console.log(`✅ ReportGenerator initialized successfully`);

    // User has already selected their preferences - use them directly
    const config = ReportGenerator.custom(
      mode,                                     // 'brief' or 'elaborate' from job input
      selectedModel as 'grok4' | 'gpt4o',       // User's model choice
      'batched-parallel',                       // Use batched parallel execution with max 3 agents
      actualMode                                // Use actual mode determined from image data
    );

    console.log(`🎨 ReportGenerator Config:`, {
      mode: config.mode,
      model: config.model,
      execution: config.execution,
      grouping: config.grouping
    });

    // Update progress: Starting report generation
    await supabase
      .from('reports')
      .update({ 
        generated_content: `1. Starting ${mode} report generation with ${selectedModel}\nProcessing ${resizedImages.length} images in ${actualMode} mode...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);

    // Generate report using the new system
    console.log(`🎯 Starting report generation with ReportGenerator...`);
               const result = await generator.generateReport({
             mode: config.mode || mode,
             model: config.model || selectedModel as 'grok4' | 'gpt4o',
             execution: config.execution || 'parallel',
             grouping: config.grouping || (isUngroupedMode ? 'ungrouped' : 'grouped'),
             images: resizedImages,
             bulletPoints,
             projectId, // Pass projectId for spec knowledge retrieval
             reportId, // Pass reportId for real-time updates
             supabase, // Pass supabase client for database access
             projectData: projectData ? {
               id: projectData.id,
               name: projectData.name,
               location: projectData.address || location
             } : undefined,
             options: {
               contractName,
               location,
               groupOrder
             }
           });

    console.log(`📊 Report generation result:`, {
      success: result.success,
      contentLength: result.content?.length || 0,
      error: result.error || null
    });

    if (!result.success) {
      throw new Error(`ReportGenerator failed: ${result.error}`);
    }

    // Update progress: Finalizing report
    await supabase
      .from('reports')
      .update({ 
        generated_content: `1. Starting ${mode} report generation with ${selectedModel}\nProcessing ${resizedImages.length} images in ${actualMode} mode...\nStarting final review and formatting...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);

    // Update the database with the generated content
    const { error: updateError } = await supabase
      .from('reports')
      .update({ 
        generated_content: result.content
      })
      .eq('id', reportId);

    if (updateError) {
      console.error('Error updating database with ReportGenerator content:', updateError);
      throw new Error(`Failed to save report: ${updateError.message}`);
    }

    console.log(`✅ ReportGenerator ${job.input_data.mode} report generation completed successfully`);
    return { 
      success: true, 
      message: `ReportGenerator ${job.input_data.mode} report generated successfully using ${config.model}`,
      metadata: result.metadata
    };

  } catch (error: any) {
    console.error(`❌ ReportGenerator ${job.input_data.mode} report generation failed:`, error);
    
    // Update report with error
    try {
      await supabase
        .from('reports')
        .update({ 
          generated_content: `Error generating ${job.input_data.mode} report: ${error.message}\n\n[PROCESSING FAILED]`
        })
        .eq('id', job.input_data.reportId);
    } catch (updateError) {
      console.error('Failed to update report with error:', updateError);
    }

    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Helper function for image resizing (Deno-compatible)
async function resizeImageForAI(imageUrl: string, maxWidth: number = 1024, maxHeight: number = 1024, quality: number = 0.8): Promise<string> {
  try {
    console.log(`🖼️ Resizing image: ${imageUrl}`);
    
    // Fetch the original image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Create a blob from the image data
    const blob = new Blob([uint8Array]);
    const imageBitmap = await createImageBitmap(blob);
    
    // Calculate new dimensions while maintaining aspect ratio
    const { width: originalWidth, height: originalHeight } = imageBitmap;
    let { width: newWidth, height: newHeight } = imageBitmap;
    
    if (originalWidth > maxWidth || originalHeight > maxHeight) {
      const aspectRatio = originalWidth / originalHeight;
      
      if (originalWidth > originalHeight) {
        newWidth = maxWidth;
        newHeight = maxWidth / aspectRatio;
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = maxHeight * aspectRatio;
        }
      } else {
        newHeight = maxHeight;
        newWidth = maxHeight * aspectRatio;
        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = maxWidth / aspectRatio;
        }
      }
    }
    
    // Create canvas for resizing
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Draw the resized image
    ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
    
    // Convert to blob with specified quality
    const resizedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: quality
    });
    
    // Convert blob to base64
    const arrayBuffer2 = await resizedBlob.arrayBuffer();
    const uint8Array2 = new Uint8Array(arrayBuffer2);
    const base64String = btoa(Array.from(uint8Array2, byte => String.fromCharCode(byte)).join(''));
    
    console.log(`✅ Image resized from ${originalWidth}x${originalHeight} to ${newWidth}x${newHeight}`);
    return `data:image/jpeg;base64,${base64String}`;
    
  } catch (error) {
    console.error('Error resizing image:', error);
    console.log(`⚠️ Falling back to original URL due to resize error`);
    return imageUrl;
  }
} 