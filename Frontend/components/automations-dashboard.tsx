/**
 * Automations Dashboard Component
 * Main UI component for managing and executing automations
 */

'use client';

import { useState, useEffect } from 'react';
import { useAutomations } from '@/hooks/use-automations';
import { useBlockchain } from '@/hooks/use-blockchain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { AnalyticsStats } from '@/components/analytics-stats';

export function AutomationsDashboard() {
  const {
    automations,
    loading: autosLoading,
    error: autosError,
    execute,
    refresh,
  } = useAutomations();

  const { balance, getBalance } = useBlockchain();
  const [executing, setExecuting] = useState<string | null>(null);

  const handleExecute = async (automationId: string) => {
    setExecuting(automationId);
    try {
      await execute(automationId);
      await refresh();
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setExecuting(null);
    }
  };

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
      <AnalyticsStats />

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
            <Card key={automation.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{automation.name}</CardTitle>
                      <Badge
                        variant={automation.enabled ? 'default' : 'secondary'}
                      >
                        {automation.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                      {automation.riskScore > 70 && (
                        <Badge variant="destructive">High Risk</Badge>
                      )}
                    </div>
                    <CardDescription>{automation.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Workflow Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Type</p>
                    <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {typeof automation.workflowConfig === 'string'
                        ? JSON.parse(automation.workflowConfig).type
                        : automation.workflowConfig.type}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500">Risk Score</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {automation.riskScore}/{automation.maxRiskScore}
                      </p>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            automation.riskScore > 70
                              ? 'bg-red-500'
                              : automation.riskScore > 40
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                          style={{
                            width: `${(automation.riskScore / automation.maxRiskScore) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Last Execution */}
                {automation.lastExecution && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Last Execution
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      {automation.lastExecution.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span>{automation.lastExecution.status}</span>
                      <span className="text-gray-500">
                        {new Date(automation.lastExecution.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    {automation.lastExecution.txHash && (
                      <p className="text-xs text-gray-600 mt-1 font-mono break-all">
                        {automation.lastExecution.txHash}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleExecute(automation.id)}
                    disabled={
                      executing === automation.id ||
                      automation.riskScore > automation.maxRiskScore
                    }
                  >
                    {executing === automation.id ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Execute Now
                      </>
                    )}
                  </Button>

                  <Button variant="outline" size="sm">
                    Edit
                  </Button>

                  <Button variant="outline" size="sm" className="text-red-600">
                    Delete
                  </Button>
                </div>

                {automation.riskScore > automation.maxRiskScore && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-700">
                    ⚠️ Risk score exceeds maximum threshold. Approval required.
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default AutomationsDashboard;
