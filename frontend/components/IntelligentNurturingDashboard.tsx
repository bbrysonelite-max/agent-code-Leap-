import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  Brain,
  Target,
  TrendingUp,
  Users,
  MessageSquare,
  Clock,
  BarChart3,
  Zap,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Lightbulb,
  ArrowRight,
  Calendar,
  Activity
} from 'lucide-react';
import backend from '~backend/client';

interface EngagementAnalysis {
  prospectId: string;
  behaviorSignals: BehaviorSignal[];
  engagementScore: number;
  intentLevel: 'low' | 'medium' | 'high' | 'urgent';
  nextBestAction: string;
  optimalTiming: OptimalTiming;
  contentPreferences: ContentPreference[];
  predictedChurn: ChurnPrediction;
  sequenceRecommendations: SequenceRecommendation[];
}

interface BehaviorSignal {
  type: string;
  strength: number;
  recency: number;
  frequency: number;
  context: Record<string, any>;
  score: number;
}

interface OptimalTiming {
  preferredDays: string[];
  preferredHours: number[];
  timezone: string;
  responseWindow: number;
  confidence: number;
}

interface ContentPreference {
  type: string;
  engagement: number;
  conversion: number;
  topics: string[];
  format: string;
}

interface ChurnPrediction {
  riskLevel: 'low' | 'medium' | 'high';
  probability: number;
  factors: string[];
  timeframe: number;
}

interface SequenceRecommendation {
  sequenceId: string;
  priority: number;
  reasoning: string;
  expectedOutcome: string;
  confidence: number;
}

interface IntelligentSequence {
  id: string;
  name: string;
  description: string;
  aiOptimized: boolean;
  adaptiveScheduling: boolean;
  targetPersonas: string[];
  performance: SequencePerformance;
  aiInsights: SequenceAIInsights;
}

interface SequencePerformance {
  totalEnrolled: number;
  activeEnrollments: number;
  completionRate: number;
  conversionRate: number;
  avgTimeToConversion: number;
  stepDropoffRates: number[];
  aiOptimizationLift: number;
}

interface SequenceAIInsights {
  performanceInsights: string[];
  optimizationRecommendations: string[];
  contentRecommendations: string[];
  timingRecommendations: string[];
  audienceInsights: string[];
}

interface PersonalizedFollowUp {
  id: string;
  prospectId: string;
  triggerEvent: string;
  followUpType: 'immediate' | 'delayed' | 'strategic' | 'recovery';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  aiGenerated: boolean;
  personalizationLevel: number;
  content: {
    subject?: string;
    message: string;
    callToAction: string;
    personalizedElements: any[];
  };
  timing: {
    scheduledFor: Date;
    optimalWindow: {
      start: Date;
      end: Date;
      confidence: number;
      reasoning: string;
    };
  };
  status: string;
}

export default function IntelligentNurturingDashboard() {
  const [activeProspects, setActiveProspects] = useState<any[]>([]);
  const [sequences, setSequences] = useState<IntelligentSequence[]>([]);
  const [followUps, setFollowUps] = useState<PersonalizedFollowUp[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<string | null>(null);
  const [engagementAnalysis, setEngagementAnalysis] = useState<EngagementAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load active prospects and sequences
      const [prospectsData, sequencesData] = await Promise.all([
        backend.nurturing.getActiveProspects(),
        backend.nurturing.getIntelligentSequences()
      ]);

      setActiveProspects(prospectsData || []);
      setSequences(sequencesData || []);
      
      // Load recent follow-ups
      const followUpsData = await backend.nurturing.getRecentFollowUps();
      setFollowUps(followUpsData || []);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load nurturing dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeProspectBehavior = async (prospectId: string) => {
    try {
      setLoading(true);
      const analysis = await backend.nurturing.analyzeAdvancedBehavior({ prospectId });
      setEngagementAnalysis(analysis);
      setSelectedProspect(prospectId);
      
      toast({
        title: "Analysis Complete",
        description: `Generated insights for prospect with ${analysis.engagementScore}/100 engagement score`
      });
    } catch (error) {
      console.error('Failed to analyze prospect:', error);
      toast({
        title: "Analysis Failed",
        description: "Could not analyze prospect behavior",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const optimizeSequence = async (sequenceId: string) => {
    try {
      setOptimizing(true);
      const result = await backend.nurturing.optimizeSequencePerformance({ sequenceId });
      
      toast({
        title: "Optimization Complete",
        description: `Implemented ${result.implementedChanges} optimizations with ${Math.round(result.expectedImprovement * 100)}% expected improvement`
      });
      
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to optimize sequence:', error);
      toast({
        title: "Optimization Failed",
        description: "Could not optimize sequence",
        variant: "destructive"
      });
    } finally {
      setOptimizing(false);
    }
  };

  const createPersonalizedFollowUp = async (prospectId: string, triggerEvent: string) => {
    try {
      await backend.nurturing.createPersonalizedFollowUp({
        prospectId,
        triggerEvent,
        urgency: 'medium'
      });
      
      toast({
        title: "Follow-up Created",
        description: "AI-powered personalized follow-up has been scheduled"
      });
      
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to create follow-up:', error);
      toast({
        title: "Failed",
        description: "Could not create personalized follow-up",
        variant: "destructive"
      });
    }
  };

  const getIntentLevelColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getChurnRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Intelligent Nurturing
          </h1>
          <p className="text-muted-foreground">
            AI-powered prospect engagement and sequence optimization
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadDashboardData}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Prospects</p>
                <p className="text-2xl font-bold">{activeProspects.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">AI Sequences</p>
                <p className="text-2xl font-bold">{sequences.length}</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Follow-ups Today</p>
                <p className="text-2xl font-bold">{followUps.length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response Rate</p>
                <p className="text-2xl font-bold">18.5%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="prospects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prospects">AI Prospect Analysis</TabsTrigger>
          <TabsTrigger value="sequences">Intelligent Sequences</TabsTrigger>
          <TabsTrigger value="followups">Personalized Follow-ups</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="prospects" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prospect List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Active Prospects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeProspects.map((prospect) => (
                    <div 
                      key={prospect.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => analyzeProspectBehavior(prospect.id)}
                    >
                      <div>
                        <p className="font-medium">{prospect.name}</p>
                        <p className="text-sm text-muted-foreground">{prospect.company}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getIntentLevelColor(prospect.intentLevel || 'low')}>
                          {prospect.intentLevel || 'unknown'}
                        </Badge>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Engagement Analysis */}
            {engagementAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Behavior Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Engagement Score</span>
                    <span className="text-2xl font-bold">{engagementAnalysis.engagementScore}/100</span>
                  </div>
                  <Progress value={engagementAnalysis.engagementScore} className="w-full" />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Intent Level</p>
                      <Badge variant={getIntentLevelColor(engagementAnalysis.intentLevel)}>
                        {engagementAnalysis.intentLevel}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Churn Risk</p>
                      <Badge variant={getChurnRiskColor(engagementAnalysis.predictedChurn.riskLevel)}>
                        {engagementAnalysis.predictedChurn.riskLevel}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Next Best Action</p>
                    <p className="text-sm bg-accent p-3 rounded-lg">
                      {engagementAnalysis.nextBestAction}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Optimal Timing</p>
                    <div className="text-sm space-y-1">
                      <p>Days: {engagementAnalysis.optimalTiming.preferredDays.join(', ')}</p>
                      <p>Hours: {engagementAnalysis.optimalTiming.preferredHours.join(', ')}</p>
                      <p>Confidence: {Math.round(engagementAnalysis.optimalTiming.confidence * 100)}%</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => createPersonalizedFollowUp(engagementAnalysis.prospectId, 'ai_analysis')}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Create Follow-up
                    </Button>
                    <Button size="sm" variant="outline">
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule Demo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sequences" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {sequences.map((sequence) => (
              <Card key={sequence.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {sequence.aiOptimized && <Zap className="h-4 w-4 text-yellow-500" />}
                      {sequence.name}
                    </CardTitle>
                    <Badge variant={sequence.aiOptimized ? "default" : "outline"}>
                      {sequence.aiOptimized ? "AI Optimized" : "Standard"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{sequence.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Active</p>
                      <p className="font-medium">{sequence.performance.activeEnrollments}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conversion Rate</p>
                      <p className="font-medium">{Math.round(sequence.performance.conversionRate * 100)}%</p>
                    </div>
                  </div>

                  {sequence.aiOptimized && (
                    <div className="bg-accent p-3 rounded-lg">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        AI Optimization Lift: +{Math.round(sequence.performance.aiOptimizationLift * 100)}%
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">AI Insights</p>
                    <div className="space-y-1">
                      {sequence.aiInsights.optimizationRecommendations.slice(0, 2).map((insight, index) => (
                        <p key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                          <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {insight}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => optimizeSequence(sequence.id)}
                      disabled={optimizing}
                    >
                      {optimizing ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                      Optimize
                    </Button>
                    <Button size="sm" variant="outline">
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="followups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Personalized Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {followUps.map((followUp) => (
                  <div key={followUp.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium">{followUp.content.subject || 'No Subject'}</p>
                        <p className="text-sm text-muted-foreground">
                          Prospect: {followUp.prospectId} • Trigger: {followUp.triggerEvent}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={followUp.priority === 'urgent' ? 'destructive' : 'default'}>
                          {followUp.priority}
                        </Badge>
                        <Badge variant="outline">{followUp.followUpType}</Badge>
                        {followUp.aiGenerated && (
                          <Badge variant="secondary">
                            <Brain className="h-3 w-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="bg-accent p-3 rounded text-sm mb-3">
                      {followUp.content.message.substring(0, 200)}...
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(followUp.timing.scheduledFor).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          Personalization: {followUp.personalizationLevel}/10
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Play className="h-4 w-4" />
                          Send Now
                        </Button>
                        <Button size="sm" variant="outline">
                          <Pause className="h-4 w-4" />
                          Pause
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Performance Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">AI optimization increased response rates by 23%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Optimal send times: Tuesday-Thursday, 10-11 AM</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Personalized subject lines perform 35% better</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">High-intent prospects respond 2.3x faster</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Real-time Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">94%</p>
                    <p className="text-sm text-muted-foreground">Delivery Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-500">31%</p>
                    <p className="text-sm text-muted-foreground">Open Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-500">8.2%</p>
                    <p className="text-sm text-muted-foreground">Click Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-500">3.1%</p>
                    <p className="text-sm text-muted-foreground">Conversion Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}