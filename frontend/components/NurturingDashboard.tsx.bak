import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Play, 
  Pause, 
  Copy, 
  BarChart3, 
  Users, 
  Mail, 
  Target,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useNurturing } from '../hooks/useNurturing';
import LoadingSpinner from './LoadingSpinner';
import { NurturingSequenceBuilder } from './NurturingSequenceBuilder';
import SequenceAnalyticsDashboard from './SequenceAnalyticsDashboard';
import EnrollmentManager from './EnrollmentManager';
import ContentTemplateManager from './ContentTemplateManager';

export default function NurturingDashboard() {
  const [activeTab, setActiveTab] = useState('sequences');
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [showSequenceBuilder, setShowSequenceBuilder] = useState(false);
  
  const { data: sequences, isLoading: sequencesLoading } = useNurturingSequences();

  if (sequencesLoading) {
    return <LoadingSpinner />;
  }

  const activeSequences = sequences?.filter(s => s.isActive) || [];
  const totalEnrollments = sequences?.reduce((acc, seq) => {
    // Would need to fetch enrollment counts
    return acc + 0; // Placeholder
  }, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Intelligent Nurturing</h1>
          <p className="text-muted-foreground">
            AI-powered prospect nurturing with automated follow-up sequences
          </p>
        </div>
        <Button onClick={() => setShowSequenceBuilder(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Sequence
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sequences</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSequences.length}</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnrollments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24.3%</div>
            <p className="text-xs text-muted-foreground">
              +3.2% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent Today</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground">
              Processing 43 more
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sequences" className="space-y-4">
          <SequencesList 
            sequences={sequences || []}
            onSelectSequence={setSelectedSequence}
            onCreateSequence={() => setShowSequenceBuilder(true)}
          />
        </TabsContent>
        
        <TabsContent value="analytics">
          <SequenceAnalyticsDashboard 
            sequences={sequences || []}
            selectedSequenceId={selectedSequence}
          />
        </TabsContent>
        
        <TabsContent value="enrollments">
          <EnrollmentManager 
            sequences={sequences || []}
            selectedSequenceId={selectedSequence}
          />
        </TabsContent>
        
        <TabsContent value="templates">
          <ContentTemplateManager />
        </TabsContent>
      </Tabs>

      {/* Sequence Builder Modal */}
      {showSequenceBuilder && (
        <NurturingSequenceBuilder 
          onClose={() => setShowSequenceBuilder(false)}
          onSave={() => {
            setShowSequenceBuilder(false);
            // Refresh sequences
          }}
        />
      )}
    </div>
  );
}

function SequencesList({ 
  sequences, 
  onSelectSequence, 
  onCreateSequence 
}: {
  sequences: any[];
  onSelectSequence: (id: string) => void;
  onCreateSequence: () => void;
}) {
  return (
    <div className="space-y-4">
      {sequences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Nurturing Sequences</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first AI-powered nurturing sequence to start automating prospect follow-ups.
            </p>
            <Button onClick={onCreateSequence}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Sequence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sequences.map((sequence) => (
            <SequenceCard 
              key={sequence.id}
              sequence={sequence}
              onSelect={() => onSelectSequence(sequence.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SequenceCard({ sequence, onSelect }: { sequence: any; onSelect: () => void }) {
  const { data: analytics } = useSequenceAnalytics(sequence.id);
  
  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'hot': return 'bg-red-500';
      case 'warm': return 'bg-orange-500';
      case 'nurture': return 'bg-blue-500';
      case 'cold': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'awareness': return 'bg-purple-500';
      case 'interest': return 'bg-blue-500';
      case 'consideration': return 'bg-yellow-500';
      case 'intent': return 'bg-orange-500';
      case 'evaluation': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onSelect}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg">{sequence.name}</CardTitle>
            {sequence.isActive ? (
              <Badge variant="default" className="bg-green-500">
                <Play className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Pause className="h-3 w-3 mr-1" />
                Paused
              </Badge>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="ghost" size="sm">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>{sequence.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Target Criteria */}
        <div>
          <h4 className="text-sm font-medium mb-2">Target Criteria</h4>
          <div className="flex flex-wrap gap-2">
            {sequence.targetClassification.map((classification: string) => (
              <Badge 
                key={classification} 
                variant="outline"
                className={`${getClassificationColor(classification)} text-white border-0`}
              >
                {classification}
              </Badge>
            ))}
            {sequence.targetStages.map((stage: string) => (
              <Badge 
                key={stage} 
                variant="outline"
                className={`${getStageColor(stage)} text-white border-0`}
              >
                {stage}
              </Badge>
            ))}
          </div>
        </div>

        {/* Sequence Steps */}
        <div>
          <h4 className="text-sm font-medium mb-2">Sequence ({sequence.steps.length} steps)</h4>
          <div className="flex items-center space-x-2">
            {sequence.steps.slice(0, 5).map((step: any, index: number) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  step.type === 'email' ? 'bg-blue-500 text-white' :
                  step.type === 'sms' ? 'bg-green-500 text-white' :
                  step.type === 'task' ? 'bg-orange-500 text-white' :
                  'bg-gray-500 text-white'
                }`}>
                  {step.type === 'email' ? <Mail className="h-3 w-3" /> :
                   step.type === 'sms' ? '💬' :
                   step.type === 'task' ? <CheckCircle className="h-3 w-3" /> :
                   <Clock className="h-3 w-3" />}
                </div>
                {index < Math.min(sequence.steps.length - 1, 4) && (
                  <div className="w-4 h-px bg-gray-300" />
                )}
              </div>
            ))}
            {sequence.steps.length > 5 && (
              <div className="text-xs text-muted-foreground">
                +{sequence.steps.length - 5} more
              </div>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        {analytics && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold">{analytics.totalEnrolled}</div>
              <div className="text-xs text-muted-foreground">Enrolled</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {Math.round(analytics.conversionRate * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">Conversion</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {Math.round(analytics.engagementMetrics.openRate * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">Open Rate</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}