import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, ArrowDown } from 'lucide-react';
import type { CreateSequenceRequest, SequenceStep } from '~backend/nurturing/types';

interface NurturingSequenceBuilderProps {
  onClose: () => void;
  onSave: (sequence: CreateSequenceRequest) => Promise<void>;
}

export function NurturingSequenceBuilder({ onClose, onSave }: NurturingSequenceBuilderProps) {
  const [formData, setFormData] = useState<Partial<CreateSequenceRequest>>({
    name: '',
    description: '',
    clientId: 'default-client', // This should come from auth context
    triggerConditions: {
      events: [],
      behaviors: [],
      demographics: [],
      engagement: {},
      timeframe: {}
    },
    targetAudience: {
      industries: [],
      companySize: [],
      roles: [],
      geography: [],
      behaviorSegments: [],
      excludeSegments: []
    },
    steps: []
  });

  const [currentStep, setCurrentStep] = useState<Partial<SequenceStep>>({
    stepOrder: 0,
    stepType: 'email',
    delayDays: 0,
    delayHours: 24,
    contentTemplate: {
      type: 'email',
      subject: '',
      body: '',
      variables: [],
      personalizationRules: [],
      dynamicContent: []
    },
    isActive: true
  });

  const [saving, setSaving] = useState(false);

  const addStep = () => {
    if (!currentStep.contentTemplate?.body) return;

    const newStep = {
      ...currentStep,
      stepOrder: formData.steps?.length || 0
    } as Omit<SequenceStep, 'id' | 'sequenceId' | 'createdAt'>;

    setFormData(prev => ({
      ...prev,
      steps: [...(prev.steps || []), newStep]
    }));

    setCurrentStep({
      stepOrder: (formData.steps?.length || 0) + 1,
      stepType: 'email',
      delayDays: 0,
      delayHours: 24,
      contentTemplate: {
        type: 'email',
        subject: '',
        body: '',
        variables: [],
        personalizationRules: [],
        dynamicContent: []
      },
      isActive: true
    });
  };

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps?.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.steps?.length) return;

    setSaving(true);
    try {
      await onSave(formData as CreateSequenceRequest);
      onClose();
    } catch (error) {
      console.error('Failed to save sequence:', error);
    } finally {
      setSaving(false);
    }
  };

  const addPersonalizationRule = () => {
    if (!currentStep.contentTemplate) return;

    setCurrentStep(prev => ({
      ...prev,
      contentTemplate: {
        ...prev.contentTemplate!,
        personalizationRules: [
          ...(prev.contentTemplate?.personalizationRules || []),
          {
            placeholder: '',
            source: 'prospect',
            field: '',
            fallback: '',
            transformation: ''
          }
        ]
      }
    }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Nurturing Sequence</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Sequence Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Welcome Series for New Leads"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the purpose and goals of this sequence"
                />
              </div>
            </CardContent>
          </Card>

          {/* Target Audience */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Target Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Industries</Label>
                  <Input
                    placeholder="Technology, Healthcare, Finance"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      targetAudience: {
                        ...prev.targetAudience!,
                        industries: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      }
                    }))}
                  />
                </div>
                <div>
                  <Label>Company Size</Label>
                  <Input
                    placeholder="1-10, 11-50, 51-200"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      targetAudience: {
                        ...prev.targetAudience!,
                        companySize: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      }
                    }))}
                  />
                </div>
                <div>
                  <Label>Roles</Label>
                  <Input
                    placeholder="CEO, CTO, Marketing Manager"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      targetAudience: {
                        ...prev.targetAudience!,
                        roles: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      }
                    }))}
                  />
                </div>
                <div>
                  <Label>Geography</Label>
                  <Input
                    placeholder="US, Europe, Asia-Pacific"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      targetAudience: {
                        ...prev.targetAudience!,
                        geography: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sequence Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sequence Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Steps */}
              {formData.steps?.map((step, index) => (
                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">Step {index + 1}</Badge>
                      <Badge className="capitalize">{step.stepType}</Badge>
                      <span className="text-sm text-gray-600">
                        Delay: {step.delayDays}d {step.delayHours}h
                      </span>
                    </div>
                    <p className="text-sm font-medium">{step.contentTemplate.subject}</p>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {step.contentTemplate.body.substring(0, 100)}...
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {formData.steps && formData.steps.length > 0 && (
                <div className="flex justify-center">
                  <ArrowDown className="h-5 w-5 text-gray-400" />
                </div>
              )}

              {/* Add New Step */}
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Step Type</Label>
                    <Select
                      value={currentStep.stepType}
                      onValueChange={(value: 'email' | 'sms' | 'task' | 'wait') => 
                        setCurrentStep(prev => ({ 
                          ...prev, 
                          stepType: value,
                          contentTemplate: {
                            ...prev.contentTemplate!,
                            type: value === 'wait' ? 'email' : value
                          }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="wait">Wait</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Delay (Days)</Label>
                    <Input
                      type="number"
                      value={currentStep.delayDays}
                      onChange={(e) => setCurrentStep(prev => ({ 
                        ...prev, 
                        delayDays: parseInt(e.target.value) || 0 
                      }))}
                      className="w-20"
                    />
                  </div>
                  <div>
                    <Label>Delay (Hours)</Label>
                    <Input
                      type="number"
                      value={currentStep.delayHours}
                      onChange={(e) => setCurrentStep(prev => ({ 
                        ...prev, 
                        delayHours: parseInt(e.target.value) || 0 
                      }))}
                      className="w-20"
                    />
                  </div>
                </div>

                {currentStep.stepType !== 'wait' && (
                  <>
                    <div>
                      <Label>Subject Line</Label>
                      <Input
                        value={currentStep.contentTemplate?.subject}
                        onChange={(e) => setCurrentStep(prev => ({
                          ...prev,
                          contentTemplate: {
                            ...prev.contentTemplate!,
                            subject: e.target.value
                          }
                        }))}
                        placeholder="Enter subject line (use {{variables}} for personalization)"
                      />
                    </div>
                    <div>
                      <Label>Content</Label>
                      <Textarea
                        value={currentStep.contentTemplate?.body}
                        onChange={(e) => setCurrentStep(prev => ({
                          ...prev,
                          contentTemplate: {
                            ...prev.contentTemplate!,
                            body: e.target.value
                          }
                        }))}
                        placeholder="Enter content (use {{variables}} for personalization)"
                        rows={4}
                      />
                    </div>

                    {/* Personalization Rules */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Personalization Rules</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addPersonalizationRule}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {currentStep.contentTemplate?.personalizationRules?.map((rule, ruleIndex) => (
                        <div key={ruleIndex} className="grid grid-cols-4 gap-2 p-2 border rounded">
                          <Input
                            placeholder="{{variable}}"
                            value={rule.placeholder}
                            onChange={(e) => {
                              const newRules = [...(currentStep.contentTemplate?.personalizationRules || [])];
                              newRules[ruleIndex] = { ...rule, placeholder: e.target.value };
                              setCurrentStep(prev => ({
                                ...prev,
                                contentTemplate: {
                                  ...prev.contentTemplate!,
                                  personalizationRules: newRules
                                }
                              }));
                            }}
                          />
                          <Select
                            value={rule.source}
                            onValueChange={(value: 'prospect' | 'company' | 'behavior' | 'external') => {
                              const newRules = [...(currentStep.contentTemplate?.personalizationRules || [])];
                              newRules[ruleIndex] = { ...rule, source: value };
                              setCurrentStep(prev => ({
                                ...prev,
                                contentTemplate: {
                                  ...prev.contentTemplate!,
                                  personalizationRules: newRules
                                }
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="company">Company</SelectItem>
                              <SelectItem value="behavior">Behavior</SelectItem>
                              <SelectItem value="external">External</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="field_name"
                            value={rule.field}
                            onChange={(e) => {
                              const newRules = [...(currentStep.contentTemplate?.personalizationRules || [])];
                              newRules[ruleIndex] = { ...rule, field: e.target.value };
                              setCurrentStep(prev => ({
                                ...prev,
                                contentTemplate: {
                                  ...prev.contentTemplate!,
                                  personalizationRules: newRules
                                }
                              }));
                            }}
                          />
                          <Input
                            placeholder="fallback"
                            value={rule.fallback}
                            onChange={(e) => {
                              const newRules = [...(currentStep.contentTemplate?.personalizationRules || [])];
                              newRules[ruleIndex] = { ...rule, fallback: e.target.value };
                              setCurrentStep(prev => ({
                                ...prev,
                                contentTemplate: {
                                  ...prev.contentTemplate!,
                                  personalizationRules: newRules
                                }
                              }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Button onClick={addStep} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!formData.name || !formData.steps?.length || saving}
            >
              {saving ? 'Creating...' : 'Create Sequence'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}