import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { LangChainAgent } from './agent.js';
import type { Workflow } from '@autofi/types';

const WORKFLOW_SYSTEM_PROMPT = `You are an advanced AI workflow orchestrator for Celo blockchain automation.

Your role is to:
1. Interpret natural language automation requests
2. Convert them into structured JSON workflows
3. Execute blockchain operations safely and efficiently
4. Provide clear explanations of your reasoning

You have access to Celo blockchain tools for:
- Checking balances (CELO and ERC20 tokens)
- Sending transactions
- Calling smart contracts
- Listening to blockchain events

When creating workflows:
- Always validate addresses and amounts
- Estimate gas before executing transactions
- Provide clear error messages if something fails
- Suggest optimizations when possible

Workflow format:
{
  "name": "workflow name",
  "description": "what this workflow does",
    "trigger": {
      "type": "event" | "cron" | "manual" | "condition",
    },
    "actions": [
      {
        "type": "transfer" | "contract_call" | "notify" | "conditional",
      }
    ]
}`;

export class WorkflowOrchestrator {
  private agent: LangChainAgent;

  constructor(agent: LangChainAgent) {
    this.agent = agent;
  }

  async interpretWorkflow(
    naturalLanguage: string,
    context?: Record<string, any>
  ): Promise<{
    success: boolean;
    workflow?: Workflow;
    explanation?: string;
    error?: string;
  }> {
    try {
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(WORKFLOW_SYSTEM_PROMPT),
        new MessagesPlaceholder('chat_history'),
        HumanMessagePromptTemplate.fromTemplate(
          `User request: {input}\n\nContext: {context}\n\nGenerate a structured workflow JSON. Include an explanation of your reasoning.`
        ),
      ]);

      const chain = prompt.pipe(this.agent.getLLM());

      const memory = this.agent.getMemory();
      const chatHistory = memory.getChatHistory();

      const response = await chain.invoke({
        input: naturalLanguage,
        context: JSON.stringify(context || {}, null, 2),
        chat_history: chatHistory.slice(-10),
      });

      memory.addMessage('user', naturalLanguage);
      memory.addMessage('assistant', response.content as string);

      const workflow = this.extractWorkflowFromResponse(response.content as string);

      return {
        success: true,
        workflow,
        explanation: response.content as string,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async executeWorkflow(
    workflow: Workflow
  ): Promise<{
    success: boolean;
    results?: Record<string, any>;
    transactionHashes?: string[];
    error?: string;
  }> {
    const results: Record<string, any> = {};
    const transactionHashes: string[] = [];

    try {
      for (const action of workflow.actions) {
        const result = await this.executeAction(action);

        if (!results[action.type]) {
          results[action.type] = [];
        }
        results[action.type].push(result);

        if (result.transactionHash) {
          transactionHashes.push(result.transactionHash);
        }

        if (!result.success && action.type !== 'notify') {
          return {
            success: false,
            results,
            transactionHashes,
            error: result.error || 'Action failed',
          };
        }
      }

      return {
        success: true,
        results,
        transactionHashes,
      };
    } catch (error) {
      return {
        success: false,
        results,
        transactionHashes,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async explainWorkflow(workflow: Workflow): Promise<string> {
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        'You are a helpful assistant that explains blockchain workflows in clear, simple language.'
      ),
      HumanMessagePromptTemplate.fromTemplate(
        'Explain this workflow:\n\n{workflow}\n\nProvide a clear, step-by-step explanation.'
      ),
    ]);

    const chain = prompt.pipe(this.agent.getLLM());
    const response = await chain.invoke({
      workflow: JSON.stringify(workflow, null, 2),
    });

    return response.content as string;
  }

  private extractWorkflowFromResponse(response: string): Workflow | undefined {
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as Workflow;
      } catch {
      }
    }

    try {
      return JSON.parse(response) as Workflow;
    } catch {
      return undefined;
    }
  }

  private async executeAction(action: Workflow['actions'][0]): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
    result?: any;
  }> {
    const tools = this.agent.getTools();

    switch (action.type) {
      case 'transfer': {
        if (!action.to) {
          return { success: false, error: 'Missing required transfer parameter: to' };
        }
        if (!action.amount) {
          return { success: false, error: 'Missing required transfer parameter: amount' };
        }

        if (action.tokenAddress) {
          const tool = tools.find((t) => t.name === 'send_token');
          if (tool) {
            const resultStr = await tool.func({
              tokenAddress: action.tokenAddress,
              to: action.to,
              amount: action.amount,
            } as any);
            const result = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
            return {
              success: result.success,
              transactionHash: result.transactionHash,
              error: result.error,
              result,
            };
          }
        } else {
          const tool = tools.find((t) => t.name === 'send_celo');
          if (tool) {
            const resultStr = await tool.func({
              to: action.to,
              amount: action.amount,
            } as any);
            const result = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
            return {
              success: result.success,
              transactionHash: result.transactionHash,
              error: result.error,
              result,
            };
          }
        }
        return { success: false, error: 'Transfer tool not available' };
      }

      case 'contract_call': {
        if (!action.contractAddress) {
          return { success: false, error: 'Missing required contract_call parameter: contractAddress' };
        }
        if (!action.functionName) {
          return { success: false, error: 'Missing required contract_call parameter: functionName' };
        }

        const tool = tools.find((t) => t.name === 'call_contract');
        if (tool) {
          const resultStr = await tool.func({
            address: action.contractAddress,
            functionName: action.functionName,
            parameters: action.parameters || [],
            abi: action.abi,
          } as any);
          const result = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
          return {
            success: result.success,
            transactionHash: result.transactionHash,
            error: result.error,
            result,
          };
        }
        return { success: false, error: 'Contract call tool not available' };
      }

      case 'notify': {
        return { success: true, result: { notified: true } };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  }
}
