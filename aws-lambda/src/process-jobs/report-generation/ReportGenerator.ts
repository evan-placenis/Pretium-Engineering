// Report Generator - Flexible report generation with decorator pattern
import { ReportConfig, ReportResult, ExecutionStrategy, LLMProvider, ReportMode, GroupingMode, LLMModel, ExecutionType } from '../types';

import { BatchedParallelExecutor } from './execution/BatchedParallelExecutor';
import { BatchedParallelWithParallelSummaryExecutor } from './execution/BatchedParallelWithParallelSummaryExecutor';
import { Grok4Provider } from './llm/Grok4Provider';
import { GPT4oProvider } from './llm/GPT4oProvider';
import { GPT5Provider } from './llm/GPT5Provider';
import { BriefPromptStrategy } from './prompts/BriefPromptStrategy';
import { ElaboratePromptStrategy } from './prompts/ElaboratePromptStrategy';
import { OpenAI } from 'openai'; //maybe turn in a dynamic import later once it is working
export class ReportGenerator {
  private llmProviders!: Map<string, LLMProvider>;
  private executionStrategies!: Map<string, ExecutionStrategy>;
  private promptStrategies!: Map<string, any>;

  constructor() {
    this.initializeProviders();
    this.initializeStrategies();
  }

  private initializeProviders(): void {
    this.llmProviders = new Map();
    this.llmProviders.set('grok4', new Grok4Provider());
    this.llmProviders.set('gpt4o', new GPT4oProvider());
    this.llmProviders.set('gpt5', new GPT5Provider());
  }

  private initializeStrategies(): void {
    this.executionStrategies = new Map();

    this.executionStrategies.set('batched-parallel', new BatchedParallelExecutor());
    this.executionStrategies.set('batched-parallel-with-parallel-summary', new BatchedParallelWithParallelSummaryExecutor());

    this.promptStrategies = new Map();
    this.promptStrategies.set('brief', new BriefPromptStrategy());
    this.promptStrategies.set('elaborate', new ElaboratePromptStrategy());
  }

  async generateReport(config: ReportConfig): Promise<ReportResult> {
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

    } catch (error) {
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

  private getLLMProvider(model: string): LLMProvider {
    const provider = this.llmProviders.get(model);
    if (!provider) {
      throw new Error(`LLM provider not found: ${model}`);
    }
    return provider;
  }

  private getExecutionStrategy(execution: string): ExecutionStrategy {
    const strategy = this.executionStrategies.get(execution);
    if (!strategy) {
      throw new Error(`Execution strategy not found: ${execution}`);
    }
    return strategy;
  }

  private getPromptStrategy(mode: string): any {
    const strategy = this.promptStrategies.get(mode);
    if (!strategy) {
      throw new Error(`Prompt strategy not found: ${mode}`);
    }
    return strategy;
  }


  static custom(mode: ReportMode, model: LLMModel, execution: ExecutionType = 'parallel', grouping: GroupingMode = 'ungrouped'): Partial<ReportConfig> {
    return { mode, model, execution, grouping };
  }
} 