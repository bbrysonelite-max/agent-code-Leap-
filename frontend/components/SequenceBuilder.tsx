import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Trash2, 
  ArrowDown, 
  ArrowUp, 
  Mail, 
  Phone, 
  Clock, 
  GitBranch,
  Brain,
  Save,
  Play
} from 'lucide-react';
import { useNurturing } from '../hooks/useNurturing';
import LoadingSpinner from './LoadingSpinner';
import { useToast } from '@/components/ui/use-toast';

interface SequenceStep {
  id?: string;
  step_number: number;
  step_type: 'email' | 'call' | 'social_media' | 'delay' | 'conditional';
  name: string;
  delay_days: number;
  delay_hours: number;
  content_template: string;
  personalization_variables: string[];
  ai_dynamic_content: boolean;
  conditions?: Record<string, any>;
  success_criteria?: Record<string, any>;
}

export function SequenceBuilder() {
  const { createNurturingSequence, isCreatingSequence } = useNurturing();
  const { toast } = useToast();

  const [sequence, setSequence] = useState({
    name: '',
    description: '',
    target_classification: 'cold' as const,
    target_funnel_stage: 'awareness' as const,
    ai_optimization_enabled: true,
    steps: [] as SequenceStep[]
  });

  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const addStep = () => {
    const newStep: SequenceStep = {
      step_number: sequence.steps.length + 1,
      step_type: 'email',
      name: `Step ${sequence.steps.length + 1}`,
      delay_days: sequence.steps.length === 0 ? 0 : 1,
      delay_hours: 0,
      content_template: '',
      personalization_variables: ['name', 'company'],
      ai_dynamic_content: true,
      conditions: {},
      success_criteria: {}
    };

    setSequence(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const updateStep = (index: number, updatedStep: Partial<SequenceStep>) => {
    setSequence(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, ...updatedStep } : step
      )
    }));
  };

  const removeStep = (index: number) => {
    setSequence(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((step, i) => ({
        ...step,
        step_number: i + 1
      }))
    }));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...sequence.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newSteps.length) {
      [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
      
      // Update step numbers
      newSteps.forEach((step, i) => {
        step.step_number = i + 1;
      });
      
      setSequence(prev => ({ ...prev, steps: newSteps }));
    }
  };

  const handleSaveSequence = async () => {
    if (!sequence.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a sequence name",
        variant: "destructive"
      });
      return;
    }

    if (sequence.steps.length === 0) {
      toast({
        title: "Validation Error", 
        description: "Please add at least one step to the sequence",
        variant: "destructive"
      });
      return;
    }

    try {
      await createNurturingSequence(sequence);
      toast({
        title: "Success",
        description: "Nurturing sequence created successfully"
      });
      
      // Reset form
      setSequence({
        name: '',
        description: '',
        target_classification: 'cold',
        target_funnel_stage: 'awareness',
        ai_optimization_enabled: true,
        steps: []
      });
    } catch (error) {
      console.error('Failed to create sequence:', error);
      toast({
        title: "Error",
        description: "Failed to create nurturing sequence",
        variant: "destructive"
      });
    }
  };

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'email': return Mail;
      case 'call': return Phone;
      case 'delay': return Clock;
      case 'conditional': return GitBranch;
      default: return Mail;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sequence Builder</h2>
          <p className="text-muted-foreground">Create intelligent nurturing sequences with AI optimization</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
          >
            {isPreviewMode ? 'Edit Mode' : 'Preview Mode'}
          </Button>
          <Button 
            onClick={handleSaveSequence}
            disabled={isCreatingSequence || !sequence.name.trim() || sequence.steps.length === 0}
          >
            {isCreatingSequence ? <LoadingSpinner className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Sequence
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sequence Configuration */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Sequence Configuration</CardTitle>
            <CardDescription>Basic settings for your nurturing sequence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sequence Name</Label>
              <Input
                id="name"
                value={sequence.name}
                onChange={(e) => setSequence(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Cold Lead Nurturing"
                disabled={isPreviewMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={sequence.description}
                onChange={(e) => setSequence(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the purpose and goals of this sequence"
                disabled={isPreviewMode}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="classification">Target Classification</Label>
              <Select 
                value={sequence.target_classification} 
                onValueChange={(value) => setSequence(prev => ({ ...prev, target_classification: value as any }))}
                disabled={isPreviewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot Prospects</SelectItem>
                  <SelectItem value="warm">Warm Prospects</SelectItem>
                  <SelectItem value="cold">Cold Prospects</SelectItem>
                  <SelectItem value="unengaged">Unengaged Prospects</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="funnel-stage">Target Funnel Stage</Label>
              <Select 
                value={sequence.target_funnel_stage} 
                onValueChange={(value) => setSequence(prev => ({ ...prev, target_funnel_stage: value as any }))}
                disabled={isPreviewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awareness">Awareness</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="consideration">Consideration</SelectItem>
                  <SelectItem value="intent">Intent</SelectItem>
                  <SelectItem value="decision">Decision</SelectItem>
                  <SelectItem value="retention">Retention</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="ai-optimization"
                checked={sequence.ai_optimization_enabled}
                onCheckedChange={(checked) => setSequence(prev => ({ ...prev, ai_optimization_enabled: checked }))}
                disabled={isPreviewMode}
              />
              <Label htmlFor="ai-optimization" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Enable AI Optimization
              </Label>
            </div>

            {sequence.ai_optimization_enabled && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  AI will automatically optimize content, timing, and personalization based on prospect behavior and engagement patterns.
                </p>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Steps:</span>
                  <span className="font-medium">{sequence.steps.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Duration:</span>
                  <span className="font-medium">
                    {sequence.steps.reduce((total, step) => total + step.delay_days, 0)} days
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sequence Steps */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Sequence Steps
              {!isPreviewMode && (
                <Button onClick={addStep} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              )}
            </CardTitle>
            <CardDescription>Define the steps in your nurturing sequence</CardDescription>
          </CardHeader>
          <CardContent>
            {sequence.steps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No steps added yet. Click "Add Step" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sequence.steps.map((step, index) => {
                  const StepIcon = getStepIcon(step.step_type);
                  
                  return (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <StepIcon className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">Step {step.step_number}</div>
                            <Badge variant="outline">{step.step_type.replace('_', ' ')}</Badge>
                          </div>
                        </div>
                        
                        {!isPreviewMode && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveStep(index, 'up')}
                              disabled={index === 0}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveStep(index, 'down')}
                              disabled={index === sequence.steps.length - 1}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStep(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Step Name</Label>
                          <Input
                            value={step.name}
                            onChange={(e) => updateStep(index, { name: e.target.value })}
                            disabled={isPreviewMode}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Step Type</Label>
                          <Select 
                            value={step.step_type} 
                            onValueChange={(value) => updateStep(index, { step_type: value as any })}
                            disabled={isPreviewMode}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="call">Call</SelectItem>
                              <SelectItem value="social_media">Social Media</SelectItem>
                              <SelectItem value="delay">Delay</SelectItem>
                              <SelectItem value="conditional">Conditional</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Delay (Days)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={step.delay_days}
                            onChange={(e) => updateStep(index, { delay_days: parseInt(e.target.value) || 0 })}
                            disabled={isPreviewMode}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Delay (Hours)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="23"
                            value={step.delay_hours}
                            onChange={(e) => updateStep(index, { delay_hours: parseInt(e.target.value) || 0 })}
                            disabled={isPreviewMode}
                          />
                        </div>
                      </div>

                      {step.step_type !== 'delay' && (
                        <>
                          <div className="space-y-2">
                            <Label>Content Template</Label>
                            <Textarea
                              value={step.content_template}
                              onChange={(e) => updateStep(index, { content_template: e.target.value })}
                              placeholder="Enter your content template with personalization variables like {{name}}, {{company}}, etc."
                              disabled={isPreviewMode}
                              rows={4}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={step.ai_dynamic_content}
                                onCheckedChange={(checked) => updateStep(index, { ai_dynamic_content: checked })}
                                disabled={isPreviewMode}
                              />
                              <Label className="flex items-center gap-2">
                                <Brain className="w-4 h-4" />
                                AI Dynamic Content
                              </Label>
                            </div>
                            
                            {step.ai_dynamic_content && (
                              <Badge variant="secondary">AI-Enhanced</Badge>
                            )}
                          </div>

                          {step.ai_dynamic_content && (
                            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                              <p className="text-sm text-green-700 dark:text-green-300">
                                AI will generate personalized content based on prospect classification, behavior, and engagement history.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {step.step_type === 'delay' && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            This step will pause the sequence for {step.delay_days} days and {step.delay_hours} hours before continuing to the next step.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}