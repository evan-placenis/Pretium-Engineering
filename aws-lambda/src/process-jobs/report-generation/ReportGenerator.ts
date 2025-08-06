// Report Generator - Flexible report generation with decorator pattern
import { ReportConfig, ReportResult, ExecutionStrategy, LLMProvider, ReportMode, GroupingMode, LLMModel, ExecutionType } from './types.ts';
import { ParallelExecutor } from './execution/ParallelExecutor.ts';
import { SequentialExecutor } from './execution/SequentialExecutor.ts';
import { BatchedParallelExecutor } from './execution/BatchedParallelExecutor.ts';
import { BatchedParallelWithParallelSummaryExecutor } from './execution/BatchedParallelWithParallelSummaryExecutor.ts';
import { Grok4Provider } from './llm/Grok4Provider.ts';
import { GPT4oProvider } from './llm/GPT4oProvider.ts';
import { BriefPromptStrategy } from './prompts/BriefPromptStrategy.ts';
import { ElaboratePromptStrategy } from './prompts/ElaboratePromptStrategy.ts';
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
  }

  private initializeStrategies(): void {
    this.executionStrategies = new Map();
    this.executionStrategies.set('parallel', new ParallelExecutor());
    this.executionStrategies.set('sequential', new SequentialExecutor());
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

  // Utility function for spec knowledge retrieval (moved from old system)
  static async getRelevantKnowledgeChunks(supabase: any, projectId: string, imageDescription: string, imageTag: string): Promise<string> {
    try {
      console.log('🔍 Searching for relevant knowledge:', { imageDescription, imageTag })
      
      // Create a search query based on the image description and tag
      const searchQuery = `${imageDescription} ${imageTag}`
      
      // Generate embedding for the query using OpenAI
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      })
      
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: searchQuery,
      })
      
      const queryEmbedding = embeddingResponse.data[0].embedding
      
      // Search in database using cosine similarity
      const { data, error } = await supabase.rpc('search_embeddings', {
        query_embedding: queryEmbedding,
        project_id: projectId,
        match_threshold: 0.5, // Moderate threshold for relevant specs
        match_count: 2 // Limit to 2 most relevant chunks
      })
      
      if (error) {
        console.error('Database search error:', error)
        return ''
      }
      
      const results = data || []
      console.log(`Found ${results.length} relevant knowledge chunks`)
      
      if (results.length === 0) {
        return '' // No relevant knowledge found
      }
      
      // Get additional metadata for results
      const enhancedResults = await Promise.all(
        results.map(async (result: any) => {
          try {
            // Get knowledge document info
            const { data: knowledgeData } = await supabase
              .from('project_knowledge')
              .select('file_name')
              .eq('id', result.knowledge_id)
              .single()
            
            return {
              content: result.content_chunk,
              similarity: result.similarity,
              fileName: knowledgeData?.file_name || 'Unknown file',
              documentSource: result.document_source || 'Unknown Document',
              sectionTitle: result.section_title || 'General Content'
            }
          } catch (error) {
            console.error('Error fetching knowledge metadata:', error)
            return {
              content: result.content_chunk,
              similarity: result.similarity,
              fileName: 'Unknown file',
              documentSource: result.document_source || 'Unknown Document',
              sectionTitle: result.section_title || 'General Content'
            }
          }
        })
      )
      
      // Format the relevant knowledge as context with enhanced citations
      const relevantKnowledge = enhancedResults.map((result: any, index: number) => {
        const similarity = (result.similarity * 100).toFixed(1)
        
        // Create a clean document name (remove file extension and clean up)
        const documentName = result.documentSource
          .replace(/\.[^/.]+$/, '') // Remove file extension
          .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
          .replace(/\b\w/g, (l: string) => l.toUpperCase()) // Title case
        
        // Create citation format that matches the prompt requirements
        const citation = `${documentName} - ${result.sectionTitle}`
        
        return `[Specification ${index + 1} - ${similarity}% relevant from ${citation}]:\n${result.content}`
      }).join('\n\n')
      
      console.log('📋 Relevant knowledge found and formatted')
      return `\n\nRELEVANT SPECIFICATIONS:\n${relevantKnowledge}\n\nIMPORTANT: When referencing these specifications in your observations, use the exact document name and section title provided in the citations above.`
      
    } catch (error) {
      console.error('Error getting relevant knowledge chunks:', error)
      return '' // Return empty string if search fails
    }
  }

} 