import Anthropic from '@anthropic-ai/sdk';
import { pino } from 'pino';
import {
  AIEngineConfig,
  ProcessRequest,
  ProcessResponse,
  ParsedIntent,
  ParsedIntentSchema,
} from './types.js';
import { buildContextualSystemPrompt } from './prompts.js';
import { validateFunctionCall } from './function-registry.js';

const logger = pino({ name: 'ai-engine' });

/**
 * Autofi AI Engine - Natural Language to Intent Parser
 * Uses Claude 3.5 Sonnet for high-accuracy intent parsing
 */
export class AIEngine {
  private client: Anthropic;
  private config: AIEngineConfig;

  constructor(config: AIEngineConfig) {
    this.config = {
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.1, // Low temperature for consistency
      anthropicApiKey: config.anthropicApiKey,
      fallbackModel: config.fallbackModel,
      fallbackApiKey: config.fallbackApiKey,
    };

    this.client = new Anthropic({
      apiKey: this.config.anthropicApiKey,
    });

    logger.info({ model: this.config.model }, 'AI Engine initialized');
  }

  /**
   * Process a natural language prompt and return structured intent
   */
  async process(request: ProcessRequest): Promise<ProcessResponse> {
    const startTime = Date.now();

    try {
      logger.info({ 
        userId: request.userId, 
        promptLength: request.prompt.length 
      }, 'Processing intent');

      // Build context-aware system prompt
      const systemPrompt = buildContextualSystemPrompt(request.context);

      // Call Claude with strict JSON mode
      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      });

      // Extract text content
      const textContent = message.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from AI');
      }

      const responseText = textContent.text.trim();

      // Parse JSON response
      let parsedJson: unknown;
      try {
        // Try to parse directly
        parsedJson = JSON.parse(responseText);
      } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[1].trim());
        } else {
          // Try to find JSON object in response
          const objectMatch = responseText.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            parsedJson = JSON.parse(objectMatch[0]);
          } else {
            throw new Error('Could not extract JSON from response');
          }
        }
      }

      // Validate against schema
      const validationResult = ParsedIntentSchema.safeParse(parsedJson);
      
      if (!validationResult.success) {
        logger.warn({ 
          errors: validationResult.error.errors,
          rawResponse: responseText.substring(0, 500),
        }, 'Schema validation failed');
        
        // Try to salvage partial data
        const partialIntent = this.buildPartialIntent(parsedJson as Record<string, unknown>, request.prompt);
        
        return {
          success: true,
          intent: partialIntent,
          processingTimeMs: Date.now() - startTime,
        };
      }

      const intent = validationResult.data;

      // Validate each step's function call
      for (const step of intent.steps) {
        const stepValidation = validateFunctionCall(step);
        if (!stepValidation.valid) {
          logger.warn({ step, error: stepValidation.error }, 'Invalid function call in step');
        }
      }

      logger.info({
        userId: request.userId,
        intentType: intent.intentType,
        stepsCount: intent.steps.length,
        confidence: intent.confidence,
        processingTimeMs: Date.now() - startTime,
      }, 'Intent parsed successfully');

      return {
        success: true,
        intent,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error({ 
        error: errorMessage, 
        userId: request.userId,
        prompt: request.prompt.substring(0, 100),
      }, 'Failed to process intent');

      return {
        success: false,
        intent: null,
        error: errorMessage,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Build a partial intent from partially valid data
   */
  private buildPartialIntent(data: Record<string, unknown>, originalPrompt: string): ParsedIntent {
    return {
      originalPrompt,
      confidence: 0.3,
      intentType: 'unclear',
      steps: [],
      warnings: ['Intent parsing was partial - some data may be missing'],
      clarificationNeeded: ['Could you please rephrase your request more clearly?'],
      entities: {
        tokens: (data.entities as Record<string, unknown>)?.tokens as string[] || [],
        addresses: (data.entities as Record<string, unknown>)?.addresses as string[] || [],
        amounts: (data.entities as Record<string, unknown>)?.amounts as string[] || [],
        chains: [],
        protocols: [],
      },
    };
  }

  /**
   * Stream processing for real-time UI updates
   */
  async *processStream(request: ProcessRequest): AsyncGenerator<{
    type: 'thinking' | 'partial' | 'complete' | 'error';
    content: string;
    intent?: ParsedIntent;
  }> {
    // const startTime = Date.now();

    try {
      yield { type: 'thinking', content: 'Analyzing your request...' };

      const systemPrompt = buildContextualSystemPrompt(request.context);

      const stream = this.client.messages.stream({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
      });

      let fullText = '';

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          yield { type: 'partial', content: event.delta.text };
        }
      }

      // Parse final result
      const parsedJson = JSON.parse(fullText);
      const validationResult = ParsedIntentSchema.safeParse(parsedJson);

      if (validationResult.success) {
        yield { 
          type: 'complete', 
          content: 'Intent parsed successfully',
          intent: validationResult.data,
        };
      } else {
        yield {
          type: 'error',
          content: `Validation failed: ${validationResult.error.message}`,
        };
      }
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get conversation context for follow-up queries
   */
  async processWithHistory(
    request: ProcessRequest,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<ProcessResponse> {
    const startTime = Date.now();

    try {
      const systemPrompt = buildContextualSystemPrompt(request.context);

      const messages: Anthropic.MessageParam[] = [
        ...history.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user' as const, content: request.prompt },
      ];

      const message = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages,
      });

      const textContent = message.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from AI');
      }

      const parsedJson = JSON.parse(textContent.text.trim());
      const validationResult = ParsedIntentSchema.safeParse(parsedJson);

      if (!validationResult.success) {
        throw new Error(`Schema validation failed: ${validationResult.error.message}`);
      }

      return {
        success: true,
        intent: validationResult.data,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        intent: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate that a plan is still valid (for retrying failed plans)
   */
  async revalidatePlan(plan: ParsedIntent): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Validate each step
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const validation = validateFunctionCall(step);
      if (!validation.valid) {
        issues.push(`Step ${i + 1}: ${validation.error}`);
      }
    }

    // Check for scheduling validity
    if (plan.schedule?.cronExpression) {
      try {
        // Basic cron validation
        const parts = plan.schedule.cronExpression.split(' ');
        if (parts.length < 5) {
          issues.push('Invalid cron expression format');
        }
      } catch {
        issues.push('Invalid cron expression');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

/**
 * Factory function to create AI Engine with environment config
 */
export function createAIEngine(config?: Partial<AIEngineConfig>): AIEngine {
  const apiKey = config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }

  return new AIEngine({
    anthropicApiKey: apiKey,
    model: config?.model || 'claude-3-5-sonnet-20241022',
    maxTokens: config?.maxTokens || 4096,
    temperature: config?.temperature || 0.1,
    fallbackModel: config?.fallbackModel,
    fallbackApiKey: config?.fallbackApiKey,
  });
}
