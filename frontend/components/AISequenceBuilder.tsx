import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  Brain,
  Zap,
  Plus,
  Trash2,
  Settings,
  Clock,
  Target,
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  BarChart3,
  Lightbulb,
  ArrowDown,
  ArrowRight,
  Play,
  Save,
  Eye,
  Shuffle
} from 'lucide-react';
import backend from '~backend/client';

interface SequenceStep {
  id: string;
  stepNumber: number;
  type: 'email' | 'sms' | 'call' | 'task' | 'wait' | 'ai_decision';
  conditions: StepCondition[];
  adaptiveContent: boolean;
  dynamicTiming: boolean;
  fallbackActions: FallbackAction[];
  aiPersonalization: AIPersonalizationSettings;
  branchingLogic: BranchingRule[];
  content?: {
    template: string;
    subject?: string;
    variables: string[];
  };
  timing?: {
    delayDays: number;
    delayHours: number;
    dynamicOptimization: boolean;
  };
}

interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: string;
}

interface FallbackAction {
  trigger: string;
  action: 'retry' | 'skip' | 'escalate' | 'alternative_content';
  delay: number;
  maxAttempts: number;
}

interface AIPersonalizationSettings {
  enabled: boolean;
  contentAdaptation: boolean;
  timingOptimization: boolean;
  channelSelection: boolean;
  abTestVariants: boolean;
}

interface BranchingRule {
  condition: string;
  targetStepNumber?: number;
  targetSequenceId?: string;
  waitDays?: number;
  action: 'continue' | 'skip' | 'branch' | 'exit';
}

interface SequenceTrigger {
  type: 'behavior' | 'classification_change' | 'time_based' | 'manual' | 'ai_recommendation';
  criteria: Record<string, any>;
  priority: number;
  active: boolean;
}

interface ExitCondition {
  type: 'goal_achieved' | 'negative_response' | 'churn_risk' | 'manual' | 'ai_exit';
  criteria: Record<string, any>;
  action: 'pause' | 'complete' | 'transfer_sequence';
  targetSequenceId?: string;
}

interface AIRecommendation {
  type: 'content' | 'timing' | 'channel' | 'branching';
  recommendation: string;
  confidence: number;
  reasoning: string;
  impact: 'low' | 'medium' | 'high';
}

export default function AISequenceBuilder() {
  const [sequenceName, setSequenceName] = useState('');
  const [sequenceDescription, setSequenceDescription] = useState('');
  const [aiOptimized, setAiOptimized] = useState(true);
  const [adaptiveScheduling, setAdaptiveScheduling] = useState(true);
  const [targetPersonas, setTargetPersonas] = useState<string[]>([]);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [entryTriggers, setEntryTriggers] = useState<SequenceTrigger[]>([]);
  const [exitConditions, setExitConditions] = useState<ExitCondition[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    generateAIRecommendations();
  }, [steps, targetPersonas]);

  const generateAIRecommendations = async () => {
    if (steps.length === 0 || !aiOptimized) return;

    try {
      // Simulate AI recommendations based on current sequence
      const recommendations = await generateSequenceRecommendations();
      setAiRecommendations(recommendations);
    } catch (error) {
      console.error('Failed to generate AI recommendations:', error);
    }
  };

  const generateSequenceRecommendations = async (): Promise<AIRecommendation[]> => {
    // Simulate AI analysis
    return [
      {
        type: 'timing',
        recommendation: 'Add 2-day delay between email steps for optimal engagement',
        confidence: 0.85,
        reasoning: 'Analysis shows 23% higher response rates with this timing',
        impact: 'high'
      },
      {
        type: 'content',
        recommendation: 'Include social proof in step 3 for enterprise personas',
        confidence: 0.78,
        reasoning: 'Enterprise prospects respond 31% better to case studies',
        impact: 'medium'
      },
      {
        type: 'branching',
        recommendation: 'Add AI decision point after step 2 based on engagement',
        confidence: 0.92,
        reasoning: 'Dynamic branching improves conversion by 18%',
        impact: 'high'
      }
    ];
  };

  const addStep = (type: SequenceStep['type']) => {
    const newStep: SequenceStep = {
      id: `step_${Date.now()}`,
      stepNumber: steps.length + 1,
      type,
      conditions: [],
      adaptiveContent: aiOptimized,
      dynamicTiming: adaptiveScheduling,
      fallbackActions: [],
      aiPersonalization: {
        enabled: aiOptimized,
        contentAdaptation: true,
        timingOptimization: true,
        channelSelection: false,
        abTestVariants: aiOptimized
      },
      branchingLogic: [],
      content: type !== 'wait' && type !== 'ai_decision' ? {
        template: '',
        subject: type === 'email' ? '' : undefined,
        variables: []
      } : undefined,
      timing: {
        delayDays: 1,
        delayHours: 0,
        dynamicOptimization: adaptiveScheduling
      }
    };

    setSteps([...steps, newStep]);
  };

  const updateStep = (stepId: string, updates: Partial<SequenceStep>) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const deleteStep = (stepId: string) => {
    const newSteps = steps.filter(step => step.id !== stepId);
    // Renumber steps
    const renumberedSteps = newSteps.map((step, index) => ({
      ...step,
      stepNumber: index + 1
    }));
    setSteps(renumberedSteps);
  };

  const generateAIContent = async (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    setIsGeneratingAI(true);
    try {
      const content = await backend.nurturing.generateAIContent({
        contentType: step.type as any,
        classification: 'warm',
        stage: 'consideration',
        context: {
          stepNumber: step.stepNumber,
          sequenceName,
          targetPersonas
        }
      });

      updateStep(stepId, {
        content: {
          template: content.content,
          subject: content.subject,
          variables: extractVariables(content.content)
        }
      });

      toast({
        title: "AI Content Generated",
        description: `Generated personalized content for step ${step.stepNumber}`
      });
    } catch (error) {
      console.error('Failed to generate AI content:', error);
      toast({
        title: "Generation Failed",
        description: "Could not generate AI content",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const optimizeSequenceTiming = async () => {
    setIsGeneratingAI(true);
    try {
      // Simulate AI timing optimization
      const optimizedSteps = steps.map(step => ({
        ...step,
        timing: {
          ...step.timing!,
          delayDays: Math.max(1, step.timing!.delayDays * 1.2), // AI recommends longer delays
          dynamicOptimization: true
        }
      }));

      setSteps(optimizedSteps);
      
      toast({
        title: "Timing Optimized",
        description: "AI has optimized sequence timing for better engagement"
      });
    } catch (error) {
      console.error('Failed to optimize timing:', error);
      toast({
        title: "Optimization Failed",
        description: "Could not optimize sequence timing",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const saveSequence = async () => {
    if (!sequenceName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a sequence name",
        variant: "destructive"
      });
      return;
    }

    if (steps.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one step to the sequence",
        variant: "destructive"
      });
      return;
    }

    try {
      await backend.nurturing.createIntelligentSequence({
        name: sequenceName,
        description: sequenceDescription,
        targetPersonas,
        steps: steps.map(({ id, ...step }) => step),
        entryTriggers,
        exitConditions,
        aiOptimized
      });

      toast({
        title: "Sequence Saved",
        description: `${sequenceName} has been created successfully`
      });

      // Reset form
      setSequenceName('');
      setSequenceDescription('');
      setSteps([]);
      setTargetPersonas([]);
      setEntryTriggers([]);
      setExitConditions([]);
    } catch (error) {
      console.error('Failed to save sequence:', error);
      toast({
        title: "Save Failed",
        description: "Could not save the sequence",
        variant: "destructive"
      });
    }
  };

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/{{(\w+)}}/g);
    return matches ? matches.map(match => match.slice(2, -2)) : [];
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'task': return <Calendar className="h-4 w-4" />;
      case 'wait': return <Clock className="h-4 w-4" />;
      case 'ai_decision': return <Brain className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Sequence Builder
          </h1>
          <p className="text-muted-foreground">
            Create intelligent nurturing sequences powered by AI
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
          <Button onClick={saveSequence}>
            <Save className="h-4 w-4 mr-2" />
            Save Sequence
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* AI Recommendations Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiRecommendations.map((rec, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={rec.impact === 'high' ? 'default' : 'secondary'}>
                      {rec.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(rec.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-1">{rec.recommendation}</p>
                  <p className="text-xs text-muted-foreground">{rec.reasoning}</p>
                  <Button size="sm" variant="outline" className="w-full mt-2">
                    Apply
                  </Button>
                </div>
              ))}

              <div className="pt-4 space-y-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  onClick={optimizeSequenceTiming}
                  disabled={isGeneratingAI}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Optimize Timing
                </Button>
                <Button size="sm" variant="outline" className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analyze Performance
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Builder */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="setup" className="space-y-4">
            <TabsList>
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="steps">Steps</TabsTrigger>
              <TabsTrigger value="triggers">Triggers</TabsTrigger>
              <TabsTrigger value="settings">AI Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sequence Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Sequence Name</Label>
                      <Input
                        id="name"
                        value={sequenceName}
                        onChange={(e) => setSequenceName(e.target.value)}
                        placeholder="Enter sequence name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="personas">Target Personas</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select personas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enterprise">Enterprise CTO</SelectItem>
                          <SelectItem value="startup">Startup Founder</SelectItem>
                          <SelectItem value="marketing">Marketing Manager</SelectItem>
                          <SelectItem value="sales">Sales Director</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={sequenceDescription}
                      onChange={(e) => setSequenceDescription(e.target.value)}
                      placeholder="Describe the sequence purpose and strategy"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="ai-optimized"
                        checked={aiOptimized}
                        onCheckedChange={setAiOptimized}
                      />
                      <Label htmlFor="ai-optimized">AI Optimization</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="adaptive-scheduling"
                        checked={adaptiveScheduling}
                        onCheckedChange={setAdaptiveScheduling}
                      />
                      <Label htmlFor="adaptive-scheduling">Adaptive Scheduling</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="steps" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Sequence Steps</CardTitle>
                    <div className="flex gap-2">
                      <Select onValueChange={(value) => addStep(value as any)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Add step" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="call">Call Reminder</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                          <SelectItem value="wait">Wait/Delay</SelectItem>
                          <SelectItem value="ai_decision">AI Decision</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {steps.map((step, index) => (
                      <div key={step.id}>
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-medium">
                                  {step.stepNumber}
                                </div>
                                {getStepIcon(step.type)}
                                <div>
                                  <h4 className="font-medium capitalize">{step.type}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Step {step.stepNumber}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {step.adaptiveContent && (
                                  <Badge variant="secondary">
                                    <Brain className="h-3 w-3 mr-1" />
                                    AI Content
                                  </Badge>
                                )}
                                {step.dynamicTiming && (
                                  <Badge variant="secondary">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Smart Timing
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteStep(step.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {step.content && (
                              <div className="space-y-3">
                                {step.type === 'email' && (
                                  <div>
                                    <Label>Subject Line</Label>
                                    <Input
                                      value={step.content.subject || ''}
                                      onChange={(e) => updateStep(step.id, {
                                        content: { ...step.content!, subject: e.target.value }
                                      })}
                                      placeholder="Email subject line"
                                    />
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <Label>Content Template</Label>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => generateAIContent(step.id)}
                                      disabled={isGeneratingAI}
                                    >
                                      {isGeneratingAI ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                      ) : (
                                        <Brain className="h-4 w-4" />
                                      )}
                                      Generate AI Content
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={step.content.template}
                                    onChange={(e) => updateStep(step.id, {
                                      content: { ...step.content!, template: e.target.value }
                                    })}
                                    placeholder="Enter content template with {{variables}}"
                                    rows={4}
                                  />
                                </div>
                                {step.content.variables.length > 0 && (
                                  <div>
                                    <Label>Variables</Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {step.content.variables.map(variable => (
                                        <Badge key={variable} variant="outline">
                                          {variable}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {step.timing && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-accent rounded-lg">
                                <div>
                                  <Label>Delay Days</Label>
                                  <Input
                                    type="number"
                                    value={step.timing.delayDays}
                                    onChange={(e) => updateStep(step.id, {
                                      timing: { ...step.timing!, delayDays: parseInt(e.target.value) || 0 }
                                    })}
                                    min="0"
                                  />
                                </div>
                                <div>
                                  <Label>Delay Hours</Label>
                                  <Input
                                    type="number"
                                    value={step.timing.delayHours}
                                    onChange={(e) => updateStep(step.id, {
                                      timing: { ...step.timing!, delayHours: parseInt(e.target.value) || 0 }
                                    })}
                                    min="0"
                                    max="23"
                                  />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        
                        {index < steps.length - 1 && (
                          <div className="flex justify-center py-2">
                            <ArrowDown className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}

                    {steps.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No steps added yet. Use the dropdown above to add your first step.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="triggers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Entry Triggers & Exit Conditions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Entry Triggers</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 p-3 border rounded-lg">
                        <Select>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Trigger type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="behavior">Behavior</SelectItem>
                            <SelectItem value="classification_change">Classification Change</SelectItem>
                            <SelectItem value="time_based">Time Based</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="ai_recommendation">AI Recommendation</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Trigger criteria" className="flex-1" />
                        <Button size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Exit Conditions</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 p-3 border rounded-lg">
                        <Select>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Exit condition" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="goal_achieved">Goal Achieved</SelectItem>
                            <SelectItem value="negative_response">Negative Response</SelectItem>
                            <SelectItem value="churn_risk">Churn Risk</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="ai_exit">AI Exit</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Exit criteria" className="flex-1" />
                        <Button size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Settings & Optimization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Content AI</h4>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Switch id="content-adaptation" defaultChecked={aiOptimized} />
                          <Label htmlFor="content-adaptation">Content Adaptation</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="ab-testing" defaultChecked={aiOptimized} />
                          <Label htmlFor="ab-testing">A/B Test Variants</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="personalization" defaultChecked={aiOptimized} />
                          <Label htmlFor="personalization">Smart Personalization</Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Timing AI</h4>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Switch id="timing-optimization" defaultChecked={adaptiveScheduling} />
                          <Label htmlFor="timing-optimization">Timing Optimization</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="channel-selection" />
                          <Label htmlFor="channel-selection">Channel Selection</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="send-time-optimization" defaultChecked={adaptiveScheduling} />
                          <Label htmlFor="send-time-optimization">Send Time Optimization</Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Performance Monitoring</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 border rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-500">+23%</p>
                        <p className="text-sm text-muted-foreground">Response Rate Lift</p>
                      </div>
                      <div className="p-3 border rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-500">+31%</p>
                        <p className="text-sm text-muted-foreground">Engagement Improvement</p>
                      </div>
                      <div className="p-3 border rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-500">+18%</p>
                        <p className="text-sm text-muted-foreground">Conversion Rate Boost</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}