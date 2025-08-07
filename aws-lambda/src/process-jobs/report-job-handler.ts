/* eslint-disable @typescript-eslint/no-explicit-any */
// ReportGenerator Integration - Replace MCP with new decorator pattern
import { ReportGenerator } from './report-generation/ReportGenerator';

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
      reportStyle, // 'brief' or 'elaborate' from user selection
      executionStrategy // 'batched-parallel' or 'batched-parallel-with-parallel-summary' from user selection
    } = job.input_data;

    console.log(`🚀 ReportGenerator: Starting ${reportStyle} report generation with ${executionStrategy} execution...`);
    console.log(`📋 Job data:`, {
      reportId,
      projectId,
      selectedModel,
      reportStyle,
      executionStrategy,
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
    const displayStyle = reportStyle === 'brief' ? 'brief' : 'elaborate';
    const displayExecution = executionStrategy === 'batched-parallel-with-parallel-summary' ? 'parallel summary' : 'standard';
    await supabase
      .from('reports')
      .update({ 
        generated_content: `Starting ${displayStyle} report generation with ${displayExecution} execution using ${selectedModel}...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);

    // Update progress: Images resized
    await supabase
      .from('reports')
      .update({ 
        generated_content: `Starting ${displayStyle} report generation with ${displayExecution} execution using ${selectedModel}\n\n[PROCESSING IN PROGRESS...]`
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

    // Use original images - resizing will be done on frontend before upload
    const resizedImages = imagesWithNumbering.map((img: any) => ({
      id: img.id,
      url: img.url, // Use original URL (already resized on frontend)
      description: img.description || '',
      tag: img.tag || undefined,
      group: img.group || [],
      number: img.number
    }));

    // Determine the actual mode based on the image data, not the frontend parameter
    const hasGroups = resizedImages.some(img => img.group && img.group.length > 0);
    const actualMode = hasGroups ? 'grouped' : 'ungrouped';

    // Initialize ReportGenerator
    console.log(`🔧 Initializing ReportGenerator...`);
    const generator = new ReportGenerator();
    console.log(`✅ ReportGenerator initialized successfully`);

    // Use the user's selected preferences directly
    const config = ReportGenerator.custom(
      reportStyle,                              // 'brief' or 'elaborate'
      selectedModel as 'grok4' | 'gpt4o',       // User's model choice
      executionStrategy,                        // User's execution strategy choice
      actualMode                                // Use actual mode determined from image data
    );

    console.log(`🔧 Using execution strategy: ${executionStrategy} for ${reportStyle} style`);

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
        generated_content: `1. Starting ${reportStyle} report generation with ${executionStrategy} execution using ${selectedModel}\nProcessing ${resizedImages.length} images in ${actualMode} mode...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);

    // Generate report using the new system
    console.log(`🎯 Starting report generation with ReportGenerator...`);
    const result = await generator.generateReport({
      mode: config.mode || reportStyle,
      model: config.model || selectedModel as 'grok4' | 'gpt4o',
      execution: config.execution || executionStrategy,
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

    // The executor handles all content updates, so we don't need to update here
    // The final content is already in result.content and has been updated by the executor

    console.log(`✅ ReportGenerator ${reportStyle} report generation with ${executionStrategy} execution completed successfully`);
    return { 
      success: true, 
      message: `ReportGenerator ${reportStyle} report with ${executionStrategy} execution generated successfully using ${config.model}`,
      metadata: result.metadata
    };

  } catch (error: any) {
    console.error(`❌ ReportGenerator ${job.input_data.reportStyle} report generation with ${job.input_data.executionStrategy} execution failed:`, error);
    
    // Update report with error
    try {
      await supabase
        .from('reports')
        .update({ 
          generated_content: `Error generating ${job.input_data.reportStyle} report with ${job.input_data.executionStrategy} execution: ${error.message}\n\n[PROCESSING FAILED]`
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