export type LeadSource = 'website' | 'social_media' | 'referral' | 'cold_outreach' | 'event' | 'import' | 'api';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'lost';
export type ContactType = 'prospect' | 'customer' | 'partner' | 'vendor';
export type DealStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task' | 'linkedin_message';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type SentimentScore = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  source: LeadSource;
  status: LeadStatus;
  ai_score: number;
  ai_qualification: string;
  next_best_action: string;
  priority: Priority;
  assigned_to?: string;
  linkedin_profile?: string;
  website?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  last_activity_at?: Date;
}

export interface Contact {
  id: string;
  lead_id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  type: ContactType;
  linkedin_profile?: string;
  twitter_handle?: string;
  website?: string;
  address?: string;
  tags: string[];
  ai_personality_profile?: string;
  communication_preferences?: string;
  lifetime_value: number;
  last_interaction_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Deal {
  id: string;
  contact_id: string;
  name: string;
  value: number;
  currency: string;
  stage: DealStage;
  probability: number;
  ai_win_probability: number;
  ai_risk_factors: string[];
  ai_recommendations: string[];
  expected_close_date?: Date;
  actual_close_date?: Date;
  assigned_to?: string;
  source: LeadSource;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Activity {
  id: string;
  contact_id?: string;
  deal_id?: string;
  lead_id?: string;
  type: ActivityType;
  subject: string;
  description?: string;
  outcome?: string;
  ai_sentiment: SentimentScore;
  ai_key_topics: string[];
  ai_action_items: string[];
  scheduled_at?: Date;
  completed_at?: Date;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AIInsight {
  id: string;
  entity_type: 'lead' | 'contact' | 'deal' | 'activity';
  entity_id: string;
  insight_type: string;
  title: string;
  description: string;
  confidence_score: number;
  actionable: boolean;
  priority: Priority;
  expires_at?: Date;
  acted_upon: boolean;
  created_at: Date;
}

export interface ConversationAnalysis {
  id: string;
  activity_id: string;
  transcript?: string;
  summary: string;
  sentiment: SentimentScore;
  key_points: string[];
  action_items: string[];
  objections: string[];
  buying_signals: string[];
  next_steps: string[];
  ai_score: number;
  created_at: Date;
}

export interface CreateLeadRequest {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  source: LeadSource;
  linkedin_profile?: string;
  website?: string;
  notes?: string;
}

export interface UpdateLeadRequest {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  status?: LeadStatus;
  assigned_to?: string;
  linkedin_profile?: string;
  website?: string;
  notes?: string;
}

export interface CreateContactRequest {
  lead_id?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  type: ContactType;
  linkedin_profile?: string;
  twitter_handle?: string;
  website?: string;
  address?: string;
  tags?: string[];
}

export interface CreateDealRequest {
  contact_id: string;
  name: string;
  value: number;
  currency?: string;
  stage: DealStage;
  probability?: number;
  expected_close_date?: Date;
  assigned_to?: string;
  source: LeadSource;
  notes?: string;
}

export interface CreateActivityRequest {
  contact_id?: string;
  deal_id?: string;
  lead_id?: string;
  type: ActivityType;
  subject: string;
  description?: string;
  outcome?: string;
  scheduled_at?: Date;
  completed_at?: Date;
}

export interface AnalyzeConversationRequest {
  activity_id: string;
  transcript?: string;
  context?: string;
}

export interface GetInsightsRequest {
  entity_type?: 'lead' | 'contact' | 'deal' | 'activity';
  entity_id?: string;
  insight_type?: string;
  limit?: number;
  only_actionable?: boolean;
}

export interface SearchRequest {
  query: string;
  entity_types?: ('lead' | 'contact' | 'deal' | 'activity')[];
  limit?: number;
  filters?: Record<string, any>;
}

export interface PipelineAnalytics {
  total_leads: number;
  qualified_leads: number;
  total_contacts: number;
  active_deals: number;
  total_deal_value: number;
  avg_deal_size: number;
  win_rate: number;
  avg_sales_cycle_days: number;
  conversion_rates: Record<string, number>;
  ai_score_distribution: Record<string, number>;
}

export interface NextBestAction {
  entity_type: 'lead' | 'contact' | 'deal';
  entity_id: string;
  action: string;
  reasoning: string;
  priority: Priority;
  estimated_impact: number;
  confidence: number;
  deadline?: Date;
}