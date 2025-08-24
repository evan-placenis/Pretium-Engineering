export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          project_name: string
          date?: string
          created_at: string
          user_id: string
          [key: string]: any
        }
        Insert: {
          id?: string
          project_name: string
          date?: string
          created_at?: string
          user_id: string
          [key: string]: any
        }
        Update: {
          id?: string
          project_name?: string
          date?: string
          created_at?: string
          user_id?: string
          [key: string]: any
        }
      }
      reports: {
        Row: {
          id: string
          title?: string
          project_id: string
          bullet_points: string
          generated_content: string
          delivered_at?: string
          created_at: string
          updated_at: string
          user_id?: string
          sections_json?: Json
        }
        Insert: {
          id?: string
          title?: string
          project_id: string
          bullet_points: string
          generated_content: string
          delivered_at?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          title?: string
          project_id?: string
          bullet_points?: string
          generated_content?: string
          delivered_at?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      report_images: {
        Row: {
          id: string
          report_id: string
          url: string
          description: string
          tag: string
          user_id?: string
          group?: string[]
          number?: number
          rotation?: number
          signedUrl?: string
        }
        Insert: {
          id?: string
          report_id: string
          url: string
          description: string
          tag: string
          user_id?: string
          group?: string[]
          number?: number
          rotation?: number
          signedUrl?: string
        }
        Update: {
          id?: string
          report_id?: string
          url?: string
          description?: string
          tag?: string
          user_id?: string
          group?: string[]
          number?: number
          rotation?: number
          signedUrl?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type Project = Tables<'projects'>;
export type Report = Tables<'reports'>;
export type ReportImage = Tables<'report_images'>;

export interface ReportContext {
  mode: 'brief' | 'elaborate';
  model: 'grok4' | 'gpt4o' | 'gpt5';
  execution: 'parallel' | 'sequential' | 'batched-parallel' | 'batched-parallel-with-parallel-summary';
  grouping: 'grouped' | 'ungrouped';
  images: any[];
  bulletPoints: string;
  projectData?: any;
  projectId?: string;
  reportId?: string;
  supabase?: any;
  options?: {
    contractName?: string;
    location?: string;
    groupOrder?: string[];
    reasoningEffort?: 'low' | 'medium' | 'high';
  };
}

export interface ImageReference {
  id: string; // Changed from number to string to match report_images id
  url: string;
  caption: string;
  group?: string;
  number?: number;
}
  
export interface Section {
  id: string;
  level?: number;
  title?: string;
  content?: string;
  images?: ImageReference[];
  children?: Section[];
  number?: string; // Added optional number
  bodyMd?: string[]; // Added optional bodyMd
}

export type GroupingMode = 'grouped' | 'ungrouped';

export type ReportMode = 'brief' | 'elaborate';
export type LLMModel = 'grok4' | 'gpt4o' | 'gpt5';
export type ExecutionType = 'parallel' | 'sequential' | 'batched-parallel' | 'batched-parallel-with-parallel-summary';

export interface ReportConfig {
  mode: ReportMode;
  model: LLMModel;
  execution: ExecutionType;
  grouping: GroupingMode;
  images: any[];
  bulletPoints: string;
  projectData?: any;
  projectId?: string;
  reportId?: string;
  supabase?: any;
  options?: {
    contractName?: string;
    location?: string;
    groupOrder?: string[];
    reasoningEffort?: 'low' | 'medium' | 'high';
  };
}

export interface ReportResult {
  success: boolean;
  content: string;
  sections: Section[];
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
  generateContent(prompt: string | VisionContent, options?: any): Promise<LLMResponse>;
}

export interface LLMResponse {
  content: string;
  error?: string;
  metadata?: any;
}

export type VisionContent = {
  text: string;
  imageUrl?: string;
};

export interface ExecutionStrategy {
  execute(params: ExecutionParams): Promise<ExecutionResult>;
}

export interface ExecutionParams {
  images: any[];
  bulletPoints: string;
  projectData?: any;
  projectId?: string;
  reportId?: string;
  supabase?: any;
  llmProvider: LLMProvider;
  promptStrategy: PromptStrategy;
  grouping: GroupingMode;
  mode: ReportMode;
  options?: {
    contractName?: string;
    location?: string;
    groupOrder?: string[];
    reasoningEffort?: 'low' | 'medium' | 'high';
  };
}

export interface ExecutionResult {
  content: string;
  sections: Section[];
  metadata: any;
}


export interface PromptStrategy {
  getImageSystemPrompt(bulletPoints: string): string;
  getSummarySystemPrompt(grouping: GroupingMode): string;
  generateUserPrompt(observations: string[], specifications: string[], sections: Section[], grouping: GroupingMode, imageReferences?: ImageReference[]): string | VisionContent;
  generateSummaryPrompt(draft: string, context: any, sections: Section[]): string;
}
