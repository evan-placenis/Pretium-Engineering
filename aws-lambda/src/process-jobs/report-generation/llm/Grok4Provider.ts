// Grok4 LLM Provider
import { LLMProvider, LLMResponse, VisionContent } from '../../types';
import { OpenAI } from 'openai';

export class Grok4Provider implements LLMProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GROK_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ GROK_API_KEY not found in environment variables');
    }
  }

  async generateContent(prompt: string | VisionContent, options?: any): Promise<LLMResponse> {
    const startTime = Date.now();
    try {
      let textPrompt: string;
      if (typeof prompt === 'string') {
        textPrompt = prompt;
      } else {
        textPrompt = prompt.text;
        if (prompt.imageUrl) {
          console.warn('⚠️ Grok4Provider received an image URL, but it does not support vision. The image will be ignored.');
        }
      }

      console.log(`🤖 Grok4: Starting content generation (prompt: ${textPrompt.length} chars)`);

            // Static import for OpenAI
      const grokClient = new OpenAI({
        apiKey: this.apiKey,
        baseURL: "https://api.x.ai/v1",
        timeout: 360000, // 6 minute timeout for reasoning models
      });

      const apiCallStartTime = Date.now();
      console.log(`🤖 Grok4: Making API call...`);
      const response = await grokClient.chat.completions.create({
        model: 'grok-4',
        messages: [
          {
            role: 'user',
            content: textPrompt
          }
        ],
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2000,
        response_format: { type: "json_object" }, // Force JSON output
        stream: true // Enable streaming
      });
      const apiCallEndTime = Date.now();
      console.log(`🤖 Grok4: API call initiated in ${apiCallEndTime - apiCallStartTime}ms`);

      // Handle streaming response
      let content = '';
      let usage: any = null;
      let chunkCount = 0;
      const streamingStartTime = Date.now();
      
      console.log(`🤖 Grok4: Starting streaming response...`);
      for await (const chunk of response) {
        chunkCount++;
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          // Log streaming progress for debugging (less frequent)
          if (chunkCount % 10 === 0) {
            console.log(`🤖 Grok4 Streaming: ${content.length} characters received (${chunkCount} chunks processed)`);
          }
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
      }
      const streamingEndTime = Date.now();
      console.log(`🤖 Grok4: Streaming completed in ${streamingEndTime - streamingStartTime}ms (${chunkCount} chunks processed, ${content.length} chars generated)`);

      const totalTime = Date.now() - startTime;
      console.log(`🤖 Grok4: Total generation time: ${totalTime}ms`);

      return {
        content,
        metadata: {
          model: 'grok4',
          mode: options?.mode || 'brief',
          temperature: options?.temperature || 0.7,
          maxTokens: options?.maxTokens || 2000,
          usage: usage,
          streaming: true,
          generationTime: totalTime,
          chunkCount: chunkCount
        }
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Grok4 API Error after ${totalTime}ms:`, error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown Grok4 API error'
      };
    }
  }
} 