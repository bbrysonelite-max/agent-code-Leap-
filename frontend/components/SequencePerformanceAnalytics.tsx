import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Mail, 
  MousePointer, 
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  Lightbulb
} from 'lucide-react';
import backend from '~backend/client';
import { useToast } from '@/components/ui/use-toast';

export function SequencePerformanceAnalytics() {
  const [selectedSequence, setSelectedSequence] = useState<string>('all');
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [engagementTrends, setEngagementTrends] = useState<any[]>([]);
  const [conversionData, setConversionData] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [stepAnalytics, setStepAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedSequence, timePeriod]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      const [performance, trends, conversions, insights] = await Promise.all([
        backend.nurturing.getSequencePerformance(
          selectedSequence !== 'all' ? { sequenceId: selectedSequence } : {}
        ),
        backend.nurturing.getEngagementTrends({ 
          period: timePeriod,
          ...(selectedSequence !== 'all' ? { sequenceId: selectedSequence } : {})
        }),
        backend.nurturing.getConversionAnalytics(
          selectedSequence !== 'all' ? { sequenceId: selectedSequence } : {}
        ),
        backend.nurturing.getAIInsights()
      ]);

      setPerformanceData(performance);
      setEngagementTrends(trends);
      setConversionData(conversions);
      setAiInsights(insights);

      // Load step analytics if specific sequence selected
      if (selectedSequence !== 'all') {
        const stepData = await backend.nurturing.getSequenceStepAnalytics({ sequenceId: selectedSequence });
        setStepAnalytics(stepData);
      } else {
        setStepAnalytics([]);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'opportunity':
        return <Lightbulb className="h-4 w-4 text-blue-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 animate-pulse mx-auto mb-2" />
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={selectedSequence} onValueChange={setSelectedSequence}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select sequence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sequences</SelectItem>
              {performanceData.map((seq) => (
                <SelectItem key={seq.sequenceId} value={seq.sequenceId}>
                  {seq.sequenceName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={timePeriod} onValueChange={(value: '7d' | '30d' | '90d') => setTimePeriod(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days</SelectItem>
            <SelectItem value="30d">30 days</SelectItem>
            <SelectItem value="90d">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aiInsights?.summary?.avgOpenRate ? Math.round(aiInsights.summary.avgOpenRate) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across all sequences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Reply Rate</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aiInsights?.summary?.avgReplyRate ? Math.round(aiInsights.summary.avgReplyRate) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Prospect responses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Prospects</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aiInsights?.summary?.totalActiveProspects || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              In nurturing sequences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sequences</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aiInsights?.summary?.totalSequences || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active sequences
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="steps">Step Analysis</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Engagement Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Trends</CardTitle>
              <CardDescription>Daily engagement metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {engagementTrends.slice(-7).map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {new Date(day.date).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-4 flex-1 ml-4">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-gray-500 w-16">Opens:</span>
                        <Progress value={day.metrics.openRate} className="flex-1" />
                        <span className="text-xs font-medium w-12">{Math.round(day.metrics.openRate)}%</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-gray-500 w-16">Clicks:</span>
                        <Progress value={day.metrics.clickRate} className="flex-1" />
                        <span className="text-xs font-medium w-12">{Math.round(day.metrics.clickRate)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conversion Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion Overview</CardTitle>
              <CardDescription>Conversion rates by sequence</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversionData.slice(0, 5).map((seq) => (
                  <div key={seq.sequenceId} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <p className="font-medium">{seq.sequenceName}</p>
                      <p className="text-sm text-gray-600">{seq.totalProspects} prospects</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">Completion:</span>
                        <Progress value={seq.completionRate} className="w-20" />
                        <span className="text-sm font-medium w-12">{Math.round(seq.completionRate)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Reply:</span>
                        <Progress value={seq.replyRate} className="w-20" />
                        <span className="text-sm font-medium w-12">{Math.round(seq.replyRate)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {performanceData.map((seq) => (
              <Card key={seq.sequenceId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{seq.sequenceName}</CardTitle>
                    <Badge variant={seq.activeSequences > 0 ? 'default' : 'secondary'}>
                      {seq.activeSequences} active
                    </Badge>
                  </div>
                  <CardDescription>
                    {seq.totalEnrollments} total enrollments • {seq.completedSequences} completed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span>Delivery Rate:</span>
                        <span className="font-medium">{Math.round(seq.metrics.deliveryRate)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Open Rate:</span>
                        <span className="font-medium">{Math.round(seq.metrics.openRate)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Click Rate:</span>
                        <span className="font-medium">{Math.round(seq.metrics.clickRate)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reply Rate:</span>
                        <span className="font-medium">{Math.round(seq.metrics.replyRate)}%</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Engagement Score:</span>
                        <span className="font-medium">{Math.round(seq.avgEngagementScore)}/100</span>
                      </div>
                      <Progress value={seq.avgEngagementScore} className="h-2" />
                      
                      <div className="flex items-center justify-between text-sm">
                        <span>Conversion Probability:</span>
                        <span className="font-medium">{Math.round(seq.avgConversionProbability)}%</span>
                      </div>
                      <Progress value={seq.avgConversionProbability} className="h-2" />
                    </div>

                    {seq.avgCompletionDays > 0 && (
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Avg Completion:
                        </span>
                        <span className="font-medium">{Math.round(seq.avgCompletionDays)} days</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="steps" className="space-y-4">
          {selectedSequence === 'all' ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-600">
                  Select a specific sequence to view step-by-step analytics
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Step-by-Step Performance</CardTitle>
                <CardDescription>
                  Detailed analytics for each step in the sequence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stepAnalytics.map((step) => (
                    <div key={step.stepOrder} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Step {step.stepOrder + 1}</Badge>
                          <Badge className="capitalize">{step.stepType}</Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {step.metrics.totalExecutions} executions
                        </div>
                      </div>
                      
                      <p className="font-medium mb-3">{step.subject}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-medium text-lg">{Math.round(step.metrics.deliveryRate)}%</div>
                          <div className="text-gray-600">Delivery</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-lg">{Math.round(step.metrics.openRate)}%</div>
                          <div className="text-gray-600">Open</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-lg">{Math.round(step.metrics.clickRate)}%</div>
                          <div className="text-gray-600">Click</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-lg">{Math.round(step.metrics.replyRate)}%</div>
                          <div className="text-gray-600">Reply</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {/* AI Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-600" />
                AI-Generated Insights
              </CardTitle>
              <CardDescription>
                Automated analysis and recommendations for your nurturing sequences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiInsights?.insights?.map((insight: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">{insight.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                        <div className="bg-blue-50 p-3 rounded text-sm">
                          <strong>Recommendation:</strong> {insight.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {(!aiInsights?.insights || aiInsights.insights.length === 0) && (
                  <div className="text-center py-8">
                    <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No insights available yet.</p>
                    <p className="text-sm text-gray-500">
                      Insights will appear as your sequences gather more performance data.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          {aiInsights?.summary && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Top Performing Sequence:</span>
                      <span className="font-medium">{aiInsights.summary.topPerformingSequence}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average Open Rate:</span>
                      <span className="font-medium">{Math.round(aiInsights.summary.avgOpenRate)}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Average Reply Rate:</span>
                      <span className="font-medium">{Math.round(aiInsights.summary.avgReplyRate)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Active Prospects:</span>
                      <span className="font-medium">{aiInsights.summary.totalActiveProspects}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}