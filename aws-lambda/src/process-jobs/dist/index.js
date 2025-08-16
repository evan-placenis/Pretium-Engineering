"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const report_job_handler_1 = require("./report-job-handler");
const handler = async (event) => {
    try {
        // Get environment variables
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase environment variables');
        }
        // Create Supabase client
        const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
        // Process each SQS message
        for (const record of event.Records) {
            await processSingleJob(record, supabase);
        }
    }
    catch (error) {
        console.error('Error in process-jobs function:', error);
        // Note: For SQS triggers, we don't return a value.
        // Errors will be handled by Lambda's retry policy.
        throw error;
    }
};
exports.handler = handler;
const processSingleJob = async (record, supabase) => {
    console.log('Processing SQS record:', record.body);
    try {
        // Get next job to process
        console.log('🔍 Looking for next job to process...');
        const { data: nextJobData, error: getJobError } = await supabase
            .rpc('get_next_job');
        if (getJobError) {
            throw new Error(`Error getting next job: ${getJobError.message}`);
        }
        console.log('📋 Next job data:', nextJobData);
        if (!nextJobData || nextJobData.length === 0) {
            console.log('ℹ️ No jobs to process');
            return;
        }
        console.log('✅ Found job to process:', nextJobData[0].id);
        // Get the full job details
        const { data: jobData, error: jobError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', nextJobData[0].id)
            .single();
        if (jobError) {
            throw new Error(`Error getting job details: ${jobError.message}`);
        }
        const job = jobData;
        // Mark job as processing
        console.log('🔄 Marking job as processing...');
        const { data: processingResult, error: processingError } = await supabase
            .rpc('mark_job_processing', { job_id: job.id });
        if (processingError) {
            console.error('❌ Error marking job as processing:', processingError);
            throw new Error(`Error marking job as processing: ${processingError.message}`);
        }
        console.log('📊 Processing result:', processingResult);
        if (!processingResult) {
            console.log('⚠️ Job already being processed by another worker');
            return;
        }
        console.log('✅ Job marked as processing successfully');
        // Process the job based on its type
        let result;
        let error = null;
        try {
            switch (job.job_type) {
                case 'generate_report':
                    result = await (0, report_job_handler_1.processGenerateReportWithNewGenerator)(supabase, job);
                    break;
                default:
                    error = `Unknown job type: ${job.job_type}`;
            }
        }
        catch (processError) {
            error = processError.message;
        }
        // Mark job as completed or failed
        if (error) {
            // Update the report content to show the error while preserving existing content
            try {
                // Get current content first
                const { data: currentReport } = await supabase
                    .from('reports')
                    .select('generated_content')
                    .eq('id', job.input_data.reportId)
                    .single();
                let currentContent = currentReport?.generated_content || '';
                // Remove processing marker if it exists
                currentContent = currentContent.replace(/\n\n\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
                currentContent = currentContent.replace(/\n\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
                currentContent = currentContent.replace(/\[PROCESSING IN PROGRESS\.\.\.\]/g, '');
                // Only append error message if there's existing content to preserve
                if (currentContent.trim().length > 0) {
                    const errorMessage = `\n\n❌ REPORT GENERATION FAILED\n\nError: ${error}\n\nYour content has been preserved. You can continue editing or try generating again.`;
                    const updatedContent = currentContent + errorMessage;
                    await supabase
                        .from('reports')
                        .update({ generated_content: updatedContent })
                        .eq('id', job.input_data.reportId);
                }
                else {
                    // If no existing content, just show the error
                    const errorMessage = `❌ REPORT GENERATION FAILED\n\nError: ${error}\n\nPlease try generating again.`;
                    await supabase
                        .from('reports')
                        .update({ generated_content: errorMessage })
                        .eq('id', job.input_data.reportId);
                }
            }
            catch (updateError) {
                console.error('Failed to update report with error:', updateError);
            }
            await supabase.rpc('mark_job_failed', {
                job_id: job.id,
                error_message: error
            });
        }
        else {
            await supabase.rpc('mark_job_completed', {
                job_id: job.id,
                output_data: result
            });
        }
    }
    catch (error) {
        console.error('Failed to process job:', error);
        // Let SQS handle the retry based on the visibility timeout
        throw error;
    }
};
//# sourceMappingURL=index.js.map