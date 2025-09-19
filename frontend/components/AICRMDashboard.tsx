import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Activity, 
  Brain, 
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Zap
} from 'lucide-react';
import { usePipelineAnalytics, useDashboardInsights, useTopPerformers, useUpcomingActivities } from '../hooks/useAICRM';
import { useToast } from '@/components/ui/use-toast';

export default function AICRMDashboard() {
  const { data: analytics, isLoading: analyticsLoading } = usePipelineAnalytics();
  const { data: insights, isLoading: insightsLoading } = useDashboardInsights();
  const { data: topPerformers, isLoading: performersLoading } = useTopPerformers();
  const { data: upcomingActivities, isLoading: activitiesLoading } = useUpcomingActivities();
  const { toast } = useToast();

  if (analyticsLoading || insightsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'very_positive': return 'text-green-600';
      case 'positive': return 'text-green-500';
      case 'neutral': return 'text-gray-500';
      case 'negative': return 'text-red-500';
      case 'very_negative': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">AI CRM Dashboard</h1>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          AI-Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{analytics?.total_leads || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics?.qualified_leads || 0} qualified
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
                <p className="text-2xl font-bold">{analytics?.active_deals || 0}</p>
                <p className="text-xs text-muted-foreground">
                  ${(analytics?.total_deal_value || 0).toLocaleString()} total
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{analytics?.win_rate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground">
                  Avg deal: ${(analytics?.avg_deal_size || 0).toLocaleString()}
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{analytics?.total_contacts || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics?.avg_sales_cycle_days || 30} day avg cycle
                </p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              AI Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights && Array.isArray(insights) ? insights.slice(0, 5).map((insight: any) => (
                <div key={insight.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getPriorityColor(insight.priority)} text-white border-none`}
                      >
                        {insight.priority}
                      </Badge>
                      <span className="text-sm font-medium">{insight.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        Confidence: {insight.confidence_score}%
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {insight.entity_name}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      toast({
                        title: "Insight marked as acted upon",
                        description: "This recommendation has been processed."
                      });
                    }}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                </div>
              )) : null}
              
              {(!insights || !Array.isArray(insights) || insights.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No AI insights available yet</p>
                  <p className="text-sm">Insights will appear as you add more data</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upcoming Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingActivities && Array.isArray(upcomingActivities) ? upcomingActivities.slice(0, 5).map((activity: any) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                      <span className="text-sm font-medium">{activity.subject}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activity.contact_name || activity.lead_name || activity.deal_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.scheduled_at).toLocaleDateString()} at{' '}
                      {new Date(activity.scheduled_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  {activity.ai_sentiment && (
                    <div className={`text-xs ${getSentimentColor(activity.ai_sentiment)}`}>
                      {activity.ai_sentiment.replace('_', ' ')}
                    </div>
                  )}
                </div>
              )) : null}
              
              {(!upcomingActivities || !Array.isArray(upcomingActivities) || upcomingActivities.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming activities</p>
                  <p className="text-sm">Schedule activities to see them here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList>
          <TabsTrigger value="performance">Top Performers</TabsTrigger>
          <TabsTrigger value="ai-scores">AI Score Distribution</TabsTrigger>
          <TabsTrigger value="conversion">Conversion Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPerformers?.top_leads && Array.isArray(topPerformers.top_leads) ? topPerformers.top_leads.slice(0, 3).map((lead: any, index: number) => (
                    <div key={lead.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">{lead.company}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{lead.ai_score}</Badge>
                        <p className="text-xs text-muted-foreground">{lead.status}</p>
                      </div>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPerformers?.top_contacts && Array.isArray(topPerformers.top_contacts) ? topPerformers.top_contacts.slice(0, 3).map((contact: any) => (
                    <div key={contact.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">{contact.company}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${contact.lifetime_value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{contact.deal_count} deals</p>
                      </div>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Deals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPerformers?.top_deals && Array.isArray(topPerformers.top_deals) ? topPerformers.top_deals.slice(0, 3).map((deal: any) => (
                    <div key={deal.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{deal.name}</p>
                        <p className="text-sm text-muted-foreground">{deal.contact_company}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${deal.value.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{deal.ai_win_probability}% win</p>
                      </div>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-scores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics?.ai_score_distribution || {}).map(([range, count]) => (
                  <div key={range} className="flex items-center justify-between">
                    <span className="capitalize">{range.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={(count as number / (analytics?.total_leads || 1)) * 100} 
                        className="w-24" 
                      />
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics?.conversion_rates || {}).map(([type, rate]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="capitalize">{type.replace('_', ' to ')}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={rate as number} className="w-24" />
                      <span className="text-sm font-medium">{(rate as number).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}