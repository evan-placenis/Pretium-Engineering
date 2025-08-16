// GPT-4o LLM Provider
import { OpenAI } from 'openai';
import { LLMProvider, LLMResponse } from '../../types';

export class GPT4oProvider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ OPENAI_API_KEY not found in environment variables');
    }
  }

  async generateContent(prompt: string, options?: any): Promise<LLMResponse> {
    try {
      console.log('🤖 GPT-4o: Generating content...');

      // Static import for OpenAI
      const openai = new OpenAI({ apiKey: this.apiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional engineering inspector. Provide clear, accurate technical observations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2000,
        stream: true // Enable streaming
      });

      // Handle streaming response
      let content = '';
      let usage: any = null;
      
      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          // Log streaming progress for debugging
          console.log(`🤖 GPT-4o Streaming: ${content.length} characters received`);
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }

      return {
        content,
        metadata: {
          model: 'gpt-4o',
          mode: options?.mode || 'brief',
          temperature: options?.temperature || 0.7,
          maxTokens: options?.maxTokens || 2000,
          usage: usage,
          streaming: true
        }
      };

    } catch (error) {
      console.error('GPT-4o API Error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown GPT-4o API error'
      };
    }
  }
} 