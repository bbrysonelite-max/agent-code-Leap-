import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  Mail, 
  Target, 
  Zap, 
  Eye, 
  BarChart3, 
  Settings, 
  Play, 
  Pause, 
  Plus,
  Bot,
  TestTube,
  Clock,
  MessageSquare
} from 'lucide-react';
import backend from '~backend/client';

interface DashboardData {
  stats: {
    total_sequences: number;
    total_enrollments: number;
    active_enrollments: number;
    completed_enrollments: number;
    avg_engagement_score: number;
    overall_open_rate: number;
    overall_reply_rate: number;
  };
  top_sequences: Array<{
    id: number;
    name: string;
    classification_target: string;
    stage_target: string;
    enrollments: number;
    completions: number;
    avg_engagement: number;
    reply_rate: number;
  }>;
  recent_activity: Array<{
    behavior_type: string;
    engagement_score: number;
    created_at: string;
    activity_type: string;
  }>;
  engagement_trends: Array<{
    date: string;
    total_behaviors: number;
    avg_score: number;
    unique_prospects: number;
  }>;
}

interface Sequence {
  id: number;
  name: string;
  classification_target: string;
  stage_target: string;
  total_steps: number;
  is_active: boolean;
  performance_score: number;
  conversion_rate: number;
  created_by_ai: boolean;
  enrollment_count: number;
  avg_engagement: number;
}

interface EngagementProfile {
  id: number;
  prospect_id: number;
  total_score: number;
  email_engagement_score: number;
  content_engagement_score: number;
  response_rate: number;
  preferred_content_type?: string;
  engagement_trend: string;
  last_engagement_at?: string;
}

function IntelligentNurturingDashboard() {
  const [clientId] = useState(1); // This would come from auth context
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
    loadSequences();
  }, []);

  const loadDashboardData = async () => {
    try {
      const data = await backend.nurturing.getNurturingDashboard({ client_id: clientId });
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const loadSequences = async () => {
    try {
      const data = await backend.nurturing.listSequences({ client_id: clientId });
      setSequences(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load sequences:', error);
      setLoading(false);
    }
  };

  const generateAISequence = async (classification: string, stage: string) => {
    try {
      setLoading(true);
      const newSequence = await backend.nurturing.generateAISequence({
        client_id: clientId,
        prospect_data: { classification, stage },
        classification: classification as any,
        stage: stage as any,
        sequence_length: 5
      });
      await loadSequences();
      setLoading(false);
    } catch (error) {
      console.error('Failed to generate AI sequence:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-blue-600" />
            Intelligent Nurturing
          </h1>
          <p className="text-muted-foreground">
            AI-powered prospect nurturing with behavioral analysis and dynamic sequencing
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Sequence
        </Button>
      </div>

      {/* Key Metrics */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Enrollments</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.stats.active_enrollments}</div>
              <p className="text-xs text-muted-foreground">
                {dashboardData.stats.total_enrollments} total enrollments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.stats.avg_engagement_score?.toFixed(1) || '0'}
              </div>
              <p className="text-xs text-muted-foreground">Out of 100 points</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.stats.overall_open_rate?.toFixed(1) || '0'}%
              </div>
              <p className="text-xs text-muted-foreground">All sequences combined</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.stats.overall_reply_rate?.toFixed(1) || '0'}%
              </div>
              <p className="text-xs text-muted-foreground">Conversion indicator</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="behavior">Behavior Analysis</TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Top Performing Sequences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Top Performing Sequences
              </CardTitle>
              <CardDescription>
                Best converting sequences based on reply rates and engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData?.top_sequences.map((sequence) => (
                  <div key={sequence.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{sequence.name}</h3>
                        <Badge variant="outline">
                          {sequence.classification_target}/{sequence.stage_target}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {sequence.enrollments} enrollments • {sequence.completions} completed
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-lg font-semibold text-green-600">
                        {sequence.reply_rate?.toFixed(1) || '0'}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Engagement: {sequence.avg_engagement?.toFixed(1) || '0'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData?.recent_activity.slice(0, 10).map((activity, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.activity_type === 'behavior' ? 'bg-blue-500' : 'bg-green-500'
                      }`} />
                      <span className="text-sm">
                        {activity.behavior_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {activity.engagement_score} pts
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequences" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Nurturing Sequences</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => generateAISequence('warm', 'interest')}>
                <Bot className="h-4 w-4 mr-2" />
                Generate AI Sequence
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sequences.map((sequence) => (
              <Card key={sequence.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {sequence.created_by_ai && (
                        <Badge variant="secondary">
                          <Bot className="h-3 w-3 mr-1" />
                          AI Generated
                        </Badge>
                      )}
                      <Badge variant={sequence.is_active ? "default" : "secondary"}>
                        {sequence.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    {sequence.classification_target} prospects in {sequence.stage_target} stage
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Steps:</span>
                      <div className="font-medium">{sequence.total_steps}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Enrollments:</span>
                      <div className="font-medium">{sequence.enrollment_count || 0}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Performance:</span>
                      <div className="font-medium">{sequence.performance_score?.toFixed(1) || '0'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Conversion:</span>
                      <div className="font-medium">{sequence.conversion_rate?.toFixed(1) || '0'}%</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Button variant="outline" size="sm" onClick={() => setSelectedSequence(sequence.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={!sequence.is_active}
                    >
                      {sequence.is_active ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6">
          <BehaviorAnalysisTab clientId={clientId} />
        </TabsContent>

        <TabsContent value="ab-testing" className="space-y-6">
          <ABTestingTab clientId={clientId} sequences={sequences} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsTab clientId={clientId} dashboardData={dashboardData} />
        </TabsContent>
      </Tabs>

      {/* Create Sequence Dialog */}
      <CreateSequenceDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        clientId={clientId}
        onSequenceCreated={loadSequences}
      />
    </div>
  );
}

function BehaviorAnalysisTab({ clientId }: { clientId: number }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [selectedProspect, setSelectedProspect] = useState<number | null>(null);
  const [prospectProfile, setProspectProfile] = useState<EngagementProfile | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const data = await backend.nurturing.getEngagementAnalytics({ client_id: clientId });
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const analyzeProspect = async (prospectId: number) => {
    try {
      const profile = await backend.nurturing.getEngagementProfile({ prospect_id: prospectId });
      setProspectProfile(profile);
      setSelectedProspect(prospectId);
    } catch (error) {
      console.error('Failed to analyze prospect:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Engagement Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{analytics.summary.total_active_prospects}</div>
                <div className="text-sm text-muted-foreground">Active Prospects</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{analytics.summary.avg_engagement_score?.toFixed(1) || '0'}</div>
                <div className="text-sm text-muted-foreground">Avg Engagement</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{analytics.summary.total_behaviors_tracked}</div>
                <div className="text-sm text-muted-foreground">Total Behaviors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{analytics.summary.behaviors_last_week}</div>
                <div className="text-sm text-muted-foreground">This Week</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Engagement Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Trends (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Chart visualization would go here
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ABTestingTab({ clientId, sequences }: { clientId: number; sequences: Sequence[] }) {
  const [activeTests, setActiveTests] = useState<any[]>([]);

  useEffect(() => {
    loadActiveTests();
  }, []);

  const loadActiveTests = async () => {
    // Implementation for loading A/B tests
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            A/B Testing
          </CardTitle>
          <CardDescription>
            Optimize your sequences with data-driven testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create New Test
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsTab({ clientId, dashboardData }: { clientId: number; dashboardData: DashboardData | null }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Engagement Trends */}
            <div>
              <h3 className="font-medium mb-4">Daily Engagement Trends</h3>
              <div className="space-y-2">
                {dashboardData?.engagement_trends.slice(0, 7).map((trend, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{new Date(trend.date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{trend.total_behaviors} behaviors</span>
                      <Badge variant="outline">{trend.avg_score.toFixed(1)} avg</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div>
              <h3 className="font-medium mb-4">Key Metrics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Overall Open Rate</span>
                    <span>{dashboardData?.stats.overall_open_rate?.toFixed(1) || '0'}%</span>
                  </div>
                  <Progress value={dashboardData?.stats.overall_open_rate || 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Overall Reply Rate</span>
                    <span>{dashboardData?.stats.overall_reply_rate?.toFixed(1) || '0'}%</span>
                  </div>
                  <Progress value={dashboardData?.stats.overall_reply_rate || 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Completion Rate</span>
                    <span>
                      {dashboardData?.stats.completed_enrollments && dashboardData?.stats.total_enrollments
                        ? ((dashboardData.stats.completed_enrollments / dashboardData.stats.total_enrollments) * 100).toFixed(1)
                        : '0'}%
                    </span>
                  </div>
                  <Progress 
                    value={dashboardData?.stats.completed_enrollments && dashboardData?.stats.total_enrollments
                      ? (dashboardData.stats.completed_enrollments / dashboardData.stats.total_enrollments) * 100
                      : 0} 
                    className="h-2" 
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateSequenceDialog({ 
  open, 
  onOpenChange, 
  clientId, 
  onSequenceCreated 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  clientId: number;
  onSequenceCreated: () => void;
}) {
  const [useAI, setUseAI] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleCreateSequence = async () => {
    setLoading(true);
    try {
      if (useAI) {
        await backend.nurturing.generateAISequence({
          client_id: clientId,
          prospect_data: {},
          classification: 'warm',
          stage: 'interest',
          sequence_length: 5
        });
      }
      onSequenceCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create sequence:', error);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Nurturing Sequence</DialogTitle>
          <DialogDescription>
            Create a new AI-powered nurturing sequence to engage your prospects
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              checked={useAI} 
              onChange={(e) => setUseAI(e.target.checked)}
              className="rounded"
            />
            <label className="text-sm">Use AI to generate sequence content</label>
          </div>
          <Button onClick={handleCreateSequence} disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create Sequence'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { IntelligentNurturingDashboard };
export default IntelligentNurturingDashboard;