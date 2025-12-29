'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AnalyticsStats() {
  const [analytics, setAnalytics] = useState<any>(null);

  // Fetch analytics on mount
  useEffect(() => {
    let mounted = true;

    async function fetchAnalytics() {
      try {
        const response = await apiClient.getAnalytics();
        if (mounted && response.success) {
          setAnalytics(response.data);
        }
      } catch (error) {
        if (mounted) {
          console.error('Failed to fetch analytics:', error);
        }
      }
    }

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!analytics) {
    return null;
  }

  return (
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
  );
}
