/**
 * useAutomations Hook
 * Manages automation CRUD operations and real-time updates
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useToast } from './use-toast';

export interface Automation {
  id: string;
  name: string;
  description?: string;
  type: string;
  enabled: boolean;
  riskScore: number;
  maxRiskScore: number;
  requiresApproval: boolean;
  workflowConfig: any;
  createdAt: string;
  updatedAt: string;
  lastExecution?: {
    timestamp: string;
    status: 'success' | 'failed';
    txHash?: string;
    error?: string;
  };
}

export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all automations
  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getAutomations();
      if (response.success && response.data) {
        setAutomations(response.data);
      } else {
        setError(response.error || 'Failed to fetch automations');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({
        title: 'Error',
        description: `Failed to fetch automations: ${message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Create automation
  const create = useCallback(
    async (data: Partial<Automation>) => {
      setLoading(true);
      try {
        const response = await apiClient.createAutomation(data as any);
        if (response.success && response.data) {
          setAutomations((prev) => [...prev, response.data]);
          toast({
            title: 'Success',
            description: 'Automation created successfully',
          });
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to create automation');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast({
          title: 'Error',
          description: `Failed to create automation: ${message}`,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Update automation
  const update = useCallback(
    async (id: string, data: Partial<Automation>) => {
      setLoading(true);
      try {
        const response = await apiClient.updateAutomation(id, data as any);
        if (response.success && response.data) {
          setAutomations((prev) =>
            prev.map((auto) => (auto.id === id ? response.data : auto))
          );
          toast({
            title: 'Success',
            description: 'Automation updated successfully',
          });
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to update automation');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast({
          title: 'Error',
          description: `Failed to update automation: ${message}`,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Delete automation
  const remove = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const response = await apiClient.deleteAutomation(id);
        if (response.success) {
          setAutomations((prev) => prev.filter((auto) => auto.id !== id));
          toast({
            title: 'Success',
            description: 'Automation deleted successfully',
          });
        } else {
          throw new Error(response.error || 'Failed to delete automation');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast({
          title: 'Error',
          description: `Failed to delete automation: ${message}`,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Execute automation
  const execute = useCallback(
    async (id: string, context?: Record<string, any>) => {
      setLoading(true);
      try {
        const response = await apiClient.executeAutomation(id, context);
        if (response.success && response.data) {
          toast({
            title: 'Success',
            description: `Automation executed: ${response.data.result}`,
          });
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to execute automation');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast({
          title: 'Error',
          description: `Failed to execute automation: ${message}`,
          variant: 'destructive',
        });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Fetch on mount
  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  return {
    automations,
    loading,
    error,
    create,
    update,
    remove,
    execute,
    refresh: fetchAutomations,
  };
}
