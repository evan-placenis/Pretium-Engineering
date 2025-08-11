// GPT-5 LLM Provider with reasoning effort support
import { LLMProvider, LLMResponse } from '../types.ts';
import { OpenAI } from 'openai';

export interface GPT5Options {
  reasoningEffort?: 'low' | 'medium' | 'high';
  temperature?: number;
  maxTokens?: number;
  mode?: string;
}

export class GPT5Provider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ OPENAI_API_KEY not found in environment variables');
    }
  }

  async generateContent(prompt: string, options?: GPT5Options): Promise<LLMResponse> {
    try {
      console.log(`🤖 GPT-5: Starting content generation (prompt: ${prompt.length} chars)`);
      console.log(`🔧 GPT-5 Options:`, {
        reasoningEffort: options?.reasoningEffort || 'medium',
        temperature: options?.temperature || 0.7,
        maxTokens: options?.maxTokens || 3000,
        mode: options?.mode || 'brief'
      });

      const startTime = Date.now();
      const apiCallStartTime = Date.now();

      // Static import for OpenAI
      const openai = new OpenAI({ apiKey: this.apiKey });

      // Configure parameters based on reasoning effort
      const config = this.getConfigurationForReasoningEffort(options?.reasoningEffort || 'medium');

      console.log(`🤖 GPT-5: Making API call...`);
      const response = await openai.chat.completions.create({
        model: 'gpt-5', // Use GPT-5 as the model name
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(options?.mode || 'brief', options?.reasoningEffort || 'medium')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true // Enable streaming
      });

      const apiCallEndTime = Date.now();
      console.log(`🤖 GPT-5: API call initiated in ${apiCallEndTime - apiCallStartTime}ms`);

      // Handle streaming response
      let content = '';
      let chunkCount = 0;
      const streamingStartTime = Date.now();
      
      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          chunkCount++;
          // Log streaming progress for debugging
          if (chunkCount % 10 === 0) { // Log every 10 chunks to avoid spam
            console.log(`🤖 GPT-5 Streaming: ${content.length} characters received (${chunkCount} chunks processed)`);
          }
        }
      }

      const streamingEndTime = Date.now();
      const totalTime = Date.now() - startTime;
      
      console.log(`🤖 GPT-5: Streaming completed in ${streamingEndTime - streamingStartTime}ms (${chunkCount} chunks processed, ${content.length} chars generated)`);
      console.log(`🤖 GPT-5: Total generation time: ${totalTime}ms`);

      return {
        content,
        metadata: {
          model: 'gpt-5',
          reasoningEffort: options?.reasoningEffort || 'medium',
          mode: options?.mode || 'brief',
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          streaming: true,
          processingTime: totalTime,
          chunkCount,
          contentLength: content.length
        }
      };

    } catch (error) {

      console.error(`❌ GPT-5 API Error `, error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown GPT-5 API error'
      };
    }
  }

  private getConfigurationForReasoningEffort(reasoningEffort: 'low' | 'medium' | 'high') {
    switch (reasoningEffort) {
      case 'low':
        return {
          temperature: 0.3, // Lower temperature for more focused, consistent output
          maxTokens: 1500,  // Fewer tokens for faster processing
          systemPrompt: 'low'
        };
      case 'medium':
        return {
          temperature: 0.7, // Balanced temperature for good creativity and consistency
          maxTokens: 2000,  // Standard token limit
          systemPrompt: 'medium'
        };
      case 'high':
        return {
          temperature: 0.9, // Higher temperature for more creative, thorough analysis
          maxTokens: 3000,  // More tokens for comprehensive analysis
          systemPrompt: 'high'
        };
      default:
        return {
          temperature: 0.7,
          maxTokens: 2000,
          systemPrompt: 'medium'
        };
    }
  }

  private getSystemPrompt(mode: string, reasoningEffort: string): string {
    const basePrompt = 'You are a professional engineering inspector with expertise in building assessment and technical documentation.';
    
    const reasoningInstructions = {
      low: 'Provide clear, concise observations with basic analysis. Focus on speed and efficiency.',
      medium: 'Provide balanced analysis with moderate detail. Balance thoroughness with processing speed.',
      high: 'Provide comprehensive, detailed analysis with deep technical insights. Take time to thoroughly examine all aspects.'
    };

    const modeInstructions = {
      brief: 'Generate concise, focused reports with key findings and essential details.',
      elaborate: 'Generate comprehensive, detailed reports with thorough analysis and extensive documentation.'
    };

    return `${basePrompt} ${reasoningInstructions[reasoningEffort as keyof typeof reasoningInstructions] || reasoningInstructions.medium} ${modeInstructions[mode as keyof typeof modeInstructions] || modeInstructions.brief}`;
  }
}
