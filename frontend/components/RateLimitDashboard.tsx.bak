import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  AlertTriangle,
  Activity,
  Users,
  Zap,
  Shield,
  TrendingUp,
  Clock,
  Ban,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import backend from '~backend/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function RateLimitDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedEndpoint, setSelectedEndpoint] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');

  const getDateRange = () => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date();
    
    switch (selectedTimeRange) {
      case '24h':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      default:
        start.setDate(start.getDate() - 1);
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end
    };
  };

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['rateLimitAnalytics', selectedTimeRange, selectedEndpoint, selectedTier],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      return backend.rate_limiting.getAnalytics({
        startDate,
        endDate,
        endpoint: selectedEndpoint !== 'all' ? selectedEndpoint : undefined,
        tier: selectedTier !== 'all' ? selectedTier : undefined
      });
    },
    refetchInterval: 30000
  });

  const { data: realTimeUsage, isLoading: realTimeLoading } = useQuery({
    queryKey: ['realTimeUsage'],
    queryFn: () => backend.rate_limiting.getRealTimeUsage({ timeWindowMinutes: 5 }),
    refetchInterval: 10000
  });

  const { data: quotaUsage, isLoading: quotaLoading } = useQuery({
    queryKey: ['quotaUsage'],
    queryFn: () => backend.rate_limiting.getUserQuotaUsage({}),
    refetchInterval: 60000
  });

  const { data: healthScore, isLoading: healthLoading } = useQuery({
    queryKey: ['healthScore'],
    queryFn: () => backend.rate_limiting.getHealthScore(),
    refetchInterval: 60000
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => backend.rate_limiting.checkAlerts(),
    refetchInterval: 30000
  });

  const { data: violators } = useQuery({
    queryKey: ['topViolators'],
    queryFn: () => backend.rate_limiting.getTopViolators({ limit: 10 }),
    refetchInterval: 300000
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['rateLimitAnalytics'] });
    queryClient.invalidateQueries({ queryKey: ['realTimeUsage'] });
    queryClient.invalidateQueries({ queryKey: ['quotaUsage'] });
    queryClient.invalidateQueries({ queryKey: ['healthScore'] });
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
    queryClient.invalidateQueries({ queryKey: ['topViolators'] });
    toast({ title: 'Dashboard refreshed', description: 'All data has been updated' });
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rate Limiting Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor API usage, quotas, and rate limiting health across all services
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
              <SelectItem value="30d">Last 30d</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={refreshAll} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {alerts && alerts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Alerts ({alerts.length})</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {alerts.map((alert: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    {alert.severity === 'critical' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium">{alert.alertName}</span>
                    {alert.endpoint && (
                      <Badge variant="outline">{alert.endpoint}</Badge>
                    )}
                  </div>
                  <div className="text-sm">
                    {alert.currentValue.toFixed(2)} / {alert.thresholdValue}
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthScoreColor(healthScore?.score || 0)}`}>
              {healthScore?.score || 0}/100
            </div>
            <Progress 
              value={healthScore?.score || 0} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Real-time Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realTimeUsage?.reduce((sum, usage) => sum + usage.total_requests, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 5 minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {realTimeUsage?.reduce((sum, usage) => sum + usage.total_blocked, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 5 minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realTimeUsage?.reduce((sum, usage) => sum + usage.unique_users, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique users active
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="quotas">User Quotas</TabsTrigger>
          <TabsTrigger value="violators">Top Violators</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Real-time Endpoint Usage</CardTitle>
                <CardDescription>Current activity across all endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                {realTimeLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={realTimeUsage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="endpoint" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total_requests" fill="#3b82f6" name="Requests" />
                      <Bar dataKey="total_blocked" fill="#ef4444" name="Blocked" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request Analytics</CardTitle>
              <CardDescription>
                Historical request patterns and blocking rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={analytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="totalRequests" 
                      stroke="#3b82f6" 
                      name="Total Requests"
                      strokeWidth={2}
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="blockedRequests" 
                      stroke="#ef4444" 
                      name="Blocked Requests"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Quota Usage</CardTitle>
              <CardDescription>
                Monitor daily and monthly quota consumption by users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quotaLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {quotaUsage?.slice(0, 10).map((quota: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{quota.userId}</span>
                          <Badge variant={quota.tier === 'enterprise' ? 'default' : quota.tier === 'premium' ? 'secondary' : 'outline'}>
                            {quota.tier}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Daily: {quota.currentDailyUsage.toLocaleString()} / {quota.dailyQuota.toLocaleString()}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Daily Usage</span>
                            <span>{quota.dailyUsagePercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={quota.dailyUsagePercent} className="h-2" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Monthly Usage</span>
                            <span>{quota.monthlyUsagePercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={quota.monthlyUsagePercent} className="h-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violators" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Violators</CardTitle>
              <CardDescription>
                Users/IPs with the most rate limit violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {violators && violators.length > 0 ? (
                <div className="space-y-4">
                  {violators.map((violator: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-full">
                          <span className="text-sm font-bold text-red-600">{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium">{violator.identifier}</div>
                          <div className="text-sm text-muted-foreground">
                            {violator.endpoints_violated} endpoints affected
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-600">
                          {violator.total_violations} violations
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Penalty: {violator.avg_penalty_multiplier.toFixed(1)}x
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mr-2" />
                  No violations in the last 7 days
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}