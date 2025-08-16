"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processGenerateReportWithNewGenerator = processGenerateReportWithNewGenerator;
/* eslint-disable @typescript-eslint/no-explicit-any */
// ReportGenerator Integration - Replace MCP with new decorator pattern
const ReportGenerator_1 = require("./report-generation/ReportGenerator");
async function processGenerateReportWithNewGenerator(supabase, job) {
    try {
        const { bulletPoints, projectId, contractName, location, reportId, imagesWithNumbering, groupOrder, selectedModel, isUngroupedMode, reportStyle, // 'brief' or 'elaborate' from user selection
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
        // The executor will handle all status updates from now on.
        const initialMessage = `Starting ${reportStyle} report generation with ${executionStrategy} execution using ${selectedModel}...`;
        await supabase.from('reports').update({ generated_content: initialMessage }).eq('id', reportId);
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
        const resizedImages = imagesWithNumbering.map((img) => ({
            id: img.id,
            url: img.url, // Use original URL (already resized on frontend)
            description: img.description || '',
            tag: img.tag || undefined,
            group: img.group || [],
            number: img.number
        }));
        // Determine the actual mode based on the image data, not the frontend parameter
        const hasGroups = resizedImages.some((img) => img.group && img.group.length > 0);
        const actualMode = hasGroups ? 'grouped' : 'ungrouped';
        // Initialize ReportGenerator
        console.log(`🔧 Initializing ReportGenerator...`);
        const generator = new ReportGenerator_1.ReportGenerator();
        console.log(`✅ ReportGenerator initialized successfully`);
        // Use the user's selected preferences directly
        const config = ReportGenerator_1.ReportGenerator.custom(reportStyle, // 'brief' or 'elaborate'
        selectedModel, // User's model choice
        executionStrategy, // User's execution strategy choice
        actualMode // Use actual mode determined from image data
        );
        console.log(`🔧 Using execution strategy: ${executionStrategy} for ${reportStyle} style`);
        console.log(`🎨 ReportGenerator Config:`, {
            mode: config.mode,
            model: config.model,
            execution: config.execution,
            grouping: config.grouping
        });
        // Generate report using the new system
        console.log(`🎯 Starting report generation with ReportGenerator...`);
        const result = await generator.generateReport({
            mode: config.mode || reportStyle,
            model: config.model || selectedModel,
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
                groupOrder,
                reasoningEffort: selectedModel === 'gpt5' ? job.input_data.reasoningEffort || 'medium' : undefined
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
        // Save the final, complete report to the database
        console.log('✅ Report generation complete, saving final result to database...');
        await supabase
            .from('reports')
            .update({
            sections_json: { sections: result.sections },
            generated_content: '✅ Report Generation Complete', // Final status update
        })
            .eq('id', reportId);
        console.log('✅ Final report saved successfully.');
        console.log(`✅ ReportGenerator ${reportStyle} report generation with ${executionStrategy} execution completed successfully`);
        return {
            success: true,
            message: `ReportGenerator ${reportStyle} report with ${executionStrategy} execution generated successfully using ${config.model}`,
            metadata: result.metadata
        };
    }
    catch (error) {
        console.error(`❌ ReportGenerator ${job.input_data.reportStyle} report generation with ${job.input_data.executionStrategy} execution failed:`, error);
        // Update report with error
        try {
            await supabase
                .from('reports')
                .update({
                generated_content: `❌ Error generating report: ${error.message}`
            })
                .eq('id', job.input_data.reportId);
        }
        catch (updateError) {
            console.error('Failed to update report with error:', updateError);
        }
        return {
            success: false,
            error: error.message
        };
    }
}
//# sourceMappingURL=report-job-handler.js.map