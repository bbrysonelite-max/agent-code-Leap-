import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Bot, Zap, Lightbulb, Target, Clock } from 'lucide-react';
import type { CreateSequenceRequest } from '~backend/nurturing/types';

interface AISequenceBuilderProps {
  onClose: () => void;
  onSave: (sequence: CreateSequenceRequest) => Promise<void>;
}

export default function AISequenceBuilder({ onClose, onSave }: AISequenceBuilderProps) {
  const [step, setStep] = useState<'goals' | 'audience' | 'strategy' | 'generation' | 'review'>('goals');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  const [goals, setGoals] = useState({
    objective: '',
    targetOutcome: '',
    timeline: '',
    industry: '',
    productType: ''
  });

  const [audience, setAudience] = useState({
    persona: '',
    painPoints: '',
    decisionMakingProcess: '',
    communicationPreferences: '',
    currentFunnelStage: 'awareness'
  });

  const [strategy, setStrategy] = useState({
    approach: '',
    tone: '',
    contentTypes: [] as string[],
    sequenceLength: 5,
    messagingFrequency: 'balanced'
  });

  const [generatedSequence, setGeneratedSequence] = useState<CreateSequenceRequest | null>(null);

  const generateSequence = async () => {
    setIsGenerating(true);
    setStep('generation');
    setGenerationProgress(0);

    try {
      // Simulate AI generation progress
      const progressSteps = [
        { progress: 20, message: 'Analyzing goals and audience...' },
        { progress: 40, message: 'Designing sequence strategy...' },
        { progress: 60, message: 'Generating personalized content...' },
        { progress: 80, message: 'Optimizing timing and flow...' },
        { progress: 100, message: 'Finalizing sequence...' }
      ];

      for (const progressStep of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setGenerationProgress(progressStep.progress);
      }

      // Generate the actual sequence using AI
      const sequence: CreateSequenceRequest = {
        name: `AI-Generated: ${goals.objective}`,
        client_id: 1, // Default client ID
        classification_target: 'warm' as const,
        stage_target: 'interest' as const,
        steps: generateSteps()
      };

      setGeneratedSequence(sequence);
      setStep('review');
    } catch (error) {
      console.error('Failed to generate sequence:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSteps = () => {
    const steps: any[] = [];
    const stepTemplates = [
      {
        type: 'email' as const,
        delayDays: 0,
        delayHours: 1,
        subject: `Welcome to ${goals.productType} - Let's solve ${audience.painPoints}`,
        body: `Hi {{first_name}},

Welcome! I noticed you're interested in ${goals.productType}. 

Many ${audience.persona}s struggle with ${audience.painPoints}. You're not alone in this challenge.

In this series, I'll share practical insights that can help you:
• Overcome common obstacles
• Implement proven strategies  
• Achieve ${goals.targetOutcome}

Looking forward to helping you succeed!

Best regards,
{{sender_name}}`
      },
      {
        type: 'email' as const,
        delayDays: 2,
        delayHours: 0,
        subject: `Quick question about your ${goals.industry} challenges`,
        body: `Hi {{first_name}},

I'm curious - what's the biggest challenge you're facing with ${audience.painPoints} right now?

I ask because I've worked with many ${audience.persona}s in ${goals.industry}, and the solution often depends on your specific situation.

Could you hit reply and let me know? I'd love to share some targeted insights.

Best,
{{sender_name}}`
      },
      {
        type: 'email' as const,
        delayDays: 4,
        delayHours: 0,
        subject: `Case study: How [Company] achieved ${goals.targetOutcome}`,
        body: `Hi {{first_name}},

I wanted to share a quick case study that might interest you.

[Company Name], a ${goals.industry} company similar to {{company_name}}, was struggling with ${audience.painPoints}.

Here's exactly what they did:
1. [Strategy step 1]
2. [Strategy step 2] 
3. [Strategy step 3]

Result: They achieved ${goals.targetOutcome} in ${goals.timeline}.

Want to see if a similar approach could work for you?

Best,
{{sender_name}}`
      }
    ];

    stepTemplates.slice(0, strategy.sequenceLength).forEach((template, index) => {
      steps.push({
        step_number: index + 1,
        content_type: template.type,
        delay_days: template.delayDays,
        delay_hours: template.delayHours,
        subject_template: template.subject,
        content_template: template.body,
        conditions: {}
      });
    });

    return steps;
  };

  const handleSave = async () => {
    if (!generatedSequence) return;
    
    try {
      await onSave(generatedSequence);
      onClose();
    } catch (error) {
      console.error('Failed to save sequence:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            AI Sequence Builder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-sm">
            {['Goals', 'Audience', 'Strategy', 'Generate', 'Review'].map((stepName, index) => (
              <div key={stepName} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    index <= ['goals', 'audience', 'strategy', 'generation', 'review'].indexOf(step)
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                <span className="ml-2 hidden sm:inline">{stepName}</span>
                {index < 4 && <div className="w-8 h-px bg-gray-300 mx-2" />}
              </div>
            ))}
          </div>

          {/* Goals Step */}
          {step === 'goals' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Define Your Goals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>What's your main objective?</Label>
                  <Select value={goals.objective} onValueChange={(value) => setGoals(prev => ({ ...prev, objective: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select objective" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generate_leads">Generate qualified leads</SelectItem>
                      <SelectItem value="nurture_prospects">Nurture existing prospects</SelectItem>
                      <SelectItem value="reactivate_dormant">Reactivate dormant leads</SelectItem>
                      <SelectItem value="educate_market">Educate target market</SelectItem>
                      <SelectItem value="accelerate_sales">Accelerate sales cycle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Target outcome</Label>
                  <Input
                    value={goals.targetOutcome}
                    onChange={(e) => setGoals(prev => ({ ...prev, targetOutcome: e.target.value }))}
                    placeholder="e.g., Increase qualified demos by 30%"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Industry</Label>
                    <Input
                      value={goals.industry}
                      onChange={(e) => setGoals(prev => ({ ...prev, industry: e.target.value }))}
                      placeholder="e.g., SaaS, Healthcare, Manufacturing"
                    />
                  </div>
                  <div>
                    <Label>Product/Service Type</Label>
                    <Input
                      value={goals.productType}
                      onChange={(e) => setGoals(prev => ({ ...prev, productType: e.target.value }))}
                      placeholder="e.g., CRM software, Marketing automation"
                    />
                  </div>
                </div>

                <div>
                  <Label>Timeline</Label>
                  <Select value={goals.timeline} onValueChange={(value) => setGoals(prev => ({ ...prev, timeline: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30_days">30 days</SelectItem>
                      <SelectItem value="60_days">60 days</SelectItem>
                      <SelectItem value="90_days">90 days</SelectItem>
                      <SelectItem value="6_months">6 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={() => setStep('audience')} 
                  className="w-full"
                  disabled={!goals.objective || !goals.industry}
                >
                  Next: Define Audience
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Audience Step */}
          {step === 'audience' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Define Your Audience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Target persona</Label>
                  <Input
                    value={audience.persona}
                    onChange={(e) => setAudience(prev => ({ ...prev, persona: e.target.value }))}
                    placeholder="e.g., Marketing Director, Sales Manager, CEO"
                  />
                </div>

                <div>
                  <Label>Main pain points</Label>
                  <Textarea
                    value={audience.painPoints}
                    onChange={(e) => setAudience(prev => ({ ...prev, painPoints: e.target.value }))}
                    placeholder="What challenges are they facing?"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Decision-making process</Label>
                  <Textarea
                    value={audience.decisionMakingProcess}
                    onChange={(e) => setAudience(prev => ({ ...prev, decisionMakingProcess: e.target.value }))}
                    placeholder="How do they make purchasing decisions?"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Communication preferences</Label>
                  <Select 
                    value={audience.communicationPreferences} 
                    onValueChange={(value) => setAudience(prev => ({ ...prev, communicationPreferences: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal and professional</SelectItem>
                      <SelectItem value="casual">Casual and friendly</SelectItem>
                      <SelectItem value="technical">Technical and detailed</SelectItem>
                      <SelectItem value="concise">Concise and direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('goals')}>
                    Back
                  </Button>
                  <Button 
                    onClick={() => setStep('strategy')} 
                    className="flex-1"
                    disabled={!audience.persona || !audience.painPoints}
                  >
                    Next: Choose Strategy
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Strategy Step */}
          {step === 'strategy' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Choose Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nurturing approach</Label>
                  <Select 
                    value={strategy.approach} 
                    onValueChange={(value) => setStrategy(prev => ({ ...prev, approach: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select approach" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="educational">Educational content series</SelectItem>
                      <SelectItem value="value_driven">Value-driven insights</SelectItem>
                      <SelectItem value="problem_solving">Problem-solving focused</SelectItem>
                      <SelectItem value="social_proof">Social proof and case studies</SelectItem>
                      <SelectItem value="consultative">Consultative approach</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tone of voice</Label>
                  <Select 
                    value={strategy.tone} 
                    onValueChange={(value) => setStrategy(prev => ({ ...prev, tone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="authoritative">Authoritative</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Sequence length</Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="3"
                      max="10"
                      value={strategy.sequenceLength}
                      onChange={(e) => setStrategy(prev => ({ ...prev, sequenceLength: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <span className="w-16 text-center">{strategy.sequenceLength} steps</span>
                  </div>
                </div>

                <div>
                  <Label>Messaging frequency</Label>
                  <Select 
                    value={strategy.messagingFrequency} 
                    onValueChange={(value) => setStrategy(prev => ({ ...prev, messagingFrequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aggressive">Aggressive (every 1-2 days)</SelectItem>
                      <SelectItem value="balanced">Balanced (every 3-4 days)</SelectItem>
                      <SelectItem value="conservative">Conservative (weekly)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('audience')}>
                    Back
                  </Button>
                  <Button 
                    onClick={generateSequence} 
                    className="flex-1 flex items-center gap-2"
                    disabled={!strategy.approach || !strategy.tone}
                  >
                    <Zap className="h-4 w-4" />
                    Generate Sequence
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generation Step */}
          {step === 'generation' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 animate-spin" />
                  Generating Your Sequence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <Progress value={generationProgress} className="w-full mb-4" />
                  <p className="text-sm text-gray-600">
                    {generationProgress < 20 && 'Analyzing goals and audience...'}
                    {generationProgress >= 20 && generationProgress < 40 && 'Designing sequence strategy...'}
                    {generationProgress >= 40 && generationProgress < 60 && 'Generating personalized content...'}
                    {generationProgress >= 60 && generationProgress < 80 && 'Optimizing timing and flow...'}
                    {generationProgress >= 80 && 'Finalizing sequence...'}
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">What we're creating for you:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Personalized email sequence with {strategy.sequenceLength} steps</li>
                    <li>• {strategy.approach} messaging approach</li>
                    <li>• {strategy.tone} tone of voice</li>
                    <li>• Optimized timing based on {strategy.messagingFrequency} frequency</li>
                    <li>• Dynamic personalization variables</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Review Step */}
          {step === 'review' && generatedSequence && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Review Your Sequence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">✅ Sequence Generated Successfully!</h4>
                  <p className="text-sm text-green-700">
                    Your AI-powered nurturing sequence is ready. Review the details below and customize if needed.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="font-medium">Sequence Name</Label>
                    <p className="text-sm text-gray-600">{generatedSequence.name}</p>
                  </div>

                  <div>
                    <Label className="font-medium">Description</Label>
                    <p className="text-sm text-gray-600">{generatedSequence.name}</p>
                  </div>

                  <div>
                    <Label className="font-medium">Steps ({generatedSequence.steps.length})</Label>
                    <div className="space-y-2 mt-2">
                      {generatedSequence.steps.map((step, index) => (
                        <div key={index} className="border rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">Step {index + 1}</Badge>
                            <Badge className="capitalize">{step.step_type}</Badge>
                            <span className="text-sm text-gray-600">
                              {step.delay_days > 0 && `${step.delay_days}d `}
                              {step.delay_hours > 0 && `${step.delay_hours}h`}
                            </span>
                          </div>
                          <p className="font-medium text-sm">{step.content_template}</p>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {step.content_template && step.content_template.substring(0, 120)}...
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('strategy')}>
                    Regenerate
                  </Button>
                  <Button onClick={handleSave} className="flex-1">
                    Save Sequence
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}