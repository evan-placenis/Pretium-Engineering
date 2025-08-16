"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const BatchedParallelExecutor_1 = require("./execution/BatchedParallelExecutor");
const BatchedParallelWithParallelSummaryExecutor_1 = require("./execution/BatchedParallelWithParallelSummaryExecutor");
const Grok4Provider_1 = require("./llm/Grok4Provider");
const GPT4oProvider_1 = require("./llm/GPT4oProvider");
const GPT5Provider_1 = require("./llm/GPT5Provider");
const BriefPromptStrategy_1 = require("./prompts/BriefPromptStrategy");
const ElaboratePromptStrategy_1 = require("./prompts/ElaboratePromptStrategy");
class ReportGenerator {
    constructor() {
        this.initializeProviders();
        this.initializeStrategies();
    }
    initializeProviders() {
        this.llmProviders = new Map();
        this.llmProviders.set('grok4', new Grok4Provider_1.Grok4Provider());
        this.llmProviders.set('gpt4o', new GPT4oProvider_1.GPT4oProvider());
        this.llmProviders.set('gpt5', new GPT5Provider_1.GPT5Provider());
    }
    initializeStrategies() {
        this.executionStrategies = new Map();
        this.executionStrategies.set('batched-parallel', new BatchedParallelExecutor_1.BatchedParallelExecutor());
        this.executionStrategies.set('batched-parallel-with-parallel-summary', new BatchedParallelWithParallelSummaryExecutor_1.BatchedParallelWithParallelSummaryExecutor());
        this.promptStrategies = new Map();
        this.promptStrategies.set('brief', new BriefPromptStrategy_1.BriefPromptStrategy());
        this.promptStrategies.set('elaborate', new ElaboratePromptStrategy_1.ElaboratePromptStrategy());
    }
    async generateReport(config) {
        const startTime = Date.now();
        try {
            console.log(`🚀 Report Generator: Starting ${config.mode} report with ${config.model}`);
            // Get the configured components
            const llmProvider = this.getLLMProvider(config.model);
            const executionStrategy = this.getExecutionStrategy(config.execution);
            const promptStrategy = this.getPromptStrategy(config.mode);
            // Execute the report generation
            const result = await executionStrategy.execute({
                images: config.images,
                bulletPoints: config.bulletPoints,
                projectData: config.projectData,
                projectId: config.projectId, // Pass projectId for spec knowledge
                reportId: config.reportId, // Pass reportId for real-time updates
                supabase: config.supabase, // Pass supabase client for database access
                llmProvider,
                promptStrategy,
                grouping: config.grouping,
                mode: config.mode, // Pass the mode to execution strategy
                options: config.options
            });
            const processingTime = Date.now() - startTime;
            return {
                success: true,
                content: result.content,
                sections: result.sections,
                metadata: {
                    model: config.model,
                    mode: config.mode,
                    execution: config.execution,
                    processingTime,
                    ...result.metadata
                }
            };
        }
        catch (error) {
            console.error('Report Generator Error:', error);
            return {
                success: false,
                content: '',
                sections: [],
                error: error instanceof Error ? error.message : 'Unknown error',
                metadata: {
                    model: config.model,
                    mode: config.mode,
                    execution: config.execution,
                    grouping: config.grouping,
                    processingTime: Date.now() - startTime
                }
            };
        }
    }
    getLLMProvider(model) {
        const provider = this.llmProviders.get(model);
        if (!provider) {
            throw new Error(`LLM provider not found: ${model}`);
        }
        return provider;
    }
    getExecutionStrategy(execution) {
        const strategy = this.executionStrategies.get(execution);
        if (!strategy) {
            throw new Error(`Execution strategy not found: ${execution}`);
        }
        return strategy;
    }
    getPromptStrategy(mode) {
        const strategy = this.promptStrategies.get(mode);
        if (!strategy) {
            throw new Error(`Prompt strategy not found: ${mode}`);
        }
        return strategy;
    }
    static custom(mode, model, execution = 'parallel', grouping = 'ungrouped') {
        return { mode, model, execution, grouping };
    }
}
exports.ReportGenerator = ReportGenerator;
//# sourceMappingURL=ReportGenerator.js.map