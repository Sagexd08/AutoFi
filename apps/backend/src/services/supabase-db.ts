import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export interface AutomationRecord {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  workflow_config: Record<string, any>;
  enabled: boolean;
  risk_score: number;
  max_risk_score: number;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ExecutionRecord {
  id: string;
  automation_id: string;
  user_id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  transaction_hash?: string;
  block_number?: number;
  gas_used?: string;
  error?: string;
  duration_ms?: number;
  result_metadata?: Record<string, any>;
  triggered_at: string;
  executed_at?: string;
  completed_at?: string;
}

export class SupabaseDatabaseService {
  private admin: SupabaseClient;

  constructor() {
    this.admin = createSupabaseAdmin();
  }

  async createAutomation(automation: Omit<AutomationRecord, 'id' | 'created_at' | 'updated_at'>): Promise<AutomationRecord> {
    try {
      const { data, error } = await this.admin
        .from('automations')
        .insert({
          ...automation,
          workflow_config: automation.workflow_config,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create automation', { error });
        throw new Error(`Failed to create automation: ${error.message}`);
      }

      logger.info('Automation created', { id: data.id, userId: data.user_id });
      return data as AutomationRecord;
    } catch (error) {
      logger.error('Create automation error', { error });
      throw error;
    }
  }

  async getAutomation(automationId: string, userId: string): Promise<AutomationRecord | null> {
    try {
      const { data, error } = await this.admin
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Failed to get automation', { error });
        throw error;
      }

      return data as AutomationRecord;
    } catch (error) {
      logger.error('Get automation error', { error });
      throw error;
    }
  }

  async listAutomations(
    userId: string,
    options?: {
      enabled?: boolean;
      skip?: number;
      take?: number;
    }
  ): Promise<{ automations: AutomationRecord[]; total: number }> {
    try {
      let query = this.admin
        .from('automations')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (options?.enabled !== undefined) {
        query = query.eq('enabled', options.enabled);
      }

      if (options?.skip) {
        query = query.range(options.skip, options.skip + (options.take || 20) - 1);
      } else if (options?.take) {
        query = query.limit(options.take);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to list automations', { error });
        throw error;
      }

      return {
        automations: (data || []) as AutomationRecord[],
        total: count || 0,
      };
    } catch (error) {
      logger.error('List automations error', { error });
      throw error;
    }
  }

  async updateAutomation(
    automationId: string,
    userId: string,
    updates: Partial<Omit<AutomationRecord, 'id' | 'user_id' | 'created_at'>>
  ): Promise<AutomationRecord> {
    try {
      const { data, error } = await this.admin
        .from('automations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', automationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update automation', { error });
        throw error;
      }

      logger.info('Automation updated', { id: automationId });
      return data as AutomationRecord;
    } catch (error) {
      logger.error('Update automation error', { error });
      throw error;
    }
  }

  async deleteAutomation(automationId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.admin
        .from('automations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', automationId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to delete automation', { error });
        throw error;
      }

      logger.info('Automation deleted', { id: automationId });
    } catch (error) {
      logger.error('Delete automation error', { error });
      throw error;
    }
  }

  async recordExecution(execution: Omit<ExecutionRecord, 'id' | 'triggered_at'>): Promise<ExecutionRecord> {
    try {
      const { data, error } = await this.admin
        .from('execution_history')
        .insert(execution)
        .select()
        .single();

      if (error) {
        logger.error('Failed to record execution', { error });
        throw error;
      }

      logger.info('Execution recorded', {
        id: data.id,
        automationId: data.automation_id,
        status: data.status,
      });

      return data as ExecutionRecord;
    } catch (error) {
      logger.error('Record execution error', { error });
      throw error;
    }
  }

  async getExecutionHistory(
    automationId: string,
    userId: string,
    limit: number = 20
  ): Promise<ExecutionRecord[]> {
    try {
      const { data, error } = await this.admin
        .from('execution_history')
        .select('*')
        .eq('automation_id', automationId)
        .eq('user_id', userId)
        .order('triggered_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get execution history', { error });
        throw error;
      }

      return (data || []) as ExecutionRecord[];
    } catch (error) {
      logger.error('Get execution history error', { error });
      throw error;
    }
  }

  async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    try {
      const { data, error } = await this.admin
        .from('execution_history')
        .select('*')
        .eq('id', executionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Failed to get execution', { error });
        throw error;
      }

      return data as ExecutionRecord;
    } catch (error) {
      logger.error('Get execution error', { error });
      throw error;
    }
  }

  async updateExecutionStatus(
    executionId: string,
    updates: Partial<Pick<ExecutionRecord, 'status' | 'transaction_hash' | 'block_number' | 'gas_used' | 'error' | 'completed_at'>>
  ): Promise<ExecutionRecord> {
    try {
      const { data, error } = await this.admin
        .from('execution_history')
        .update(updates)
        .eq('id', executionId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update execution status', { error });
        throw error;
      }

      return data as ExecutionRecord;
    } catch (error) {
      logger.error('Update execution status error', { error });
      throw error;
    }
  }

  async getUserAnalytics(userId: string): Promise<{
    totalAutomations: number;
    enabledAutomations: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
  }> {
    try {
      const [automationsData, executionsData] = await Promise.all([
        this.admin
          .from('automations')
          .select('id, enabled', { count: 'exact' })
          .eq('user_id', userId)
          .is('deleted_at', null),
        this.admin
          .from('execution_history')
          .select('status', { count: 'exact' })
          .eq('user_id', userId),
      ]);

      const automations = automationsData.data || [];
      const enabledCount = automations.filter((a: any) => a.enabled).length;

      const executions = executionsData.data || [];
      const successCount = executions.filter((e: any) => e.status === 'success').length;
      const failCount = executions.filter((e: any) => e.status === 'failed').length;

      return {
        totalAutomations: automationsData.count || 0,
        enabledAutomations: enabledCount,
        totalExecutions: executionsData.count || 0,
        successfulExecutions: successCount,
        failedExecutions: failCount,
      };
    } catch (error) {
      logger.error('Get user analytics error', { error });
      throw error;
    }
  }

  async batchRecordExecutions(executions: Array<Omit<ExecutionRecord, 'id' | 'triggered_at'>>): Promise<ExecutionRecord[]> {
    try {
      const { data, error } = await this.admin
        .from('execution_history')
        .insert(executions)
        .select();

      if (error) {
        logger.error('Failed to batch record executions', { error });
        throw error;
      }

      logger.info('Batch executions recorded', { count: (data || []).length });
      return (data || []) as ExecutionRecord[];
    } catch (error) {
      logger.error('Batch record executions error', { error });
      throw error;
    }
  }
}

let databaseService: SupabaseDatabaseService | null = null;

export function getDatabaseService(): SupabaseDatabaseService {
  if (!databaseService) {
    databaseService = new SupabaseDatabaseService();
  }
  return databaseService;
}

export default getDatabaseService;
