import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Bot, 
  Users, 
  Target, 
  TrendingUp, 
  Clock, 
  Mail, 
  MessageSquare,
  Settings,
  Play,
  Pause,
  BarChart3,
  Zap
} from 'lucide-react';
import { useNurturing } from '@/hooks/useNurturing';
import { NurturingSequenceBuilder } from './NurturingSequenceBuilder';
import { AISequenceBuilder } from './AISequenceBuilder';
import { ProspectClassificationViewer } from './ProspectClassificationViewer';
import { SequencePerformanceAnalytics } from './SequencePerformanceAnalytics';

export function IntelligentNurturingDashboard() {
  const {
    sequences,
    activeSequences,
    funnelAnalytics,
    stagnantProspects,
    loading,
    error,
    createSequence,
    enrollProspect,
    pauseSequence,
    resumeSequence
  } = useNurturing();

  const [selectedTab, setSelectedTab] = useState('overview');
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  const [showAIBuilder, setShowAIBuilder] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Bot className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading AI nurturing system...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <p className="text-red-600">Error loading nurturing dashboard: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8 text-blue-600" />
            Intelligent Nurturing
          </h1>
          <p className="text-gray-600 mt-1">
            AI-powered prospect nurturing with dynamic content generation
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowAIBuilder(true)}
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            AI Sequence Builder
          </Button>
          <Button 
            onClick={() => setShowSequenceBuilder(true)}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Create Sequence
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sequences</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSequences?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {sequences?.filter(s => s.isActive).length || 0} total sequences
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prospects in Funnel</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {funnelAnalytics?.stageDistribution?.reduce((sum, stage) => sum + stage.prospect_count, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all stages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stagnant Prospects</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stagnantProspects?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {funnelAnalytics?.conversionRates?.length > 0 
                ? Math.round(funnelAnalytics.conversionRates.reduce((sum, rate) => sum + rate.conversion_rate, 0) / funnelAnalytics.conversionRates.length)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Stage-to-stage
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="prospects">Prospect Classification</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
          <TabsTrigger value="stagnant">Stagnant Prospects</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Funnel Visualization */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Funnel Overview</CardTitle>
              <CardDescription>Prospect distribution across funnel stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {funnelAnalytics?.stageDistribution?.map((stage, index) => (
                  <div key={stage.funnel_stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="capitalize">
                        {stage.funnel_stage}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {stage.prospect_count} prospects
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={(stage.prospect_count / (funnelAnalytics?.stageDistribution?.reduce((sum, s) => sum + s.prospect_count, 0) || 1)) * 100} 
                        className="w-24" 
                      />
                      <span className="text-sm font-medium">
                        {Math.round(stage.avg_confidence)}% confidence
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sequence Activity</CardTitle>
              <CardDescription>Latest nurturing sequence executions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeSequences?.slice(0, 5).map((seq) => (
                  <div key={seq.id} className="flex items-center justify-between border-b pb-2">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium">{seq.prospectEmail}</p>
                        <p className="text-sm text-gray-600">Step {seq.currentStep + 1}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={seq.status === 'active' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {seq.status}
                      </Badge>
                      <div className="flex gap-1">
                        {seq.status === 'active' ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => pauseSequence(seq.id)}
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => resumeSequence(seq.id)}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequences" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sequences?.map((sequence) => (
              <Card key={sequence.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <Badge 
                      variant={sequence.isActive ? 'default' : 'secondary'}
                    >
                      {sequence.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardDescription>{sequence.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Steps:</span>
                      <span>{sequence.steps?.length || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Active Prospects:</span>
                      <span>
                        {activeSequences?.filter(as => as.sequenceId === sequence.id).length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Target Audience:</span>
                      <span>{Object.keys(sequence.targetAudience).join(', ')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="prospects">
          <ProspectClassificationViewer />
        </TabsContent>

        <TabsContent value="analytics">
          <SequencePerformanceAnalytics />
        </TabsContent>

        <TabsContent value="stagnant" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stagnant Prospects</CardTitle>
              <CardDescription>
                Prospects who haven't progressed in the funnel for 30+ days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stagnantProspects?.map((prospect) => (
                  <div key={prospect.prospectId} className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">
                          {prospect.prospect.firstName} {prospect.prospect.lastName}
                        </p>
                        <p className="text-sm text-gray-600">{prospect.prospect.email}</p>
                        <p className="text-sm text-gray-600">{prospect.prospect.company}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="capitalize mb-1">
                        {prospect.funnelStage}
                      </Badge>
                      <p className="text-sm text-gray-600">
                        {prospect.daysInStage} days in stage
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs">Engagement:</span>
                        <Progress value={prospect.engagementScore} className="w-16 h-2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showSequenceBuilder && (
        <NurturingSequenceBuilder
          onClose={() => setShowSequenceBuilder(false)}
          onSave={createSequence}
        />
      )}

      {showAIBuilder && (
        <AISequenceBuilder
          onClose={() => setShowAIBuilder(false)}
          onSave={createSequence}
        />
      )}
    </div>
  );
}