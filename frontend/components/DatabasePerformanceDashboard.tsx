import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Database, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Activity,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import StatsCard from './StatsCard';

interface PerformanceDashboard {
  overview: {
    avg_query_time: number;
    slow_query_count: number;
    total_queries: number;
    cache_hit_rate: number;
    connection_utilization: number;
  };
  slowest_queries: Array<{
    query_hash: string;
    query_text: string;
    avg_execution_time: number;
    execution_count: number;
    service_name: string;
  }>;
  most_frequent_queries: Array<{
    query_hash: string;
    query_text: string;
    execution_count: number;
    avg_execution_time: number;
    service_name: string;
  }>;
  connection_stats: Array<{
    database_name: string;
    service_name: string;
    active_connections: number;
    max_connections: number;
    connection_utilization: number;
  }>;
  recent_alerts: Array<{
    id: number;
    alert_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    service_name?: string;
    timestamp: string;
    resolved: boolean;
    acknowledged: boolean;
  }>;
  problematic_patterns: Array<{
    pattern_template: string;
    service_name: string;
    total_executions: number;
    avg_execution_time_ms: number;
    slow_query_count: number;
  }>;
}

interface SlowQueryAnalysis {
  total_slow_queries: number;
  critical_queries: number;
  most_problematic_queries: Array<{
    query_hash: string;
    query_text: string;
    avg_execution_time: number;
    execution_count: number;
    affected_users: number;
    service_name: string;
    recommendations: string[];
  }>;
  trending_slow_queries: Array<{
    query_hash: string;
    service_name: string;
    trend: 'worsening' | 'improving' | 'stable';
    current_avg: number;
    previous_avg: number;
    change_percent: number;
  }>;
  service_performance: Array<{
    service_name: string;
    slow_query_count: number;
    avg_slow_query_time: number;
    worst_query_time: number;
  }>;
}

const DatabasePerformanceDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<PerformanceDashboard | null>(null);
  const [slowQueryAnalysis, setSlowQueryAnalysis] = useState<SlowQueryAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('24h');
  const [serviceName, setServiceName] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      
      const dashboardResponse = await fetch(
        `/api/db-performance/dashboard?timeframe=${timeframe}${serviceName ? `&service_name=${serviceName}` : ''}`
      );
      if (!dashboardResponse.ok) throw new Error('Failed to fetch dashboard');
      const dashboardData = await dashboardResponse.json();
      setDashboard(dashboardData);

      const slowQueryResponse = await fetch(
        `/api/db-performance/slow-queries?timeframe=${timeframe}${serviceName ? `&service_name=${serviceName}` : ''}`
      );
      if (!slowQueryResponse.ok) throw new Error('Failed to fetch slow query analysis');
      const slowQueryData = await slowQueryResponse.json();
      setSlowQueryAnalysis(slowQueryData);

    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      toast({
        title: "Error",
        description: "Failed to load performance dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [timeframe, serviceName]);

  const handleResolveAlert = async (alertId: number) => {
    try {
      const response = await fetch(`/api/db-performance/alerts/${alertId}/resolve`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to resolve alert');
      
      toast({
        title: "Success",
        description: "Alert resolved successfully",
      });
      
      fetchDashboard();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      toast({
        title: "Error", 
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'worsening': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'improving': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatQueryText = (queryText: string) => {
    return queryText.length > 100 ? queryText.substring(0, 100) + '...' : queryText;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!dashboard || !slowQueryAnalysis) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load performance dashboard data
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Database Performance</h1>
          <p className="text-muted-foreground">Monitor and optimize database performance</p>
        </div>
        
        <div className="flex gap-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={serviceName} onValueChange={setServiceName}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Services</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="ai_crm">AI CRM</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="scoring">Scoring</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={fetchDashboard} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatsCard
          title="Avg Query Time"
          value={`${dashboard.overview.avg_query_time}ms`}
          icon={<Clock className="h-5 w-5" />}
          trend={dashboard.overview.avg_query_time > 500 ? 'up' : 'stable'}
        />
        <StatsCard
          title="Total Queries"
          value={dashboard.overview.total_queries.toLocaleString()}
          icon={<Database className="h-5 w-5" />}
        />
        <StatsCard
          title="Slow Queries"
          value={dashboard.overview.slow_query_count.toString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          trend={dashboard.overview.slow_query_count > 0 ? 'up' : 'stable'}
        />
        <StatsCard
          title="Cache Hit Rate"
          value={`${dashboard.overview.cache_hit_rate}%`}
          icon={<Zap className="h-5 w-5" />}
          trend={dashboard.overview.cache_hit_rate > 80 ? 'up' : 'down'}
        />
        <StatsCard
          title="Connection Usage"
          value={`${dashboard.overview.connection_utilization}%`}
          icon={<Activity className="h-5 w-5" />}
          trend={dashboard.overview.connection_utilization > 80 ? 'up' : 'stable'}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="slow-queries">Slow Queries</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Slowest Queries */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Slowest Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard.slowest_queries.slice(0, 5).map((query, index) => (
                    <div key={index} className="border-l-4 border-l-red-500 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-mono text-sm text-muted-foreground">
                            {formatQueryText(query.query_text)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{query.service_name}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {query.execution_count} executions
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-red-600">
                            {query.avg_execution_time}ms
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Most Frequent Queries */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Most Frequent Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard.most_frequent_queries.slice(0, 5).map((query, index) => (
                    <div key={index} className="border-l-4 border-l-blue-500 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-mono text-sm text-muted-foreground">
                            {formatQueryText(query.query_text)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{query.service_name}</Badge>
                            <span className="text-sm text-muted-foreground">
                              Avg: {query.avg_execution_time}ms
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-blue-600">
                            {query.execution_count} times
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Service Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Service Performance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {slowQueryAnalysis.service_performance.map((service, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h3 className="font-semibold">{service.service_name}</h3>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Slow queries:</span>
                        <span className="text-sm font-medium">{service.slow_query_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg time:</span>
                        <span className="text-sm font-medium">{service.avg_slow_query_time}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Worst:</span>
                        <span className="text-sm font-medium text-red-600">{service.worst_query_time}ms</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slow-queries" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard
              title="Total Slow Queries"
              value={slowQueryAnalysis.total_slow_queries.toString()}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatsCard
              title="Critical Queries"
              value={slowQueryAnalysis.critical_queries.toString()}
              icon={<XCircle className="h-5 w-5" />}
            />
            <StatsCard
              title="Trending Issues"
              value={slowQueryAnalysis.trending_slow_queries.filter(q => q.trend === 'worsening').length.toString()}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Problematic Queries */}
            <Card>
              <CardHeader>
                <CardTitle>Most Problematic Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {slowQueryAnalysis.most_problematic_queries.slice(0, 5).map((query, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline">{query.service_name}</Badge>
                        <span className="font-semibold text-red-600">
                          {query.avg_execution_time}ms
                        </span>
                      </div>
                      <p className="font-mono text-sm text-muted-foreground mb-2">
                        {formatQueryText(query.query_text)}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span>{query.execution_count} executions</span>
                        <span>{query.affected_users} affected users</span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium">Recommendations:</h4>
                        {query.recommendations.slice(0, 2).map((rec, recIndex) => (
                          <p key={recIndex} className="text-xs text-muted-foreground">
                            • {rec}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Trending Queries */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {slowQueryAnalysis.trending_slow_queries.slice(0, 5).map((query, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(query.trend)}
                          <Badge variant="outline">{query.service_name}</Badge>
                        </div>
                        <Badge variant={query.trend === 'worsening' ? 'destructive' : query.trend === 'improving' ? 'default' : 'secondary'}>
                          {query.trend}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Current: {query.current_avg}ms</p>
                          <p className="text-sm text-muted-foreground">Previous: {query.previous_avg}ms</p>
                        </div>
                        <div className={`text-lg font-semibold ${
                          query.change_percent > 0 ? 'text-red-600' : 
                          query.change_percent < 0 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {query.change_percent > 0 ? '+' : ''}{query.change_percent}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Connection Pool Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard.connection_stats.map((conn, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{conn.service_name}</h3>
                        <p className="text-sm text-muted-foreground">{conn.database_name}</p>
                      </div>
                      <Badge variant={conn.connection_utilization > 80 ? 'destructive' : 'default'}>
                        {conn.connection_utilization}%
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Active:</span>
                        <span className="text-sm font-medium">{conn.active_connections}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Max:</span>
                        <span className="text-sm font-medium">{conn.max_connections}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full ${
                            conn.connection_utilization > 80 ? 'bg-red-500' : 
                            conn.connection_utilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${conn.connection_utilization}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Performance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.recent_alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No active performance alerts</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboard.recent_alerts.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          {alert.service_name && (
                            <Badge variant="outline">{alert.service_name}</Badge>
                          )}
                          {alert.acknowledged && (
                            <Badge variant="secondary">Acknowledged</Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!alert.resolved && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolveAlert(alert.id)}
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                      <h3 className="font-semibold mb-1">{alert.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabasePerformanceDashboard;