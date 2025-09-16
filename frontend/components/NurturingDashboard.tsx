import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Target, 
  Brain, 
  MessageSquare,
  BarChart3,
  Play,
  Pause,
  Settings
} from 'lucide-react';
import { useNurturing } from '../hooks/useNurturing';
import LoadingSpinner from './LoadingSpinner';
import { SequenceBuilder } from './SequenceBuilder';
import { ProspectClassificationView } from './ProspectClassificationView';
import { NurturingAnalytics } from './NurturingAnalytics';
import { ContentGenerator } from './ContentGenerator';

export function NurturingDashboard() {
  const {
    analytics,
    recommendations,
    isLoading,
    processScheduledSteps,
    isProcessing,
    refetchAnalytics
  } = useNurturing();

  const [activeTab, setActiveTab] = useState<'overview' | 'sequences' | 'analytics' | 'content'>('overview');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const handleProcessScheduledSteps = async () => {
    try {
      await processScheduledSteps();
      await refetchAnalytics();
    } catch (error) {
      console.error('Failed to process scheduled steps:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">AI Nurturing System</h1>
          <p className="text-muted-foreground">
            Intelligent prospect nurturing with AI-powered behavior analysis and personalized sequences
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleProcessScheduledSteps}
            disabled={isProcessing}
            variant="outline"
          >
            {isProcessing ? <LoadingSpinner className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Process Scheduled
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'sequences', label: 'Sequences', icon: MessageSquare },
          { id: 'analytics', label: 'Analytics', icon: TrendingUp },
          { id: 'content', label: 'Content AI', icon: Brain }
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id as any)}
            className="gap-2"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Prospects</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {analytics?.total_prospects_nurtured || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently in nurturing sequences
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
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
                <CardTitle className="text-sm font-medium">Avg. Time to Convert</CardTitle>
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
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  ${(analytics?.revenue_impact || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Estimated revenue from nurturing
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Classification Breakdown */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Prospect Classification</CardTitle>
                <CardDescription>Distribution of prospects by AI classification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics?.classification_breakdown && Object.entries(analytics.classification_breakdown).map(([classification, count]) => (
                  <div key={classification} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          classification === 'hot' ? 'destructive' :
                          classification === 'warm' ? 'default' :
                          classification === 'cold' ? 'secondary' : 'outline'
                        }>
                          {classification}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{count} prospects</span>
                      </div>
                      <span className="text-sm font-medium">
                        {analytics.total_prospects_nurtured > 0 
                          ? ((count / analytics.total_prospects_nurtured) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={analytics.total_prospects_nurtured > 0 
                        ? (count / analytics.total_prospects_nurtured) * 100 
                        : 0} 
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Funnel Stage Distribution</CardTitle>
                <CardDescription>Prospects by sales funnel stage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics?.funnel_stage_distribution && Object.entries(analytics.funnel_stage_distribution).map(([stage, count]) => (
                  <div key={stage} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {stage.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{count} prospects</span>
                      </div>
                      <span className="text-sm font-medium">
                        {analytics.total_prospects_nurtured > 0 
                          ? ((count / analytics.total_prospects_nurtured) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={analytics.total_prospects_nurtured > 0 
                        ? (count / analytics.total_prospects_nurtured) * 100 
                        : 0} 
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Sequences */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Sequences</CardTitle>
              <CardDescription>Sequences with highest conversion rates and engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.top_performing_sequences?.slice(0, 5).map((sequence, index) => (
                  <div key={sequence.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Optimization Insights */}
          {analytics?.ai_optimization_metrics && (
            <Card>
              <CardHeader>
                <CardTitle>AI Optimization Performance</CardTitle>
                <CardDescription>Impact of AI-generated content vs manual content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-foreground">
                      {analytics.ai_optimization_metrics.ai_generated_content_count}
                    </div>
                    <div className="text-sm text-muted-foreground">AI-Generated Content Pieces</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-foreground">
                      {analytics.ai_optimization_metrics.avg_quality_score?.toFixed(1) || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Average Quality Score</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-foreground">
                      {analytics.ai_optimization_metrics.prospects_with_ai_content}
                    </div>
                    <div className="text-sm text-muted-foreground">Prospects with AI Content</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Optimization Recommendations */}
          {recommendations?.sequence_recommendations && recommendations.sequence_recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
                <CardDescription>AI-generated suggestions to improve sequence performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recommendations.sequence_recommendations.slice(0, 3).map((rec, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{rec.sequence_name}</span>
                        <Badge variant={rec.priority === 'high' ? 'destructive' : 'default'}>
                          {rec.priority} priority
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Current conversion rate: {rec.current_conversion_rate?.toFixed(1)}%
                      </div>
                      <ul className="text-sm space-y-1">
                        {rec.recommendations.map((recommendation: string, i: number) => (
                          <li key={i} className="text-muted-foreground">• {recommendation}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'sequences' && <SequenceBuilder />}
      {activeTab === 'analytics' && <NurturingAnalytics />}
      {activeTab === 'content' && <ContentGenerator />}
    </div>
  );
}