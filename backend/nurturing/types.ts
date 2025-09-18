export interface NurturingSequence {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  triggerConditions: TriggerConditions;
  targetAudience: TargetAudience;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  steps?: SequenceStep[];
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepOrder: number;
  stepType: 'email' | 'sms' | 'task' | 'wait';
  delayDays: number;
  delayHours: number;
  contentTemplate: ContentTemplate;
  conditions?: StepConditions;
  isActive: boolean;
  createdAt: Date;
}

export interface ProspectSequence {
  id: string;
  prospectId: string;
  sequenceId: string;
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'failed';
  nextActionAt?: Date;
  engagementScore: number;
  conversionProbability: number;
  startedAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface SequenceExecution {
  id: string;
  prospectSequenceId: string;
  stepId: string;
  executedAt: Date;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'failed';
  contentUsed: Record<string, any>;
  engagementData: EngagementData;
  errorMessage?: string;
}

export interface BehaviorAnalytics {
  id: string;
  prospectId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  source?: string;
  engagementScore: number;
}

export interface ProspectClassification {
  id: string;
  prospectId: string;
  classificationType: string;
  classificationValue: string;
  confidenceScore: number;
  funnelStage: 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
  createdAt: Date;
  expiresAt?: Date;
}

export interface TriggerConditions {
  events?: string[];
  behaviors?: BehaviorCriteria[];
  demographics?: DemographicCriteria[];
  engagement?: EngagementCriteria;
  timeframe?: TimeframeCriteria;
}

export interface TargetAudience {
  industries?: string[];
  companySize?: string[];
  roles?: string[];
  geography?: string[];
  behaviorSegments?: string[];
  excludeSegments?: string[];
}

export interface ContentTemplate {
  type: 'email' | 'sms' | 'task';
  subject?: string;
  body: string;
  variables: string[];
  personalizationRules: PersonalizationRule[];
  dynamicContent: DynamicContentRule[];
}

export interface StepConditions {
  skipIf?: ConditionRule[];
  continueIf?: ConditionRule[];
  waitFor?: WaitCondition;
}

export interface EngagementData {
  opens?: number;
  clicks?: number;
  replies?: number;
  unsubscribes?: number;
  bounces?: number;
  deliveryTime?: Date;
  firstOpenAt?: Date;
  lastClickAt?: Date;
  deviceType?: string;
  location?: string;
}

export interface BehaviorCriteria {
  action: string;
  frequency?: number;
  timeframe?: string;
  value?: any;
}

export interface DemographicCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'in' | 'gt' | 'lt' | 'between';
  value: any;
}

export interface EngagementCriteria {
  minScore?: number;
  maxScore?: number;
  emailEngagement?: boolean;
  websiteActivity?: boolean;
  contentDownloads?: boolean;
}

export interface TimeframeCriteria {
  after?: Date;
  before?: Date;
  relativeDays?: number;
  timeOfDay?: string;
  dayOfWeek?: string[];
}

export interface PersonalizationRule {
  placeholder: string;
  source: 'prospect' | 'company' | 'behavior' | 'external';
  field: string;
  fallback?: string;
  transformation?: string;
}

export interface DynamicContentRule {
  condition: ConditionRule;
  content: string;
  priority: number;
}

export interface ConditionRule {
  field: string;
  operator: 'equals' | 'contains' | 'in' | 'gt' | 'lt' | 'between' | 'exists' | 'not_exists';
  value: any;
}

export interface WaitCondition {
  type: 'time' | 'event' | 'condition';
  value: any;
  maxWaitDays?: number;
}

export interface CreateSequenceRequest {
  clientId: string;
  name: string;
  description?: string;
  triggerConditions: TriggerConditions;
  targetAudience: TargetAudience;
  steps: Omit<SequenceStep, 'id' | 'sequenceId' | 'createdAt'>[];
}

export interface EnrollProspectRequest {
  prospectId: string;
  sequenceId: string;
  metadata?: Record<string, any>;
}

export interface BehaviorEvent {
  prospectId: string;
  eventType: string;
  eventData: Record<string, any>;
  sessionId?: string;
  source?: string;
}

export interface AIAnalysisResult {
  prospectId: string;
  engagementScore: number;
  conversionProbability: number;
  recommendedActions: RecommendedAction[];
  insights: string[];
  nextBestSequence?: string;
  optimalTiming?: Date;
}

export interface SequencePerformanceData {
  sequenceId: string;
  sequenceName: string;
  totalEnrollments: number;
  completedSequences: number;
  activeSequences: number;
  metrics: PerformanceMetrics;
  avgEngagementScore: number;
  avgConversionProbability: number;
  avgCompletionDays: number;
}

export interface PerformanceMetrics {
  totalExecutions: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  failedCount: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  completionRate: number;
}

export interface EngagementTrendData {
  date: Date;
  metrics: PerformanceMetrics & {
    avgEngagementScore: number;
  };
}

export interface ConversionAnalyticsData {
  sequenceId: string;
  sequenceName: string;
  totalProspects: number;
  completedProspects: number;
  highConversionProspects: number;
  mediumConversionProspects: number;
  avgConversionProbability: number;
  totalReplies: number;
  prospectsReplied: number;
  completionRate: number;
  replyRate: number;
}

export interface StepAnalyticsData {
  stepOrder: number;
  stepType: string;
  subject: string;
  metrics: PerformanceMetrics & {
    avgOpens: number;
    avgClicks: number;
  };
}

export interface AIInsightsData {
  insights: AIInsight[];
  summary: {
    totalSequences: number;
    avgOpenRate: number;
    avgReplyRate: number;
    totalActiveProspects: number;
    topPerformingSequence: string;
  };
}

export interface AIInsight {
  type: string;
  title: string;
  description: string;
  recommendation: string;
}

export interface BehaviorInsightsData {
  eventFrequency: EventFrequencyData[];
  topSessions: SessionData[];
}

export interface EventFrequencyData {
  eventType: string;
  frequency: number;
  avgEngagementScore: number;
  lastOccurrence: Date;
  uniqueProspects: number;
}

export interface SessionData {
  sessionId: string;
  eventCount: number;
  totalEngagement: number;
  sessionStart: Date;
  sessionEnd: Date;
  sessionDuration: number;
}

export interface FunnelAnalyticsData {
  stageDistribution: StageDistribution[];
  conversionRates: ConversionRate[];
  avgTimeInStage: AvgTimeInStage[];
  stageProgression: StageProgression[];
}

export interface StageDistribution {
  funnel_stage: string;
  prospect_count: number;
  avg_confidence: number;
}

export interface ConversionRate {
  from_stage: string;
  to_stage: string;
  transitions: number;
  conversion_rate: number;
}

export interface AvgTimeInStage {
  funnel_stage: string;
  avg_days: number;
  median_days: number;
  sample_size: number;
}

export interface StageProgression {
  week: Date;
  funnel_stage: string;
  new_prospects: number;
}

export interface StagnantProspectData {
  prospectId: string;
  funnelStage: string;
  stageEnteredAt: Date;
  daysInStage: number;
  prospect: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
  };
  activeSequence?: string;
  engagementScore: number;
}

// Response wrapper interfaces
export interface SequencePerformanceResponse {
  data: SequencePerformanceData[];
}

export interface StepAnalyticsResponse {
  data: StepAnalyticsData[];
}

export interface EngagementTrendsResponse {
  data: EngagementTrendData[];
}

export interface ConversionAnalyticsResponse {
  data: ConversionAnalyticsData[];
}

export interface ProspectClassificationsResponse {
  data: ProspectClassification[];
}

export interface StagnantProspectsResponse {
  data: StagnantProspectData[];
}

export interface ContentVariationsResponse {
  data: GeneratedContent[];
}

export interface BehaviorAnalyticsResponse {
  data: BehaviorAnalytics[];
}

export interface ProspectSequencesResponse {
  data: ProspectSequence[];
}

export interface CreateContentTemplateRequest {
  type: 'email' | 'sms' | 'task';
  subject?: string;
  body: string;
  variables: string[];
  personalizationRules: PersonalizationRule[];
  dynamicContent: DynamicContentRule[];
}

export interface RecommendedAction {
  type: 'sequence' | 'content' | 'timing' | 'channel';
  action: string;
  confidence: number;
  reasoning: string;
}

export interface ContentGenerationRequest {
  prospectId: string;
  sequenceId: string;
  stepId: string;
  contentType: 'email' | 'sms' | 'task';
  context?: Record<string, any>;
}

export interface GeneratedContent {
  subject?: string;
  body: string;
  variables: Record<string, string>;
  personalizationApplied: string[];
  aiEnhancements: string[];
}