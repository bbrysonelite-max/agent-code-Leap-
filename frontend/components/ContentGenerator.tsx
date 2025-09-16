import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Wand2, 
  Copy, 
  RefreshCw, 
  ThumbsUp, 
  ThumbsDown,
  BarChart3,
  Clock,
  Target
} from 'lucide-react';
import { useNurturing } from '../hooks/useNurturing';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';

export function ContentGenerator() {
  const { generatePersonalizedContent, isGeneratingContent } = useNurturing();
  const { toast } = useToast();

  const [generationParams, setGenerationParams] = useState({
    prospect_id: '',
    sequence_step_id: '',
    content_variant: 'personal' as const,
    tone_preference: '',
    custom_variables: {} as Record<string, string>
  });

  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [customVariable, setCustomVariable] = useState({ key: '', value: '' });

  const handleGenerateContent = async () => {
    if (!generationParams.prospect_id.trim() || !generationParams.sequence_step_id.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide both prospect ID and sequence step ID",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await generatePersonalizedContent(
        generationParams.prospect_id,
        generationParams.sequence_step_id,
        {
          contentVariant: generationParams.content_variant,
          customVariables: generationParams.custom_variables
        }
      );
      setGeneratedContent(result);
      toast({
        title: "Content Generated",
        description: "AI-powered content has been generated successfully"
      });
    } catch (error) {
      console.error('Failed to generate content:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate personalized content",
        variant: "destructive"
      });
    }
  };

  const addCustomVariable = () => {
    if (customVariable.key.trim() && customVariable.value.trim()) {
      setGenerationParams(prev => ({
        ...prev,
        custom_variables: {
          ...prev.custom_variables,
          [customVariable.key]: customVariable.value
        }
      }));
      setCustomVariable({ key: '', value: '' });
    }
  };

  const removeCustomVariable = (key: string) => {
    setGenerationParams(prev => ({
      ...prev,
      custom_variables: Object.fromEntries(
        Object.entries(prev.custom_variables).filter(([k]) => k !== key)
      )
    }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Content copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy content to clipboard",
        variant: "destructive"
      });
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">AI Content Generator</h2>
        <p className="text-muted-foreground">
          Generate personalized, contextual content based on prospect behavior and classification
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Generation Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Content Generation Parameters</CardTitle>
            <CardDescription>
              Configure the AI content generation settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prospect-id">Prospect ID</Label>
              <Input
                id="prospect-id"
                value={generationParams.prospect_id}
                onChange={(e) => setGenerationParams(prev => ({ ...prev, prospect_id: e.target.value }))}
                placeholder="Enter prospect ID for personalization"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="step-id">Sequence Step ID</Label>
              <Input
                id="step-id"
                value={generationParams.sequence_step_id}
                onChange={(e) => setGenerationParams(prev => ({ ...prev, sequence_step_id: e.target.value }))}
                placeholder="Enter sequence step ID for context"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content-variant">Content Variant</Label>
              <Select 
                value={generationParams.content_variant} 
                onValueChange={(value) => setGenerationParams(prev => ({ ...prev, content_variant: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="promotional">Promotional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone Preference (Optional)</Label>
              <Input
                id="tone"
                value={generationParams.tone_preference}
                onChange={(e) => setGenerationParams(prev => ({ ...prev, tone_preference: e.target.value }))}
                placeholder="e.g., enthusiastic, empathetic, urgent"
              />
            </div>

            {/* Custom Variables */}
            <div className="space-y-2">
              <Label>Custom Variables</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Variable name"
                    value={customVariable.key}
                    onChange={(e) => setCustomVariable(prev => ({ ...prev, key: e.target.value }))}
                  />
                  <Input
                    placeholder="Variable value"
                    value={customVariable.value}
                    onChange={(e) => setCustomVariable(prev => ({ ...prev, value: e.target.value }))}
                  />
                  <Button onClick={addCustomVariable} size="sm">
                    Add
                  </Button>
                </div>

                {Object.entries(generationParams.custom_variables).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(generationParams.custom_variables).map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="gap-1">
                        {key}: {value}
                        <button
                          onClick={() => removeCustomVariable(key)}
                          className="ml-1 text-xs hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button 
              onClick={handleGenerateContent}
              disabled={isGeneratingContent || !generationParams.prospect_id.trim() || !generationParams.sequence_step_id.trim()}
              className="w-full"
            >
              {isGeneratingContent ? (
                <LoadingSpinner className="w-4 h-4 mr-2" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              Generate AI Content
            </Button>
          </CardContent>
        </Card>

        {/* Generated Content */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
            <CardDescription>
              AI-generated personalized content based on your parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!generatedContent ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No content generated yet. Configure parameters and click "Generate AI Content" to start.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Content Output */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Generated Content</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedContent.content)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <Textarea
                    value={generatedContent.content}
                    readOnly
                    rows={8}
                    className="resize-none"
                  />
                </div>

                {/* Quality Metrics */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label>Quality Metrics</Label>
                    {Object.entries(generatedContent.quality_metrics).map(([metric, value]) => (
                      <div key={metric} className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground capitalize">
                          {metric.replace('_', ' ')}
                        </span>
                        <span className={`text-sm font-medium ${
                          typeof value === 'number' && value <= 1 
                            ? getQualityColor(value) 
                            : 'text-foreground'
                        }`}>
                          {typeof value === 'number' && value <= 1 
                            ? `${(value * 100).toFixed(1)}%`
                            : value
                          }
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <Label>Personalization Data</Label>
                    <div className="space-y-2">
                      {Object.entries(generatedContent.personalization_data).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">{key}</span>
                          <Badge variant="outline" className="text-xs">
                            {String(value).slice(0, 20)}{String(value).length > 20 ? '...' : ''}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Insights */}
                {generatedContent.ai_insights?.length > 0 && (
                  <div className="space-y-2">
                    <Label>AI Insights</Label>
                    <div className="space-y-2">
                      {generatedContent.ai_insights.map((insight: string, index: number) => (
                        <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                          <Brain className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-blue-700 dark:text-blue-300">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                  <Button variant="outline" size="sm">
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Good
                  </Button>
                  <Button variant="outline" size="sm">
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Needs Work
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Optimization Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Content Optimization Tips</CardTitle>
          <CardDescription>
            Best practices for generating high-quality, personalized content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Personalization</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Use custom variables and prospect-specific data to make content more relevant and engaging.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-500" />
                <span className="font-medium">Quality Metrics</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitor quality and relevance scores to ensure content meets high standards for engagement.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="font-medium">Context Timing</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Consider the prospect's current funnel stage and recent behavior for optimal timing and messaging.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}