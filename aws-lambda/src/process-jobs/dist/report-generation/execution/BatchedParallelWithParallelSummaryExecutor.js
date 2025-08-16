"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchedParallelWithParallelSummaryExecutor = void 0;
// Batched Parallel Execution Strategy with Max 3 Agents
// STREAMING IS ALWAYS ENABLED for real-time progress updates
const uuid_1 = require("uuid");
const SectionModel_1 = require("./SectionModel");
class BatchedParallelWithParallelSummaryExecutor {
    constructor() {
        this.BATCH_SIZE = 5;
        this.MAX_PARALLEL_AGENTS = 3;
        this.supabase = null;
        this.reportId = '';
    }
    async execute(params) {
        const { images, bulletPoints, projectData, llmProvider, promptStrategy, grouping, options } = params;
        // Store supabase and reportId for real-time updates
        this.supabase = params.supabase;
        this.reportId = params.reportId || ''; // Use the correct reportId
        console.log(`🔄 Batched Parallel Executor: Processing ${images.length} images in ${grouping} mode with max ${this.MAX_PARALLEL_AGENTS} agents`);
        try {
            const batches = this.chunkArray(images, this.BATCH_SIZE);
            const allSections = [];
            const metadata = {};
            await this.updateReportContent({
                type: 'status',
                message: `🤖 IMAGE AGENT: Analyzing ${images.length} observations in ${batches.length} batches...`,
            });
            const activePromises = []; //parallelism
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const promise = this.processBatch(batch, params).then(batchSections => {
                    // Synchronize access to allSections
                    synchronized(() => {
                        allSections.push(...batchSections);
                        const streamingPayload = this.prepareStreamingPayload(allSections);
                        this.updateReportContent({
                            type: 'intermediateResult',
                            message: `IMAGE AGENT: Analyzed ${allSections.length} of ${images.length} observations...`,
                            payload: streamingPayload,
                        });
                    });
                });
                activePromises.push(promise);
                if (activePromises.length >= this.MAX_PARALLEL_AGENTS || i === batches.length - 1) {
                    await Promise.all(activePromises);
                    activePromises.length = 0; // Clear the array for the next set of promises
                }
            }
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
            const summaryOptions = {
                temperature: 0.7,
                maxTokens: 12000 // Increased to prevent content truncation
            };
            // Add reasoning effort for GPT-5
            if (params.options?.reasoningEffort) {
                summaryOptions.reasoningEffort = params.options.reasoningEffort;
                summaryOptions.mode = params.mode;
                console.log(`🧠 Summary generation using reasoning effort: ${params.options.reasoningEffort}`);
            }
            const summaryPromise = llmProvider.generateContent(fullSummaryPrompt, summaryOptions);
            // Set a timeout of 180 seconds for summary generation (increased due to larger content from embeddings)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Summary generation timed out after 6 minutes')), 360000);
            });
            const summaryResponse = await Promise.race([summaryPromise, timeoutPromise]);
            if (summaryResponse.error) {
                console.error(`[ERROR] SUMMARY ERROR: ${summaryResponse.error}`);
                throw new Error(`Summary generation failed: ${summaryResponse.error}`);
            }
            let summaryContent = summaryResponse.content || '';
            let finalSections = [];
            try {
                const parsedJson = JSON.parse(summaryContent);
                if (parsedJson.sections) {
                    const model = SectionModel_1.SectionModel.fromJSON(parsedJson);
                    finalSections = model.getState().sections;
                    summaryContent = JSON.stringify(model.toJSON());
                    console.log('Parsed and auto-numbered JSON sections for summary');
                }
                else {
                    console.warn("Summary JSON is missing 'sections' property.");
                    finalSections = allSections; // Fallback to initial sections
                }
            }
            catch (e) {
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
        }
        catch (error) {
            console.error('❌ Batched Parallel Executor Error:', error);
            // Try to update the report with error information while preserving existing content
            try {
                if (this.supabase && this.reportId) {
                    const errorMessage = `❌ REPORT GENERATION FAILED\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nPlease try generating again.`;
                    await this.updateReportContent({ type: 'status', message: errorMessage });
                    console.log('📝 Updated report with error message');
                }
            }
            catch (updateError) {
                console.error('❌ Failed to update report with error:', updateError);
            }
            throw error;
        }
    }
    prepareStreamingPayload(sections) {
        return sections.map(sec => {
            // Deep copy to avoid modifying the original allSections array
            const newSec = JSON.parse(JSON.stringify(sec));
            // If the title exists and the body is empty, move the title to the body.
            // This prevents duplicating text if the AI puts the same content in both.
            if (newSec.title && (!newSec.bodyMd || newSec.bodyMd.length === 0)) {
                newSec.bodyMd = [newSec.title];
            }
            // Always clear the title for streaming purposes so it doesn't render as a header.
            newSec.title = '';
            return newSec;
        });
    }
    createGroupedHierarchy(sections) {
        const groupMap = new Map();
        // Step 1: Group sections by title
        sections.forEach(section => {
            const title = (section.title || 'Untitled').trim();
            if (!groupMap.has(title)) {
                groupMap.set(title, []);
            }
            groupMap.get(title).push(section);
        });
        // Step 2: Create a new parent section for each group
        const parentSections = [];
        for (const [title, children] of groupMap.entries()) {
            // Create a new parent section
            const parentSection = {
                id: (0, uuid_1.v4)(),
                title: title,
                number: '', // Will be populated by autoNumberSections
                bodyMd: [],
                images: [],
                children: children.map(child => ({
                    ...child,
                    title: '', // Use the body for the sub-title
                    children: [], // Ensure no deep nesting
                })),
            };
            parentSections.push(parentSection);
        }
        // Step 3: Renumber the final hierarchical structure
        const model = new SectionModel_1.SectionModel(parentSections);
        model.autoNumberSections();
        return model.getState().sections;
    }
    async processBatch(batch, params) {
        const { llmProvider, promptStrategy, projectData, grouping } = params;
        const observations = batch.map(img => {
            const imageTag = `[IMAGE:${img.number}:${img.group?.[0] || ''}]`;
            const description = img.description || '';
            const sectionTitle = img.group?.[0] ? `Section Title: ${img.group[0]}` : 'N/A choose section title}';
            return `${sectionTitle} ${description} ${imageTag}`.trim();
        });
        const specifications = projectData?.specifications || [];
        const imageAgentSystemPrompt = promptStrategy.getImageSystemPrompt();
        const imageAgentUserPrompt = promptStrategy.generateUserPrompt(observations, specifications, [], grouping);
        const fullImageAgentPrompt = `${imageAgentSystemPrompt}\n\n${imageAgentUserPrompt}`;
        const imageAgentResponse = await llmProvider.generateContent(fullImageAgentPrompt, {
            temperature: 0.7,
            maxTokens: 12000
        });
        if (imageAgentResponse.error) {
            console.error(`Image agent failed for a batch: ${imageAgentResponse.error}`);
            return []; // Return empty array for the failed batch
        }
        try {
            const parsed = JSON.parse(imageAgentResponse.content);
            if (parsed.sections && Array.isArray(parsed.sections)) {
                return parsed.sections;
            }
            console.error("No 'sections' property found in image agent response for a batch.");
            return [];
        }
        catch (e) {
            console.error(`Failed to parse image agent response for a batch: ${e.message}.`);
            return [];
        }
    }
    async updateReportContent(log) {
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
        }
        catch (error) {
            console.error('[ERROR] UPDATE EXCEPTION:', error);
        }
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}
exports.BatchedParallelWithParallelSummaryExecutor = BatchedParallelWithParallelSummaryExecutor;
// Simple synchronization utility
let lock = Promise.resolve();
function synchronized(fn) {
    return new Promise((resolve, reject) => {
        lock = lock.then(() => Promise.resolve(fn()).then(() => resolve(), reject), reject);
    });
}
//# sourceMappingURL=BatchedParallelWithParallelSummaryExecutor.js.map