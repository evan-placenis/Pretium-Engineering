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
    const displayMode = mode === 'parallel-summary' ? 'parallel summary' : mode;
    await supabase
      .from('reports')
      .update({ 
        generated_content: `Starting ${displayMode} report generation with ${selectedModel}...\n\n[PROCESSING IN PROGRESS...]`
      })
      .eq('id', reportId);

    // Update progress: Images resized
    await supabase
      .from('reports')
      .update({ 
        generated_content: `Starting ${displayMode} report generation with ${selectedModel}\n\n[PROCESSING IN PROGRESS...]`
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

    // Determine execution strategy based on user's mode selection WILL NEED TO CHANGE THIS LATER !! PARALLEL-SUMMARY IS A TEST FUNCTION
    let executionStrategy: 'batched-parallel' | 'batched-parallel-with-parallel-summary';
    let reportMode: 'brief' | 'elaborate';
    
    if (mode === 'parallel-summary') {
      executionStrategy = 'batched-parallel-with-parallel-summary';
      reportMode = 'brief'; // Use brief mode for the content generation part
    } else {
      executionStrategy = 'batched-parallel';
      reportMode = mode as 'brief' | 'elaborate';
    }

    // User has already selected their preferences - use them directly
    const config = ReportGenerator.custom(
      reportMode,                               // 'brief' or 'elaborate' (or 'brief' for parallel-summary)
      selectedModel as 'grok4' | 'gpt4o',       // User's model choice
      executionStrategy,                        // Use appropriate execution strategy
      actualMode                                // Use actual mode determined from image data
    );

    console.log(`🔧 Using execution strategy: ${executionStrategy} for ${mode} mode`);

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

    // The executor handles all content updates, so we don't need to update here
    // The final content is already in result.content and has been updated by the executor

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