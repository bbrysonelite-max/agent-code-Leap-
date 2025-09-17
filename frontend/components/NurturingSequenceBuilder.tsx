import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  X,
  Mail,
  MessageSquare,
  Clock,
  CheckSquare,
  ArrowRight,
  Wand2,
  Target,
  Users
} from 'lucide-react';
import { useCreateSequence, useContentTemplates } from '../hooks/useNurturing';
import { useToast } from '@/components/ui/use-toast';
import type { NurturingStep } from '~backend/nurturing/types';

interface SequenceBuilderProps {
  onClose: () => void;
  onSave: () => void;
}

export default function NurturingSequenceBuilder({ onClose, onSave }: SequenceBuilderProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [sequenceData, setSequenceData] = useState({
    name: '',
    description: '',
    targetClassification: [] as string[],
    targetStages: [] as string[],
    steps: [] as Omit<NurturingStep, 'id' | 'sequenceId'>[]
  });

  const createSequence = useCreateSequence();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!sequenceData.name || sequenceData.steps.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please provide a name and at least one step",
        variant: "destructive"
      });
      return;
    }

    try {
      await createSequence.mutateAsync({
        name: sequenceData.name,
        description: sequenceData.description,
        targetClassification: sequenceData.targetClassification,
        targetStages: sequenceData.targetStages,
        steps: sequenceData.steps
      });
      
      toast({
        title: "Success",
        description: "Nurturing sequence created successfully"
      });
      
      onSave();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create sequence",
        variant: "destructive"
      });
    }
  };

  const addStep = () => {
    const newStep: Omit<NurturingStep, 'id' | 'sequenceId'> = {
      stepNumber: sequenceData.steps.length + 1,
      type: 'email',
      trigger: 'time_delay',
      delayDays: 1,
      delayHours: 0,
      contentTemplate: '',
      personalizationRules: [],
      conditions: [],
      isActive: true
    };
    
    setSequenceData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const updateStep = (index: number, updates: Partial<NurturingStep>) => {
    setSequenceData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, ...updates } : step
      )
    }));
  };

  const removeStep = (index: number) => {
    setSequenceData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((step, i) => ({
        ...step,
        stepNumber: i + 1
      }))
    }));
  };

  const classifications = ['hot', 'warm', 'nurture', 'cold'];
  const stages = ['awareness', 'interest', 'consideration', 'intent', 'evaluation'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Create Nurturing Sequence
          </DialogTitle>
          <DialogDescription>
            Build an AI-powered nurturing sequence with automated follow-ups and personalized content.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="targeting">Targeting</TabsTrigger>
            <TabsTrigger value="steps">Sequence Steps</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Sequence Name</Label>
                <Input
                  id="name"
                  value={sequenceData.name}
                  onChange={(e) => setSequenceData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Enterprise Leads Nurturing"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={sequenceData.description}
                  onChange={(e) => setSequenceData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the purpose and goals of this sequence..."
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="targeting" className="space-y-4">
            <div className="space-y-6">
              <div>
                <Label className="text-base font-medium flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4" />
                  Prospect Classification
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {classifications.map((classification) => (
                    <label
                      key={classification}
                      className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={sequenceData.targetClassification.includes(classification)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSequenceData(prev => ({
                              ...prev,
                              targetClassification: [...prev.targetClassification, classification]
                            }));
                          } else {
                            setSequenceData(prev => ({
                              ...prev,
                              targetClassification: prev.targetClassification.filter(c => c !== classification)
                            }));
                          }
                        }}
                      />
                      <Badge variant="outline" className={getClassificationColor(classification)}>
                        {classification}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-medium flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" />
                  Sales Funnel Stage
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {stages.map((stage) => (
                    <label
                      key={stage}
                      className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={sequenceData.targetStages.includes(stage)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSequenceData(prev => ({
                              ...prev,
                              targetStages: [...prev.targetStages, stage]
                            }));
                          } else {
                            setSequenceData(prev => ({
                              ...prev,
                              targetStages: prev.targetStages.filter(s => s !== stage)
                            }));
                          }
                        }}
                      />
                      <Badge variant="outline" className={getStageColor(stage)}>
                        {stage}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="steps" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Sequence Steps</h3>
                <Button onClick={addStep} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>

              {sequenceData.steps.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Steps Yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Add your first step to start building your nurturing sequence.
                    </p>
                    <Button onClick={addStep}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Step
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sequenceData.steps.map((step, index) => (
                    <SequenceStepEditor
                      key={index}
                      step={step}
                      stepIndex={index}
                      onUpdate={(updates) => updateStep(index, updates)}
                      onRemove={() => removeStep(index)}
                      isLast={index === sequenceData.steps.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {sequenceData.steps.length} steps configured
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createSequence.isPending}>
              {createSequence.isPending ? 'Creating...' : 'Create Sequence'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SequenceStepEditor({
  step,
  stepIndex,
  onUpdate,
  onRemove,
  isLast
}: {
  step: Omit<NurturingStep, 'id' | 'sequenceId'>;
  stepIndex: number;
  onUpdate: (updates: Partial<NurturingStep>) => void;
  onRemove: () => void;
  isLast: boolean;
}) {
  const getStepIcon = () => {
    switch (step.type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'task': return <CheckSquare className="h-4 w-4" />;
      case 'delay': return <Clock className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                {stepIndex + 1}
              </div>
              <div className="flex items-center gap-2">
                {getStepIcon()}
                <CardTitle className="text-base">Step {stepIndex + 1}</CardTitle>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Step Type</Label>
              <Select value={step.type} onValueChange={(value: any) => onUpdate({ type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="delay">Delay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Trigger</Label>
              <Select value={step.trigger} onValueChange={(value: any) => onUpdate({ trigger: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="time_delay">Time Delay</SelectItem>
                  <SelectItem value="behavior_trigger">Behavior Trigger</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {step.trigger === 'time_delay' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Delay Days</Label>
                <Input
                  type="number"
                  value={step.delayDays || 0}
                  onChange={(e) => onUpdate({ delayDays: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <div>
                <Label>Delay Hours</Label>
                <Input
                  type="number"
                  value={step.delayHours || 0}
                  onChange={(e) => onUpdate({ delayHours: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="23"
                />
              </div>
            </div>
          )}

          {step.type !== 'delay' && (
            <div>
              <Label>Content Template</Label>
              <Textarea
                value={step.contentTemplate}
                onChange={(e) => onUpdate({ contentTemplate: e.target.value })}
                placeholder={
                  step.type === 'email' 
                    ? "Hi {{firstName}}, I wanted to follow up on..."
                    : step.type === 'sms'
                    ? "Hi {{firstName}}, quick follow-up..."
                    : "Follow up with {{fullName}} regarding..."
                }
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use variables like {{firstName}}, {{company}}, {{classification}} for personalization
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                checked={step.isActive}
                onCheckedChange={(checked) => onUpdate({ isActive: checked })}
              />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {!isLast && (
        <div className="flex justify-center py-2">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function getClassificationColor(classification: string) {
  switch (classification) {
    case 'hot': return 'border-red-500 bg-red-50 text-red-700';
    case 'warm': return 'border-orange-500 bg-orange-50 text-orange-700';
    case 'nurture': return 'border-blue-500 bg-blue-50 text-blue-700';
    case 'cold': return 'border-gray-500 bg-gray-50 text-gray-700';
    default: return 'border-blue-500 bg-blue-50 text-blue-700';
  }
}

function getStageColor(stage: string) {
  switch (stage) {
    case 'awareness': return 'border-purple-500 bg-purple-50 text-purple-700';
    case 'interest': return 'border-blue-500 bg-blue-50 text-blue-700';
    case 'consideration': return 'border-yellow-500 bg-yellow-50 text-yellow-700';
    case 'intent': return 'border-orange-500 bg-orange-50 text-orange-700';
    case 'evaluation': return 'border-red-500 bg-red-50 text-red-700';
    default: return 'border-gray-500 bg-gray-50 text-gray-700';
  }
}