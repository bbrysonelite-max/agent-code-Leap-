import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Brain, Target, TrendingUp, Users, Search } from 'lucide-react';
import { useNurturing } from '@/hooks/useNurturing';
import { useToast } from '@/components/ui/use-toast';

export function ProspectClassificationViewer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { classifyProspect, updateFunnelStage } = useNurturing();
  const { toast } = useToast();

  const funnelStages = [
    { value: 'awareness', label: 'Awareness', color: 'bg-gray-500' },
    { value: 'interest', label: 'Interest', color: 'bg-blue-500' },
    { value: 'consideration', label: 'Consideration', color: 'bg-yellow-500' },
    { value: 'intent', label: 'Intent', color: 'bg-orange-500' },
    { value: 'evaluation', label: 'Evaluation', color: 'bg-purple-500' },
    { value: 'purchase', label: 'Purchase', color: 'bg-green-500' }
  ];

  const handleClassifyProspect = async (prospectId: string) => {
    try {
      setLoading(true);
      await classifyProspect(prospectId);
      toast({
        title: "Success",
        description: "Prospect classified successfully"
      });
      // Refresh prospect data here
    } catch (error) {
      console.error('Failed to classify prospect:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (
    prospectId: string, 
    newStage: 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase'
  ) => {
    try {
      await updateFunnelStage(prospectId, newStage, 'Manual update');
      toast({
        title: "Success",
        description: `Prospect moved to ${newStage} stage`
      });
    } catch (error) {
      console.error('Failed to update stage:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Prospect Classification
          </h2>
          <p className="text-gray-600">AI-powered prospect analysis and funnel stage tracking</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search prospects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedStage} onValueChange={setSelectedStage}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {funnelStages.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Funnel Stage Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {funnelStages.map((stage) => (
          <Card key={stage.value} className="text-center">
            <CardContent className="pt-4">
              <div className={`w-8 h-8 rounded-full ${stage.color} mx-auto mb-2`} />
              <div className="font-medium">{stage.label}</div>
              <div className="text-2xl font-bold">
                {prospects.filter(p => p.currentStage === stage.value).length}
              </div>
              <div className="text-sm text-gray-600">prospects</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sample Prospects Data - In a real implementation, this would come from an API */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          {
            id: '1',
            name: 'John Smith',
            email: 'john@techcorp.com',
            company: 'TechCorp Inc.',
            currentStage: 'consideration',
            confidence: 85,
            engagementScore: 72,
            conversionProbability: 68,
            classifications: {
              buyer_persona: { value: 'decision_maker', confidence: 90 },
              purchase_intent: { value: 'high', confidence: 80 },
              engagement_level: { value: 'highly_engaged', confidence: 85 },
              lead_quality: { value: 'hot', confidence: 88 }
            },
            lastActivity: '2 hours ago',
            insights: ['High engagement with pricing content', 'Multiple team members involved', 'Requesting demo soon']
          },
          {
            id: '2',
            name: 'Sarah Johnson',
            email: 'sarah@startup.io',
            company: 'StartupIO',
            currentStage: 'interest',
            confidence: 75,
            engagementScore: 58,
            conversionProbability: 45,
            classifications: {
              buyer_persona: { value: 'influencer', confidence: 85 },
              purchase_intent: { value: 'medium', confidence: 70 },
              engagement_level: { value: 'moderately_engaged', confidence: 75 },
              lead_quality: { value: 'warm', confidence: 72 }
            },
            lastActivity: '1 day ago',
            insights: ['Interested in integrations', 'Budget constraints mentioned', 'Looking for Q2 implementation']
          }
        ].map((prospect) => (
          <Card key={prospect.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{prospect.name}</CardTitle>
                  <CardDescription>{prospect.company} • {prospect.email}</CardDescription>
                </div>
                <div className="text-right">
                  <Badge 
                    className={`capitalize ${
                      funnelStages.find(s => s.value === prospect.currentStage)?.color.replace('bg-', 'bg-opacity-10 text-') || ''
                    }`}
                  >
                    {prospect.currentStage}
                  </Badge>
                  <p className="text-sm text-gray-600 mt-1">{prospect.lastActivity}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scores */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-600">Engagement</div>
                  <div className="text-lg font-bold">{prospect.engagementScore}</div>
                  <Progress value={prospect.engagementScore} className="h-2" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Conversion</div>
                  <div className="text-lg font-bold">{prospect.conversionProbability}%</div>
                  <Progress value={prospect.conversionProbability} className="h-2" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Confidence</div>
                  <div className={`text-lg font-bold ${getConfidenceColor(prospect.confidence)}`}>
                    {prospect.confidence}%
                  </div>
                  <Progress value={prospect.confidence} className="h-2" />
                </div>
              </div>

              {/* Classifications */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">AI Classifications</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(prospect.classifications).map(([key, classification]) => (
                    <div key={key} className="bg-gray-50 p-2 rounded text-sm">
                      <div className="font-medium capitalize">{key.replace('_', ' ')}</div>
                      <div className="flex items-center justify-between">
                        <span className="capitalize">{classification.value.replace('_', ' ')}</span>
                        <span className={`text-xs ${getConfidenceColor(classification.confidence)}`}>
                          {classification.confidence}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">AI Insights</h4>
                <div className="space-y-1">
                  {prospect.insights.map((insight, index) => (
                    <div key={index} className="text-sm text-gray-600 flex items-start gap-2">
                      <div className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      {insight}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClassifyProspect(prospect.id)}
                  disabled={loading}
                  className="flex items-center gap-1"
                >
                  <Brain className="h-3 w-3" />
                  Reclassify
                </Button>
                <Select
                  value={prospect.currentStage}
                  onValueChange={(value: any) => handleStageUpdate(prospect.id, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {funnelStages.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        Move to {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {prospects.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Classified Prospects</h3>
              <p className="text-gray-600 mb-4">
                Start by enrolling prospects in nurturing sequences to see AI classifications.
              </p>
              <Button>
                <Target className="h-4 w-4 mr-2" />
                Enroll Prospects
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}