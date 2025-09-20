import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  Activity, 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Users,
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bell,
  Settings
} from 'lucide-react';
import backend from '~backend/client';

interface DashboardData {
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    score: number;
    lastUpdate: Date;
  };
  realTimeMetrics: {
    timestamp: Date;
    requests: {
      total: number;
      successful: number;
      blocked: number;
      rate: number;
    };
    quotas: {
      totalUsers: number;
      nearLimit: number;
      exceeded: number;
      avgUtilization: number;
    };
    performance: {
      avgResponseTime: number;
      p95ResponseTime: number;
      errorRate: number;
      throughput: number;
    };
    circuitBreakers: {
      total: number;
      open: number;
      halfOpen: number;
      closed: number;
    };
    anomalies: {
      detected: number;
      severity: Record<string, number>;
    };
  };
  activeAlerts: Array<{
    id: string;
    type: string;
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    title: string;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    requestCount: number;
    blockingRate: number;
    avgResponseTime: number;
  }>;
  quotaStatus: Array<{
    tier: string;
    totalUsers: number;
    avgUtilization: number;
    usersNearLimit: number;
  }>;
  trends: Array<{
    metric: string;
    value: number;
    change: number;
    period: string;
  }>;
}

interface PredictiveAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timeToEvent: number;
  affectedEntity: {
    type: string;
    identifier: string;
    name: string;
  };
  prediction: {
    metric: string;
    currentValue: number;
    predictedValue: number;
    threshold: number;
  };
  confidence: number;
  recommendedActions: string[];
}

export default function RateLimitingDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [predictiveAlerts, setPredictiveAlerts] = useState<PredictiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchDashboardData = async () => {
    try {
      const [dashboard, alerts] = await Promise.all([
        backend.rate_limiting.realtime_monitor.getDashboard(),
        backend.rate_limiting.enhanced_analytics.generatePredictiveAlerts()
      ]);
      
      setDashboardData(dashboard);
      setPredictiveAlerts(alerts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await backend.rate_limiting.realtime_monitor.acknowledgeAlert({ 
        alertId, 
        acknowledgedBy: 'current_user' 
      });
      await fetchDashboardData(); // Refresh data
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await backend.rate_limiting.realtime_monitor.resolveAlert({ 
        alertId, 
        resolvedBy: 'current_user' 
      });
      await fetchDashboardData(); // Refresh data
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'emergency': return 'bg-red-100 text-red-800 border-red-200';
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'warning': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'info': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatTimeToEvent = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>Error loading dashboard: {error}</span>
          </div>
          <Button 
            onClick={fetchDashboardData}
            variant="outline" 
            size="sm" 
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!dashboardData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rate Limiting Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and intelligent rate limiting analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={dashboardData.systemHealth.status === 'healthy' ? 'default' : 'destructive'}>
            {getStatusIcon(dashboardData.systemHealth.status)}
            <span className="ml-1">System {dashboardData.systemHealth.status}</span>
          </Badge>
          <Button onClick={fetchDashboardData} variant="outline" size="sm">
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.systemHealth.score}%</div>
            <Progress value={dashboardData.systemHealth.score} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Request Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.realTimeMetrics.requests.rate}/sec</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.realTimeMetrics.requests.total} total requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Requests</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {dashboardData.realTimeMetrics.requests.blocked}
            </div>
            <p className="text-xs text-muted-foreground">
              {((dashboardData.realTimeMetrics.requests.blocked / Math.max(dashboardData.realTimeMetrics.requests.total, 1)) * 100).toFixed(1)}% blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.realTimeMetrics.quotas.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.realTimeMetrics.quotas.nearLimit} near quota limit
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {dashboardData.activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {dashboardData.activeAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="predictive">
            Predictive
            {predictiveAlerts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {predictiveAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Response Time</span>
                  <span className="font-medium">{dashboardData.realTimeMetrics.performance.avgResponseTime}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">P95 Response Time</span>
                  <span className="font-medium">{dashboardData.realTimeMetrics.performance.p95ResponseTime}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Error Rate</span>
                  <span className="font-medium text-red-600">{dashboardData.realTimeMetrics.performance.errorRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Throughput</span>
                  <span className="font-medium">{dashboardData.realTimeMetrics.performance.throughput} req/min</span>
                </div>
              </CardContent>
            </Card>

            {/* Circuit Breakers */}
            <Card>
              <CardHeader>
                <CardTitle>Circuit Breakers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-medium">{dashboardData.realTimeMetrics.circuitBreakers.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Closed</span>
                  <Badge variant="default">{dashboardData.realTimeMetrics.circuitBreakers.closed}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Half-Open</span>
                  <Badge variant="secondary">{dashboardData.realTimeMetrics.circuitBreakers.halfOpen}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Open</span>
                  <Badge variant="destructive">{dashboardData.realTimeMetrics.circuitBreakers.open}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Key Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dashboardData.trends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{trend.metric.replace(/_/g, ' ').toUpperCase()}</p>
                      <p className="text-2xl font-bold">{trend.value}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {trend.change > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : trend.change < 0 ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                      <span className={`text-sm ${trend.change > 0 ? 'text-green-600' : trend.change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {trend.change > 0 ? '+' : ''}{trend.change}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {dashboardData.activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active alerts. System is running smoothly.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {dashboardData.activeAlerts.map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${
                  alert.severity === 'emergency' ? 'border-l-red-500' :
                  alert.severity === 'critical' ? 'border-l-red-400' :
                  alert.severity === 'warning' ? 'border-l-yellow-400' :
                  'border-l-blue-400'
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{alert.title}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-3">{alert.message}</p>
                    <div className="flex space-x-2">
                      {!alert.acknowledged && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          <Bell className="h-4 w-4 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="predictive" className="space-y-4">
          {predictiveAlerts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                  <p>No predictive alerts. All systems operating within normal parameters.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {predictiveAlerts.map((alert) => (
                <Card key={alert.id} className="border-l-4 border-l-orange-400">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">
                          PREDICTION
                        </Badge>
                        <span className="font-medium">{alert.affectedEntity.name}</span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>ETA: {formatTimeToEvent(alert.timeToEvent)}</span>
                        <span>Confidence: {Math.round(alert.confidence * 100)}%</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Prediction</p>
                        <p className="text-sm text-muted-foreground">
                          {alert.prediction.metric} will reach {alert.prediction.predictedValue} 
                          (threshold: {alert.prediction.threshold}, current: {alert.prediction.currentValue})
                        </p>
                      </div>
                      
                      {alert.recommendedActions.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Recommended Actions</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {alert.recommendedActions.map((action, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <span className="text-blue-500 mt-1">•</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Endpoints by Traffic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.topEndpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{endpoint.method} {endpoint.endpoint}</p>
                      <p className="text-sm text-muted-foreground">{endpoint.requestCount} requests</p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{endpoint.blockingRate.toFixed(1)}%</p>
                        <p className="text-muted-foreground">Blocking</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{endpoint.avgResponseTime}ms</p>
                        <p className="text-muted-foreground">Avg Time</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardData.quotaStatus.map((quota, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg capitalize">{quota.tier} Tier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Users</span>
                    <span className="font-medium">{quota.totalUsers}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg Utilization</span>
                      <span className="font-medium">{quota.avgUtilization}%</span>
                    </div>
                    <Progress value={quota.avgUtilization} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Near Limit</span>
                    <Badge variant={quota.usersNearLimit > 0 ? "destructive" : "default"}>
                      {quota.usersNearLimit}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}