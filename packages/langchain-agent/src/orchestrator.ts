import { LangChainAgent } from './agent.js';
import type { Workflow } from '@celo-automator/types';

/**
 * Custom Workflow Orchestrator
 * No external LLM dependencies - uses heuristic-based decision making
 */
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
      // Parse workflow from natural language using heuristics
      const workflow = this.parseWorkflowFromText(naturalLanguage, context);
      const memory = this.agent.getMemory();
      
      memory.addMessage('user', naturalLanguage);
      memory.addMessage('assistant', JSON.stringify(workflow, null, 2));

      return {
        success: true,
        workflow,
        explanation: `Parsed workflow: ${workflow.name}. Actions: ${workflow.actions.map(a => a.type).join(', ')}`,
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
    // Generate simple human-readable explanation using heuristics
    const actionDescriptions = workflow.actions.map(a => {
      switch (a.type) {
        case 'transfer':
          return `Transfer ${a.amount} to ${a.to}`;
        case 'contract_call':
          return `Call ${a.functionName} on ${a.contractAddress}`;
        case 'notify':
          return 'Send notification';
        default:
          return `Execute ${a.type}`;
      }
    });

    return `Workflow: ${workflow.name}\n\nSteps:\n${actionDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`;
  }

  private parseWorkflowFromText(text: string, context?: Record<string, any>): Workflow {
    const normalizedText = text.toLowerCase().trim();
    
    // Generate workflow name
    const name = this.extractWorkflowName(normalizedText);
    
    // Parse actions using heuristics
    const actions = this.parseActions(text, context);

    // Determine trigger type
    const trigger = this.determineTrigger(normalizedText);

    return {
      name,
      description: text,
      trigger,
      actions,
      enabled: true,
    };
  }

  private extractWorkflowName(text: string): string {
    // Extract name from patterns like "workflow: name" or use first few words
    const nameMatch = text.match(/workflow:?\s*([^\n.]+)/i);
    if (nameMatch) return nameMatch[1].trim();
    
    const words = text.split(/\s+/).slice(0, 3).join(' ');
    return words || 'unnamed-workflow';
  }

  private determineTrigger(text: string): Workflow['trigger'] {
    if (/daily|weekly|monthly|every|schedule/i.test(text)) {
      return {
        type: 'cron',
        cron: '0 0 * * *', // Default daily at midnight
      };
    }
    if (/when|if|condition|on event/i.test(text)) {
      return {
        type: 'condition',
        condition: {
          type: 'custom',
          operator: 'gt',
          value: 0,
        },
      };
    }
    return {
      type: 'manual',
    };
  }

  private parseActions(text: string, _context?: Record<string, any>): Workflow['actions'] {
    const actions: Workflow['actions'] = [];

    // Parse transfer actions
    const transferMatch = text.match(/send|transfer|pay\s+(\d+(?:\.\d+)?)\s*(?:to\s+)?([0x\w]+)/gi);
    if (transferMatch) {
      for (const match of transferMatch) {
        const amountMatch = match.match(/(\d+(?:\.\d+)?)/);
        const addressMatch = match.match(/([0x\w]+)$/);
        
        if (amountMatch && addressMatch) {
          actions.push({
            type: 'transfer',
            amount: amountMatch[1],
            to: addressMatch[1],
          });
        }
      }
    }

    // Parse contract call actions
    if (/call|execute|invoke|interact/i.test(text)) {
      const contractMatch = text.match(/address:?\s*([0x\w]+)/i);
      const functionMatch = text.match(/function:?\s*(\w+)/i);
      
      if (contractMatch && functionMatch) {
        actions.push({
          type: 'contract_call',
          contractAddress: contractMatch[1],
          functionName: functionMatch[1],
          parameters: [],
        });
      }
    }

    // If no actions parsed, default to manual trigger
    if (actions.length === 0) {
      actions.push({
        type: 'notify',
      });
    }

    return actions;
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
