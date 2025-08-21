// GPT-5 LLM Provider with reasoning effort support
import { OpenAI } from 'openai';
import { LLMProvider, LLMResponse } from '../../types';

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
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: config.maxTokens, // Use correct parameter name
        reasoning_effort: options?.reasoningEffort || 'medium', // Add reasoning effort parameter
        response_format: { type: "json_object" }, // Force JSON output
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
          mode: options?.mode || 'brief',
          reasoningEffort: options?.reasoningEffort || 'medium',
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
          maxTokens: 1500   // Fewer tokens for faster processing
        };
      case 'medium':
        return {
          maxTokens: 2000   // Standard token limit
        };
      case 'high':
        return {
          maxTokens: 3000   // More tokens for comprehensive analysis
        };
      default:
        return {
          maxTokens: 2000
        };
    }
  }
}
