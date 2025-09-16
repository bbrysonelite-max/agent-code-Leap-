import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target, 
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useNurturing } from '../hooks/useNurturing';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';

export function ProspectClassificationView() {
  const { analyzeProspectBehavior, isAnalyzing } = useNurturing();
  const { toast } = useToast();
  
  const [prospectId, setProspectId] = useState('');
  const [classificationResult, setClassificationResult] = useState<any>(null);

  const handleAnalyzeProspect = async () => {
    if (!prospectId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a prospect ID",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await analyzeProspectBehavior(prospectId);
      setClassificationResult(result);
      toast({
        title: "Analysis Complete",
        description: "Prospect behavior analysis completed successfully"
      });
    } catch (error) {
      console.error('Failed to analyze prospect:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze prospect behavior",
        variant: "destructive"
      });
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'hot': return 'destructive';
      case 'warm': return 'default';
      case 'cold': return 'secondary';
      case 'unengaged': return 'outline';
      default: return 'outline';
    }
  };

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'very_high': return 'text-green-600';
      case 'high': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-orange-500';
      case 'very_low': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Prospect Classification</h2>
        <p className="text-muted-foreground">
          AI-powered behavior analysis and prospect classification
        </p>
      </div>

      {/* Analysis Input */}
      <Card>
        <CardHeader>
          <CardTitle>Analyze Prospect</CardTitle>
          <CardDescription>
            Enter a prospect ID to analyze their behavior and get AI-powered classification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter prospect ID"
                value={prospectId}
                onChange={(e) => setProspectId(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAnalyzeProspect}
              disabled={isAnalyzing || !prospectId.trim()}
            >
              {isAnalyzing ? (
                <LoadingSpinner className="w-4 h-4 mr-2" />
              ) : (
                <Brain className="w-4 h-4 mr-2" />
              )}
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Classification Results */}
      {classificationResult && (
        <div className="space-y-6">
          {/* Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Classification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge 
                    variant={getClassificationColor(classificationResult.classification.classification)}
                    className="text-lg px-3 py-1"
                  >
                    {classificationResult.classification.classification.toUpperCase()}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    Confidence: {(classificationResult.classification.confidence_score * 100).toFixed(1)}%
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Funnel Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {classificationResult.classification.funnel_stage.replace('_', ' ')}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    Close Probability: {(classificationResult.classification.estimated_close_probability * 100).toFixed(1)}%
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Engagement Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className={`text-lg font-semibold ${getEngagementColor(classificationResult.classification.engagement_level)}`}>
                    {classificationResult.classification.engagement_level.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Predicted Revenue: ${classificationResult.classification.predicted_revenue.toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Engagement Pattern */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Pattern Analysis</CardTitle>
              <CardDescription>
                Behavioral insights and interaction patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Pattern Type</span>
                      <Badge variant="outline">
                        {classificationResult.engagement_pattern.pattern_type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Frequency Score</span>
                      <span className="text-sm text-muted-foreground">
                        {classificationResult.engagement_pattern.frequency_score.toFixed(1)}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, classificationResult.engagement_pattern.frequency_score)} 
                      className="h-2" 
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Confidence Score</span>
                      <span className="text-sm text-muted-foreground">
                        {(classificationResult.engagement_pattern.confidence_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={classificationResult.engagement_pattern.confidence_score * 100} 
                      className="h-2" 
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium">Preferred Channels</span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {classificationResult.engagement_pattern.preferred_channels?.map((channel: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {channel.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm font-medium">Optimal Timing</span>
                    <div className="mt-1">
                      <Badge variant="outline">
                        {classificationResult.engagement_pattern.optimal_timing?.replace('_', ' ') || 'Not determined'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium">Description</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {classificationResult.engagement_pattern.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights and Recommendations */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>AI Insights</CardTitle>
                <CardDescription>
                  Key behavioral observations and patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {classificationResult.ai_insights?.map((insight: string, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <Brain className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{insight}</span>
                    </div>
                  ))}
                  
                  {classificationResult.engagement_pattern.ai_insights?.map((insight: string, index: number) => (
                    <div key={`pattern-${index}`} className="flex items-start gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{insight}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Best Actions</CardTitle>
                <CardDescription>
                  AI-recommended actions for this prospect
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {classificationResult.next_best_actions?.map((action: string, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{action}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommended Sequences */}
          {classificationResult.recommended_sequences?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommended Nurturing Sequences</CardTitle>
                <CardDescription>
                  Sequences that match this prospect's classification and stage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {classificationResult.recommended_sequences.map((sequenceId: string, index: number) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Sequence {sequenceId.slice(-8)}</span>
                        <Button size="sm" variant="outline">
                          Enroll
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Optimized for {classificationResult.classification.classification} prospects
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Classification Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Analysis</CardTitle>
              <CardDescription>
                Complete classification data and reasoning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-sm font-medium">AI Reasoning</span>
                <p className="text-sm text-muted-foreground mt-1">
                  {classificationResult.classification.ai_reasoning}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <span className="text-sm font-medium">Behavioral Indicators</span>
                  <div className="mt-2 space-y-1">
                    {classificationResult.classification.behavioral_indicators?.map((indicator: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-sm text-muted-foreground">{indicator}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium">Classification Expires</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {new Date(classificationResult.classification.classification_expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Classification will be automatically re-evaluated after this date
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}