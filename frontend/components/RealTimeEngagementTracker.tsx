import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
  Activity,
  Eye,
  MousePointer,
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Clock,
  Users,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from 'lucide-react';
import backend from '~backend/client';

interface EngagementEvent {
  id: string;
  prospectId: string;
  prospectName: string;
  eventType: 'email_open' | 'email_click' | 'website_visit' | 'form_submit' | 'download' | 'meeting_scheduled' | 'reply';
  timestamp: Date;
  channel: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

interface ProspectEngagement {
  prospectId: string;
  prospectName: string;
  company: string;
  totalScore: number;
  recentActivity: number;
  engagementTrend: 'up' | 'down' | 'stable';
  intentLevel: 'low' | 'medium' | 'high' | 'urgent';
  lastActivity: Date;
  activeSequences: string[];
  responseRate: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface EngagementMetrics {
  totalEvents: number;
  eventsToday: number;
  avgResponseTime: number;
  topEngagementTypes: { type: string; count: number; score: number }[];
  engagementRate: number;
  conversionRate: number;
  churnRisk: number;
  trendDirection: 'up' | 'down' | 'stable';
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  action: 'notify' | 'create_task' | 'send_email' | 'escalate';
  active: boolean;
}

interface EngagementAlert {
  id: string;
  prospectId: string;
  prospectName: string;
  type: 'high_intent' | 'churn_risk' | 'milestone_reached' | 'sequence_completion' | 'negative_response';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  actionTaken: boolean;
}

export default function RealTimeEngagementTracker() {
  const [engagementEvents, setEngagementEvents] = useState<EngagementEvent[]>([]);
  const [activeProspects, setActiveProspects] = useState<ProspectEngagement[]>([]);
  const [metrics, setMetrics] = useState<EngagementMetrics>({
    totalEvents: 0,
    eventsToday: 0,
    avgResponseTime: 0,
    topEngagementTypes: [],
    engagementRate: 0,
    conversionRate: 0,
    churnRisk: 0,
    trendDirection: 'stable'
  });
  const [alerts, setAlerts] = useState<EngagementAlert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadInitialData();
    setupRealTimeConnection();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(refreshData, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [autoRefresh, selectedTimeframe]);

  const loadInitialData = async () => {
    try {
      const [eventsData, prospectsData, metricsData, alertsData] = await Promise.all([
        backend.nurturing.getRecentEngagementEvents({ timeframe: selectedTimeframe }),
        backend.nurturing.getActiveProspectEngagement(),
        backend.nurturing.getEngagementMetrics({ timeframe: selectedTimeframe }),
        backend.nurturing.getEngagementAlerts()
      ]);

      setEngagementEvents(eventsData || []);
      setActiveProspects(prospectsData || []);
      setMetrics(metricsData || metrics);
      setAlerts(alertsData || []);
    } catch (error) {
      console.error('Failed to load engagement data:', error);
      toast({
        title: "Load Error",
        description: "Failed to load engagement tracking data",
        variant: "destructive"
      });
    }
  };

  const setupRealTimeConnection = () => {
    try {
      // In a real implementation, this would connect to a WebSocket endpoint
      // For now, we'll simulate real-time updates
      setIsStreaming(true);
      
      // Simulate incoming events
      const simulateEvent = () => {
        const eventTypes = ['email_open', 'email_click', 'website_visit', 'form_submit', 'download'];
        const randomEvent: EngagementEvent = {
          id: `event_${Date.now()}`,
          prospectId: `prospect_${Math.floor(Math.random() * 100)}`,
          prospectName: `Prospect ${Math.floor(Math.random() * 100)}`,
          eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)] as any,
          timestamp: new Date(),
          channel: 'email',
          content: 'Engagement detected',
          score: Math.floor(Math.random() * 50) + 10,
          metadata: {}
        };

        setEngagementEvents(prev => [randomEvent, ...prev.slice(0, 49)]); // Keep last 50 events
        
        // Update metrics
        setMetrics(prev => ({
          ...prev,
          totalEvents: prev.totalEvents + 1,
          eventsToday: prev.eventsToday + 1
        }));

        // Check for alerts
        checkForAlerts(randomEvent);
      };

      // Simulate events every 5-15 seconds
      const scheduleNextEvent = () => {
        setTimeout(() => {
          simulateEvent();
          scheduleNextEvent();
        }, Math.random() * 10000 + 5000);
      };

      scheduleNextEvent();
      
    } catch (error) {
      console.error('Failed to setup real-time connection:', error);
      setIsStreaming(false);
    }
  };

  const checkForAlerts = (event: EngagementEvent) => {
    // High-value engagement alert
    if (event.score > 40) {
      const alert: EngagementAlert = {
        id: `alert_${Date.now()}`,
        prospectId: event.prospectId,
        prospectName: event.prospectName,
        type: 'high_intent',
        message: `High engagement detected: ${event.eventType} with score ${event.score}`,
        severity: 'warning',
        timestamp: new Date(),
        actionTaken: false
      };
      
      setAlerts(prev => [alert, ...prev.slice(0, 19)]); // Keep last 20 alerts
      
      toast({
        title: "High Intent Alert",
        description: `${event.prospectName} showed high engagement`,
      });
    }
  };

  const refreshData = async () => {
    try {
      const [metricsData, prospectsData] = await Promise.all([
        backend.nurturing.getEngagementMetrics({ timeframe: selectedTimeframe }),
        backend.nurturing.getActiveProspectEngagement()
      ]);

      setMetrics(metricsData || metrics);
      setActiveProspects(prospectsData || []);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  const handleAlert = async (alertId: string, action: string) => {
    try {
      await backend.nurturing.handleEngagementAlert({ alertId, action });
      
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, actionTaken: true } : alert
      ));
      
      toast({
        title: "Alert Handled",
        description: `Alert action: ${action}`,
      });
    } catch (error) {
      console.error('Failed to handle alert:', error);
      toast({
        title: "Action Failed",
        description: "Could not execute alert action",
        variant: "destructive"
      });
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'email_open': return <Eye className="h-4 w-4 text-blue-500" />;
      case 'email_click': return <MousePointer className="h-4 w-4 text-green-500" />;
      case 'website_visit': return <Activity className="h-4 w-4 text-purple-500" />;
      case 'form_submit': return <CheckCircle className="h-4 w-4 text-orange-500" />;
      case 'download': return <ArrowDown className="h-4 w-4 text-indigo-500" />;
      case 'meeting_scheduled': return <Calendar className="h-4 w-4 text-red-500" />;
      case 'reply': return <MessageSquare className="h-4 w-4 text-teal-500" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getEngagementTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="h-8 w-8 text-primary" />
            {isStreaming && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">Real-Time Engagement</h1>
            <p className="text-muted-foreground">
              Live prospect activity and response tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isStreaming ? "default" : "outline"}>
            {isStreaming ? "Live" : "Offline"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Events Today</p>
                <p className="text-2xl font-bold">{metrics.eventsToday}</p>
                <p className="text-xs text-muted-foreground">
                  +{Math.round(((metrics.eventsToday - metrics.totalEvents + metrics.eventsToday) / Math.max(1, metrics.totalEvents - metrics.eventsToday)) * 100)}% from yesterday
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Engagement Rate</p>
                <p className="text-2xl font-bold">{Math.round(metrics.engagementRate * 100)}%</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {getEngagementTrendIcon(metrics.trendDirection)}
                  {metrics.trendDirection} trend
                </p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{Math.round(metrics.avgResponseTime)}h</p>
                <p className="text-xs text-muted-foreground">
                  24h improvement: -2.3h
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Prospects</p>
                <p className="text-2xl font-bold">{activeProspects.length}</p>
                <p className="text-xs text-muted-foreground">
                  {activeProspects.filter(p => p.riskLevel === 'high').length} at risk
                </p>
              </div>
              <Users className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Activity Feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Live Activity Feed
                </CardTitle>
                <Badge variant="outline">
                  {engagementEvents.length} events
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {engagementEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      {getEventIcon(event.eventType)}
                      <div>
                        <p className="font-medium">{event.prospectName}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.eventType.replace('_', ' ')} • {event.channel}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">+{event.score}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                
                {engagementEvents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent activity. Waiting for engagement events...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts & Notifications */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alerts & Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 border rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getAlertIcon(alert.severity)}
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                          {alert.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">{alert.prospectName}</p>
                    <p className="text-xs text-muted-foreground mb-2">{alert.message}</p>
                    
                    {!alert.actionTaken && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAlert(alert.id, 'create_task')}
                        >
                          Create Task
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAlert(alert.id, 'notify')}
                        >
                          Notify
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                
                {alerts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active alerts</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Prospect Engagement Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Prospect Engagement Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProspects.slice(0, 6).map((prospect) => (
              <div
                key={prospect.prospectId}
                className="p-4 border rounded-lg hover:bg-accent"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">{prospect.prospectName}</p>
                    <p className="text-sm text-muted-foreground">{prospect.company}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {getEngagementTrendIcon(prospect.engagementTrend)}
                    <Badge variant={
                      prospect.intentLevel === 'urgent' ? 'destructive' :
                      prospect.intentLevel === 'high' ? 'default' : 'outline'
                    }>
                      {prospect.intentLevel}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Engagement Score</span>
                    <span className="font-medium">{prospect.totalScore}</span>
                  </div>
                  <Progress value={(prospect.totalScore / 100) * 100} className="h-2" />
                  
                  <div className="flex justify-between text-sm">
                    <span>Response Rate</span>
                    <span className="font-medium">{Math.round(prospect.responseRate * 100)}%</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span>Last Activity</span>
                    <span className="text-muted-foreground">
                      {formatTimeAgo(prospect.lastActivity)}
                    </span>
                  </div>

                  {prospect.riskLevel === 'high' && (
                    <div className="flex items-center gap-2 mt-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-500">Churn Risk</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Engagement Types Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Engagement Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topEngagementTypes.map((type, index) => (
                <div key={type.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">#{index + 1}</span>
                    {getEventIcon(type.type)}
                    <span className="text-sm">{type.type.replace('_', ' ')}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{type.count} events</p>
                    <p className="text-xs text-muted-foreground">Avg score: {type.score}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">
                  {Math.round(metrics.conversionRate * 100)}%
                </p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">
                  {Math.round(metrics.churnRisk * 100)}%
                </p>
                <p className="text-sm text-muted-foreground">Churn Risk</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Health Score</span>
                <span className="font-medium">
                  {Math.round((metrics.engagementRate + metrics.conversionRate - metrics.churnRisk) * 100)}
                </span>
              </div>
              <Progress 
                value={(metrics.engagementRate + metrics.conversionRate - metrics.churnRisk) * 100} 
                className="h-2" 
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}