export type ProspectClassification = 'hot' | 'warm' | 'cold' | 'unengaged' | 'competitor';
export type FunnelStage = 'awareness' | 'interest' | 'consideration' | 'intent' | 'decision' | 'retention';
export type EngagementLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
export type SequenceStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
export type SequenceStepType = 'email' | 'call' | 'social_media' | 'delay' | 'conditional';
export type SequenceStepStatus = 'pending' | 'scheduled' | 'sent' | 'failed' | 'skipped';
export type BehaviorType = 'email_open' | 'email_click' | 'website_visit' | 'form_submit' | 'download' | 'meeting_booked' | 'reply' | 'social_engagement';
export type ContentVariant = 'personal' | 'professional' | 'casual' | 'formal' | 'educational' | 'promotional';

export interface ProspectBehavior {
  id: string;
  prospect_id: string;
  behavior_type: BehaviorType;
  metadata: Record<string, any>;
  timestamp: Date;
  engagement_score: number;
  ai_sentiment?: string;
  source_campaign_id?: string;
  created_at: Date;
}

export interface EngagementPattern {
  id: string;
  prospect_id: string;
  pattern_type: string;
  description: string;
  frequency_score: number;
  engagement_level: EngagementLevel;
  preferred_channels: string[];
  optimal_timing: string;
  ai_insights: string[];
  confidence_score: number;
  last_updated: Date;
  created_at: Date;
}

export interface ProspectClassificationData {
  id: string;
  prospect_id: string;
  classification: ProspectClassification;
  funnel_stage: FunnelStage;
  engagement_level: EngagementLevel;
  ai_reasoning: string;
  behavioral_indicators: string[];
  demographic_factors: string[];
  interaction_history_summary: string;
  confidence_score: number;
  next_best_actions: string[];
  estimated_close_probability: number;
  predicted_revenue: number;
  classification_expires_at: Date;
  last_updated: Date;
  created_at: Date;
}

export interface NurturingSequence {
  id: string;
  name: string;
  description: string;
  target_classification: ProspectClassification;
  target_funnel_stage: FunnelStage;
  status: SequenceStatus;
  ai_optimization_enabled: boolean;
  performance_metrics: Record<string, number>;
  total_steps: number;
  completion_rate: number;
  conversion_rate: number;
  avg_engagement_rate: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  step_number: number;
  step_type: SequenceStepType;
  name: string;
  delay_days: number;
  delay_hours: number;
  conditions: Record<string, any>;
  content_template: string;
  personalization_variables: string[];
  ai_dynamic_content: boolean;
  success_criteria: Record<string, any>;
  fallback_action?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProspectSequenceEnrollment {
  id: string;
  prospect_id: string;
  sequence_id: string;
  current_step: number;
  status: SequenceStatus;
  enrolled_at: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  cancellation_reason?: string;
  total_engagement_score: number;
  performance_data: Record<string, any>;
  ai_optimization_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface SequenceStepExecution {
  id: string;
  enrollment_id: string;
  step_id: string;
  prospect_id: string;
  status: SequenceStepStatus;
  scheduled_at: Date;
  executed_at?: Date;
  failed_at?: Date;
  content_generated: string;
  personalization_data: Record<string, any>;
  ai_optimization_applied: Record<string, any>;
  engagement_metrics: Record<string, any>;
  error_message?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContentVariation {
  id: string;
  sequence_step_id: string;
  variant_type: ContentVariant;
  template_content: string;
  ai_generated: boolean;
  performance_score: number;
  usage_count: number;
  conversion_rate: number;
  engagement_rate: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AIContentGeneration {
  id: string;
  prospect_id: string;
  sequence_step_id: string;
  prompt_used: string;
  generated_content: string;
  personalization_factors: Record<string, any>;
  quality_score: number;
  relevance_score: number;
  sentiment_tone: string;
  reading_level: string;
  content_length: number;
  ai_model_version: string;
  generation_time_ms: number;
  created_at: Date;
}

// Request/Response Types
export interface AnalyzeBehaviorRequest {
  prospect_id: string;
  behaviors?: ProspectBehavior[];
  include_predictions?: boolean;
}

export interface AnalyzeBehaviorResponse {
  prospect_id: string;
  classification: ProspectClassificationData;
  engagement_pattern: EngagementPattern;
  recommended_sequences: string[];
  next_best_actions: string[];
  ai_insights: string[];
}

export interface CreateSequenceRequest {
  name: string;
  description: string;
  target_classification: ProspectClassification;
  target_funnel_stage: FunnelStage;
  steps: CreateSequenceStepRequest[];
  ai_optimization_enabled?: boolean;
}

export interface CreateSequenceStepRequest {
  step_number: number;
  step_type: SequenceStepType;
  name: string;
  delay_days: number;
  delay_hours?: number;
  conditions?: Record<string, any>;
  content_template: string;
  personalization_variables?: string[];
  ai_dynamic_content?: boolean;
  success_criteria?: Record<string, any>;
  fallback_action?: string;
}

export interface EnrollProspectRequest {
  prospect_id: string;
  sequence_id: string;
  override_classification?: boolean;
  custom_variables?: Record<string, any>;
}

export interface GenerateContentRequest {
  prospect_id: string;
  sequence_step_id: string;
  content_variant?: ContentVariant;
  custom_variables?: Record<string, any>;
  tone_preference?: string;
}

export interface GenerateContentResponse {
  content: string;
  personalization_data: Record<string, any>;
  ai_insights: string[];
  quality_metrics: Record<string, number>;
  generation_id: string;
}

export interface GetSequencePerformanceRequest {
  sequence_id: string;
  date_from?: Date;
  date_to?: Date;
  include_step_breakdown?: boolean;
}

export interface GetSequencePerformanceResponse {
  sequence_id: string;
  period_start: Date;
  period_end: Date;
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  conversion_rate: number;
  avg_engagement_score: number;
  step_performance: Record<string, any>[];
  ai_optimization_impact: Record<string, any>;
  revenue_attributed: number;
}

export interface OptimizeSequenceRequest {
  sequence_id: string;
  optimization_goals: string[];
  test_duration_days?: number;
}

export interface BulkEnrollRequest {
  prospect_ids: string[];
  sequence_id: string;
  enrollment_criteria?: Record<string, any>;
}

export interface GetNurturingAnalyticsRequest {
  date_from?: Date;
  date_to?: Date;
  sequence_ids?: string[];
  classification_filter?: ProspectClassification[];
}

export interface GetNurturingAnalyticsResponse {
  period_start: Date;
  period_end: Date;
  total_prospects_nurtured: number;
  total_sequences_active: number;
  overall_conversion_rate: number;
  avg_time_to_conversion_days: number;
  classification_breakdown: Record<string, number>;
  funnel_stage_distribution: Record<string, number>;
  top_performing_sequences: any[];
  ai_optimization_metrics: Record<string, any>;
  revenue_impact: number;
}