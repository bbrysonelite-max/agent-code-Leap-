export interface ProspectBehavior {
  id: string;
  prospectId: string;
  eventType: 'email_open' | 'email_click' | 'website_visit' | 'form_submit' | 'download' | 'meeting_scheduled' | 'meeting_attended' | 'meeting_no_show';
  eventData: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  source: string;
  score: number;
}

export interface EngagementPattern {
  prospectId: string;
  totalEngagements: number;
  avgTimeBetweenEngagements: number;
  preferredContactTimes: string[];
  preferredChannels: string[];
  responseRate: number;
  lastEngagement: Date;
  engagementTrend: 'increasing' | 'decreasing' | 'stable';
  peakEngagementDays: number[];
}

export interface ProspectClassification {
  id: string;
  prospectId: string;
  classification: 'hot' | 'warm' | 'cold' | 'nurture' | 'unqualified';
  confidence: number;
  factors: string[];
  stage: 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
  buyingSignals: string[];
  painPoints: string[];
  interests: string[];
  lastUpdated: Date;
}

export interface NurturingSequence {
  id: string;
  name: string;
  description: string;
  targetClassification: string[];
  targetStages: string[];
  isActive: boolean;
  steps: NurturingStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NurturingStep {
  id: string;
  sequenceId: string;
  stepNumber: number;
  type: 'email' | 'sms' | 'call_reminder' | 'task' | 'delay';
  trigger: 'immediate' | 'time_delay' | 'behavior_trigger' | 'engagement_score';
  triggerValue?: string;
  delayDays?: number;
  delayHours?: number;
  contentTemplate: string;
  personalizationRules: PersonalizationRule[];
  conditions: StepCondition[];
  isActive: boolean;
}

export interface PersonalizationRule {
  field: string;
  condition: string;
  value: string;
  replacement: string;
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
  value: string;
}

export interface NurturingEnrollment {
  id: string;
  prospectId: string;
  sequenceId: string;
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'failed' | 'unsubscribed';
  enrolledAt: Date;
  lastStepAt?: Date;
  nextStepAt?: Date;
  completedSteps: number;
  metadata: Record<string, any>;
}

export interface ContentTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'social';
  subject?: string;
  content: string;
  variables: string[];
  classification: string[];
  stages: string[];
  industry?: string;
  persona?: string;
  createdAt: Date;
  performance: {
    sentCount: number;
    openRate: number;
    clickRate: number;
    responseRate: number;
  };
}

export interface NurturingAnalytics {
  sequenceId: string;
  totalEnrolled: number;
  activeEnrollments: number;
  completedEnrollments: number;
  conversionRate: number;
  avgTimeToConversion: number;
  stepPerformance: StepPerformance[];
  engagementMetrics: {
    totalSent: number;
    openRate: number;
    clickRate: number;
    responseRate: number;
    unsubscribeRate: number;
  };
}

export interface StepPerformance {
  stepNumber: number;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  responseCount: number;
  unsubscribeCount: number;
  bounceCount: number;
  dropoffRate: number;
}

export interface BehaviorTrigger {
  id: string;
  name: string;
  description: string;
  eventType: string;
  conditions: Record<string, any>;
  actions: TriggerAction[];
  isActive: boolean;
  createdAt: Date;
}

export interface TriggerAction {
  type: 'enroll_sequence' | 'send_email' | 'create_task' | 'update_score' | 'notify_sales';
  parameters: Record<string, any>;
}

export interface AIInsight {
  id: string;
  prospectId: string;
  type: 'engagement_prediction' | 'content_recommendation' | 'timing_optimization' | 'channel_preference';
  insight: string;
  confidence: number;
  data: Record<string, any>;
  actionable: boolean;
  createdAt: Date;
  appliedAt?: Date;
}

export interface CreateBehaviorRequest {
  prospectId: string;
  eventType: string;
  eventData: Record<string, any>;
  source: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateSequenceRequest {
  name: string;
  description: string;
  targetClassification: string[];
  targetStages: string[];
  steps: Omit<NurturingStep, 'id' | 'sequenceId'>[];
}

export interface EnrollProspectRequest {
  prospectId: string;
  sequenceId: string;
  metadata?: Record<string, any>;
}

export interface GenerateContentRequest {
  prospectId: string;
  templateId: string;
  contentType: 'email' | 'sms' | 'social';
  context?: Record<string, any>;
}

export interface AnalyzeBehaviorRequest {
  prospectId: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface OptimizeSequenceRequest {
  sequenceId: string;
  optimizationGoal: 'conversion' | 'engagement' | 'response_rate';
}