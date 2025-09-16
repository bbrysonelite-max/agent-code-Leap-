import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart, 
  Clock, 
  Brain,
  Target,
  DollarSign,
  Users,
  RefreshCw
} from 'lucide-react';
import { useNurturing } from '../hooks/useNurturing';
import LoadingSpinner from './LoadingSpinner';

export function NurturingAnalytics() {
  const { 
    analytics, 
    behaviorAnalytics, 
    recommendations,
    isLoading,
    refetchAnalytics,
    refetchBehaviorAnalytics,
    refetchRecommendations
  } = useNurturing();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchAnalytics(),
        refetchBehaviorAnalytics(),
        refetchRecommendations()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Nurturing Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive insights into nurturing performance and AI optimization
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? <LoadingSpinner className="w-4 h-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh Data
        </Button>
      </div>

      {/* Executive Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prospects Nurtured</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {analytics?.total_prospects_nurtured || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {analytics?.overall_conversion_rate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Sequence completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Time to Convert</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {analytics?.avg_time_to_conversion_days?.toFixed(0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Days from enrollment to completion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Impact</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ${(analytics?.revenue_impact || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Attributed revenue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Optimization Performance */}
      {analytics?.ai_optimization_metrics && (
        <Card>
          <CardHeader>
            <CardTitle>AI Optimization Performance</CardTitle>
            <CardDescription>
              Comparison between AI-generated and manual content performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-green-600">
                      {analytics.ai_optimization_metrics.ai_generated_content_count}
                    </div>
                    <div className="text-sm text-muted-foreground">AI-Generated Content Pieces</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-blue-600">
                      {analytics.ai_optimization_metrics.prospects_with_ai_content}
                    </div>
                    <div className="text-sm text-muted-foreground">Prospects with AI Content</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">AI Quality Score</span>
                      <span className="text-sm text-muted-foreground">
                        {analytics.ai_optimization_metrics.avg_quality_score?.toFixed(1) || 0}/10
                      </span>
                    </div>
                    <Progress 
                      value={(analytics.ai_optimization_metrics.avg_quality_score || 0) * 10} 
                      className="h-2" 
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">AI Relevance Score</span>
                      <span className="text-sm text-muted-foreground">
                        {analytics.ai_optimization_metrics.avg_relevance_score?.toFixed(1) || 0}/10
                      </span>
                    </div>
                    <Progress 
                      value={(analytics.ai_optimization_metrics.avg_relevance_score || 0) * 10} 
                      className="h-2" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium">Generation Speed</span>
                  <div className="mt-2 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-blue-500" />
                    <span className="text-lg font-bold text-foreground">
                      {analytics.ai_optimization_metrics.avg_generation_time_ms || 0}ms
                    </span>
                    <span className="text-sm text-muted-foreground">average</span>
                  </div>
                </div>

                {analytics.ai_optimization_metrics.engagement_insights && (
                  <div>
                    <span className="text-sm font-medium">Engagement Distribution</span>
                    <div className="mt-2 space-y-2">
                      {analytics.ai_optimization_metrics.engagement_insights.map((insight: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <Badge variant="outline">{insight.engagement_level}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {insight.prospect_count} prospects
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Behavioral Analytics */}
      {behaviorAnalytics && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Behavior Distribution</CardTitle>
              <CardDescription>Most common prospect behaviors and engagement patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {behaviorAnalytics.behavior_distribution?.slice(0, 6).map((behavior: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {behavior.behavior_type.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {behavior.count} occurrences
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        Avg: {behavior.avg_engagement_score?.toFixed(1) || 0}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (behavior.count / (behaviorAnalytics.behavior_distribution[0]?.count || 1)) * 100)} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peak Activity Hours</CardTitle>
              <CardDescription>When prospects are most active and engaged</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {behaviorAnalytics.peak_activity_hours?.slice(0, 8).map((hour: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {hour.hour}:00 - {(hour.hour + 1) % 24}:00
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ 
                            width: `${Math.min(100, (hour.activity_count / (behaviorAnalytics.peak_activity_hours[0]?.activity_count || 1)) * 100)}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">{hour.activity_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sequence Performance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Sequences</CardTitle>
          <CardDescription>Sequences ranked by conversion rate and engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.top_performing_sequences?.map((sequence: any, index: number) => (
              <div key={sequence.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sequence.name}</span>
                      <Badge variant="outline">
                        {sequence.target_classification} → {sequence.target_funnel_stage}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {sequence.total_enrollments} enrollments, {sequence.completions} completions
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-lg font-bold text-foreground">
                      {sequence.conversion_rate?.toFixed(1) || 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Conversion Rate
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Engagement Rate</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress 
                        value={sequence.current_avg_engagement || 0} 
                        className="flex-1 h-2" 
                      />
                      <span className="text-sm font-medium">
                        {sequence.current_avg_engagement?.toFixed(1) || 0}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-xs text-muted-foreground">Active Enrollments</span>
                    <div className="text-sm font-medium mt-1">
                      {sequence.total_enrollments - sequence.completions}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="mt-1">
                      <Badge variant={sequence.conversion_rate > 30 ? 'default' : sequence.conversion_rate > 15 ? 'secondary' : 'outline'}>
                        {sequence.conversion_rate > 30 ? 'Excellent' : sequence.conversion_rate > 15 ? 'Good' : 'Needs Optimization'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Global Optimization Recommendations */}
      {recommendations?.global_recommendations && recommendations.global_recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Global Optimization Recommendations</CardTitle>
            <CardDescription>AI-powered suggestions to improve overall nurturing performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.global_recommendations.map((recommendation: string, index: number) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <Brain className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">{recommendation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and optimizations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start">
              <TrendingUp className="w-4 h-4 mr-2" />
              Optimize Sequences
            </Button>
            <Button variant="outline" className="justify-start">
              <Brain className="w-4 h-4 mr-2" />
              Enable AI for All
            </Button>
            <Button variant="outline" className="justify-start">
              <BarChart3 className="w-4 h-4 mr-2" />
              Export Analytics
            </Button>
            <Button variant="outline" className="justify-start">
              <Target className="w-4 h-4 mr-2" />
              A/B Test Content
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}