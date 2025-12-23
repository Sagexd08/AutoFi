/**
 * Automations Dashboard Component
 * Main UI component for managing and executing automations
 */

'use client';

import { useState, useEffect } from 'react';
import { useAutomations } from '@/hooks/use-automations';
import { useBlockchain } from '@/hooks/use-blockchain';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { AutomationCard } from './automation-card';
import { useCallback } from 'react';

export function AutomationsDashboard() {
  const {
    automations,
    loading: autosLoading,
    error: autosError,
    execute,
    refresh,
  } = useAutomations();

  const { balance, getBalance } = useBlockchain();
  const [analytics, setAnalytics] = useState<any>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  // Fetch analytics on mount
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await apiClient.getAnalytics();
        if (response.success) {
          setAnalytics(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
    }

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleExecute = useCallback(async (automationId: string) => {
    setExecuting(automationId);
    try {
      await execute(automationId);
      await refresh();
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setExecuting(null);
    }
  }, [execute, refresh]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automations</h1>
          <p className="text-gray-500">Manage your AI-powered automations</p>
        </div>
        <Button onClick={refresh} disabled={autosLoading}>
          {autosLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Error Alert */}
      {autosError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700">{autosError}</p>
          </div>
        </div>
      )}

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Automations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics.totalAutomations}</p>
              <p className="text-xs text-gray-500">
                {analytics.activeAutomations} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics.successRate?.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">
                {analytics.totalTransactions} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg. Execution Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {(analytics.averageExecutionTime / 1000).toFixed(2)}s
              </p>
              <p className="text-xs text-gray-500">milliseconds</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Most Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {analytics.mostUsedFunctions?.[0]?.functionName || 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                {analytics.mostUsedFunctions?.[0]?.count} calls
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Automations List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Automations</h2>

        {autosLoading && !automations.length ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">Loading automations...</p>
            </CardContent>
          </Card>
        ) : automations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">
                No automations yet. Create one to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              isExecuting={executing === automation.id}
              onExecute={handleExecute}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default AutomationsDashboard;
