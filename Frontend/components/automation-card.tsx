
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Automation } from '@/hooks/use-automations';

interface AutomationCardProps {
  automation: Automation;
  isExecuting: boolean;
  onExecute: (id: string) => void;
}

export const AutomationCard = memo(function AutomationCard({
  automation,
  isExecuting,
  onExecute,
}: AutomationCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>{automation.name}</CardTitle>
              <Badge variant={automation.enabled ? 'default' : 'secondary'}>
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
            onClick={() => onExecute(automation.id)}
            disabled={
              isExecuting ||
              automation.riskScore > automation.maxRiskScore
            }
          >
            {isExecuting ? (
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
  );
});
