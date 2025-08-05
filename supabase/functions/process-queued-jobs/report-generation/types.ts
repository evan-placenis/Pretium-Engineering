// Report Generation Types
export type ReportMode = 'brief' | 'elaborate';
export type LLMModel = 'grok4' | 'gpt4o';
export type ExecutionType = 'parallel' | 'sequential' | 'batched-parallel' | 'batched-parallel-with-parallel-summary';
export type GroupingMode = 'grouped' | 'ungrouped';

export interface ReportConfig {
  mode: ReportMode;
  model: LLMModel;
  execution: ExecutionType;
  grouping: GroupingMode;
  images: any[];
  bulletPoints: string;
  projectData?: any;
  projectId?: string; // Add projectId for spec knowledge retrieval
  reportId?: string; // Add reportId for real-time updates
  supabase?: any; // Add supabase client for database access
  options?: {
    contractName?: string;
    location?: string;
    groupOrder?: string[];
  };
}

export interface ReportResult {
  success: boolean;
  content: string;
  error?: string;
  metadata: {
    model: string;
    mode: string;
    execution: string;
    grouping: string;
    processingTime: number;
    [key: string]: any;
  };
}

export interface LLMProvider {
  generateContent(prompt: string, options?: any): Promise<LLMResponse>;
}

export interface LLMResponse {
  content: string;
  error?: string;
  metadata?: any;
}

export interface ExecutionStrategy {
  execute(params: ExecutionParams): Promise<ExecutionResult>;
}

export interface ExecutionParams {
  images: any[];
  bulletPoints: string;
  projectData?: any;
  projectId?: string; // Add projectId for spec knowledge retrieval
  reportId?: string; // Add reportId for real-time updates
  supabase?: any; // Add supabase client for database access
  llmProvider: LLMProvider;
  promptStrategy: PromptStrategy;
  grouping: GroupingMode;
  mode: ReportMode; // Add mode to execution params
  options?: any;
}

export interface ExecutionResult {
  content: string;
  metadata: any;
}

export interface PromptStrategy {
  getImageSystemPrompt(): string; // Stage 1: Initial load/system prompt for IMAGE ANALYSIS AGENT
  getSummarySystemPrompt(grouping: GroupingMode): string; // Stage 1: Initial load/system prompt for SUMMARY AGENT
  generateImagePrompt(image: any, context: any): Promise<string>; // Stage 2: Runtime/task prompt for IMAGE ANALYSIS AGENT
  generateSummaryPrompt(draft: string, context: any): string; // Stage 2: Runtime/task prompt for SUMMARY AGENT
  generateBatchHeader(batchIndex: number, totalBatches: number): string;
  generateGroupHeader(groupName: string): string;
  generateBatchPrompt(batch: any[], batchIndex: number, totalBatches: number, context: any): Promise<string>; // Stage 2: Runtime/task prompt for BATCH PROCESSING
} 