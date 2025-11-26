import { Anthropic } from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { pino } from 'pino';

const logger = pino({ name: 'predictive-intent' });

export interface PredictiveIntentConfig {
  anthropicApiKey: string;
  model?: string;
}

export interface PredictionContext {
  userId: string;
  recentTransactions: any[];
  userPreferences?: any;
  marketConditions?: any;
  activePositions?: any[];
}

export interface PredictedIntent {
  suggestedAction: string;
  confidence: number;
  reasoning: string;
  params?: Record<string, any>;
}

export class PredictiveIntentAgent {
  private client: Anthropic;
  private model: string;

  constructor(config: PredictiveIntentConfig) {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.model = config.model || 'claude-3-5-sonnet-20240620';
  }

  async predictNextAction(context: PredictionContext): Promise<PredictedIntent | null> {
    try {
      const systemPrompt = `You are a Predictive Intent Agent for a DeFi automation platform.
Your goal is to analyze the user's context (history, positions, market) and predict the most likely next action they might want to take.
Focus on:
1. Maintenance (rebalancing, topping up gas, claiming rewards)
2. Opportunity (yield farming, arbitrage, buying dips)
3. Risk Management (closing positions, hedging)

Output a JSON object with:
- suggestedAction: A natural language description of the action
- confidence: A number between 0 and 1
- reasoning: Why you think this is the next step
- params: Optional parameters for the action (token, amount, protocol)
`;

      const userPrompt = `
User Context:
${JSON.stringify(context, null, 2)}

Predict the next likely action.
`;

      const schema = z.object({
        suggestedAction: z.string(),
        confidence: z.number(),
        reasoning: z.string(),
        params: z.record(z.any()).optional(),
      });

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [{
          name: 'predict_action',
          description: 'Predict the next user action',
          input_schema: zodToJsonSchema(schema) as any,
        }],
        tool_choice: { type: 'tool', name: 'predict_action' },
      });

      const toolUse = response.content.find(c => c.type === 'tool_use');
      if (toolUse && toolUse.type === 'tool_use') {
        return toolUse.input as PredictedIntent;
      }

      return null;
    } catch (error) {
      logger.error({ error }, 'Failed to predict intent');
      return null;
    }
  }
}
