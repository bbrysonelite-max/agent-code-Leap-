export type BehaviorType = 
  | 'email_open' 
  | 'email_click' 
  | 'email_reply' 
  | 'website_visit' 
  | 'linkedin_view' 
  | 'linkedin_connect' 
  | 'phone_answer' 
  | 'phone_voicemail' 
  | 'content_download' 
  | 'meeting_scheduled' 
  | 'meeting_attended' 
  | 'meeting_no_show';

export type EngagementTrend = 'increasing' | 'decreasing' | 'stable' | 'neutral';
export type ContentPreference = 'email' | 'linkedin' | 'phone' | 'sms' | 'video';
export type SequenceStatus = 'active' | 'paused' | 'completed' | 'stopped';
export type CommunicationType = 'email' | 'linkedin_message' | 'phone_call' | 'sms' | 'task';
export type ClassificationTarget = 'hot' | 'warm' | 'cold' | 'nurture' | 'unqualified';
export type StageTarget = 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';

export interface ProspectBehavior {
  id: number;
  prospect_id: number;
  client_id: number;
  behavior_type: BehaviorType;
  behavior_data: Record<string, any>;
  engagement_score: number;
  created_at: Date;
}

export interface ProspectEngagementProfile {
  id: number;
  prospect_id: number;
  client_id: number;
  total_score: number;
  email_engagement_score: number;
  content_engagement_score: number;
  response_rate: number;
  avg_response_time_hours: number;
  preferred_content_type?: ContentPreference;
  optimal_send_time?: string;
  optimal_send_day?: number;
  engagement_trend: EngagementTrend;
  last_engagement_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface NurturingSequence {
  id: number;
  client_id: number;
  name: string;
  classification_target: ClassificationTarget;
  stage_target: StageTarget;
  sequence_type: string;
  total_steps: number;
  is_active: boolean;
  performance_score: number;
  conversion_rate: number;
  created_by_ai: boolean;
  template_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  steps?: SequenceStep[];
}

export interface SequenceStep {
  id: number;
  sequence_id: number;
  step_number: number;
  content_type: CommunicationType;
  delay_days: number;
  delay_hours: number;
  subject_template?: string;
  content_template: string;
  conditions: Record<string, any>;
  performance_metrics: Record<string, any>;
  is_active: boolean;
  created_at: Date;
}

export interface SequenceEnrollment {
  id: number;
  prospect_id: number;
  sequence_id: number;
  client_id: number;
  current_step: number;
  status: SequenceStatus;
  enrolled_at: Date;
  last_step_sent_at?: Date;
  next_step_scheduled_at?: Date;
  completion_reason?: string;
  created_at: Date;
  updated_at: Date;
  sequence?: NurturingSequence;
}

export interface NurturingCommunication {
  id: number;
  enrollment_id: number;
  step_id: number;
  prospect_id: number;
  communication_type: CommunicationType;
  subject?: string;
  content: string;
  sent_at: Date;
  opened_at?: Date;
  clicked_at?: Date;
  replied_at?: Date;
  engagement_score: number;
  created_at: Date;
}

export interface SequenceABTest {
  id: number;
  sequence_id: number;
  test_name: string;
  variant_a_data: Record<string, any>;
  variant_b_data: Record<string, any>;
  traffic_split: number;
  status: 'active' | 'paused' | 'completed';
  winner?: 'a' | 'b';
  statistical_significance: number;
  start_date: Date;
  end_date?: Date;
  created_at: Date;
}

// Request/Response types
export interface TrackBehaviorRequest {
  prospect_id: number;
  client_id: number;
  behavior_type: BehaviorType;
  behavior_data?: Record<string, any>;
}

export interface CreateSequenceRequest {
  client_id: number;
  name: string;
  classification_target: ClassificationTarget;
  stage_target: StageTarget;
  sequence_type?: string;
  steps: CreateSequenceStepRequest[];
  template_data?: Record<string, any>;
}

export interface CreateSequenceStepRequest {
  step_number: number;
  content_type: CommunicationType;
  delay_days: number;
  delay_hours?: number;
  subject_template?: string;
  content_template: string;
  conditions?: Record<string, any>;
}

export interface EnrollProspectRequest {
  prospect_id: number;
  sequence_id: number;
  client_id: number;
}

export interface AISequenceGenerationRequest {
  client_id: number;
  prospect_data: Record<string, any>;
  classification: ClassificationTarget;
  stage: StageTarget;
  sequence_length?: number;
  preferred_channels?: CommunicationType[];
}

export interface AIAnalysisRequest {
  prospect_id: number;
  client_id: number;
  analysis_type: 'engagement_prediction' | 'content_optimization' | 'timing_optimization' | 'channel_optimization';
  context?: Record<string, any>;
}

export interface AIAnalysisResponse {
  recommendations: string[];
  confidence_score: number;
  reasoning: string;
  suggested_actions: string[];
  data: Record<string, any>;
}

export interface EngagementAnalytics {
  total_enrollments: number;
  active_enrollments: number;
  completed_enrollments: number;
  average_completion_rate: number;
  top_performing_sequences: Array<{
    sequence_id: number;
    name: string;
    conversion_rate: number;
    engagement_score: number;
  }>;
  engagement_trends: Array<{
    date: string;
    total_engagements: number;
    average_score: number;
  }>;
}

export interface SequencePerformanceMetrics {
  sequence_id: number;
  total_enrollments: number;
  active_enrollments: number;
  completion_rate: number;
  average_engagement_score: number;
  conversion_rate: number;
  step_performance: Array<{
    step_number: number;
    open_rate: number;
    click_rate: number;
    reply_rate: number;
    engagement_score: number;
  }>;
}