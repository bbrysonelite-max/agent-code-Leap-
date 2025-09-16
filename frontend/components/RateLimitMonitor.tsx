import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { 
  Shield, 
  AlertTriangle, 
  Clock, 
  Zap, 
  Ban,
  TrendingUp,
  Activity,
  Users
} from 'lucide-react';
import { useRateLimitAnalytics } from '../hooks/useRateLimit';

export interface RateLimitMonitorProps {
  userId?: string;
  compact?: boolean;
  showAlerts?: boolean;
}

export default function RateLimitMonitor({ 
  userId, 
  compact = false, 
  showAlerts = true 
}: RateLimitMonitorProps) {
  const { toast } = useToast();
  const {
    realTimeUsage,
    realTimeLoading,
    healthScore,
    alerts,
    getQuotaUsage
  } = useRateLimitAnalytics();
  
  const { data: userQuota } = getQuotaUsage(userId);
  const [previousAlertCount, setPreviousAlertCount] = useState(0);

  useEffect(() => {
    if (alerts && alerts.length > previousAlertCount && previousAlertCount > 0) {
      const newAlerts = alerts.slice(previousAlertCount);
      newAlerts.forEach((alert: any) => {
        toast({
          title: `Rate Limit Alert: ${alert.alertName}`,
          description: `Current: ${alert.currentValue}, Threshold: ${alert.thresholdValue}`,
          variant: alert.severity === 'critical' ? 'destructive' : 'default',
        });
      });
    }
    setPreviousAlertCount(alerts?.length || 0);
  }, [alerts, previousAlertCount, toast]);

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Health Score</span>
          </div>
          <div className={`text-sm font-bold ${getHealthScoreColor(healthScore?.score || 0)}`}>
            {healthScore?.score || 0}/100
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">Requests/5m</span>
            </div>
            <div className="text-sm font-bold">
              {realTimeUsage?.reduce((sum, usage) => sum + usage.total_requests, 0) || 0}
            </div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Ban className="h-3 w-3 text-red-500" />
              <span className="text-xs text-muted-foreground">Blocked</span>
            </div>
            <div className="text-sm font-bold text-red-600">
              {realTimeUsage?.reduce((sum, usage) => sum + usage.total_blocked, 0) || 0}
            </div>
          </div>
        </div>

        {showAlerts && alerts && alerts.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {alerts.length} active alert{alerts.length > 1 ? 's' : ''}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rate Limiting Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className={`text-3xl font-bold ${getHealthScoreColor(healthScore?.score || 0)}`}>
              {healthScore?.score || 0}/100
            </div>
            <Progress value={healthScore?.score || 0} className="w-32" />
          </div>
          {healthScore?.recommendations && healthScore.recommendations.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <strong>Recommendation:</strong> {healthScore.recommendations[0]}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-time Activity
          </CardTitle>
          <CardDescription>Last 5 minutes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {realTimeUsage?.reduce((sum, usage) => sum + usage.total_requests, 0) || 0}
              </div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {realTimeUsage?.reduce((sum, usage) => sum + usage.total_blocked, 0) || 0}
              </div>
              <div className="text-sm text-muted-foreground">Blocked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {realTimeUsage?.reduce((sum, usage) => sum + usage.unique_users, 0) || 0}
              </div>
              <div className="text-sm text-muted-foreground">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {realTimeUsage?.reduce((sum, usage) => Math.max(sum, usage.max_requests_per_window), 0) || 0}
              </div>
              <div className="text-sm text-muted-foreground">Peak Window</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}