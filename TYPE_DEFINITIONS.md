# 📐 TypeScript Type Definitions - AI Prospecting Agent Platform

**Version**: 1.0.0
**Last Updated**: 2025-11-22

---

## Table of Contents

1. [Core Types](#core-types)
2. [Agent Types](#agent-types)
3. [Prospect Types](#prospect-types)
4. [Scoring Types](#scoring-types)
5. [Email & Campaign Types](#email--campaign-types)
6. [AI CRM Types](#ai-crm-types)
7. [Client Configuration Types](#client-configuration-types)
8. [Analytics Types](#analytics-types)
9. [Integration Types](#integration-types)
10. [Infrastructure Types](#infrastructure-types)

---

## Core Types

### Enumerations

```typescript
// ==================================
// CORE ENUMERATIONS
// ==================================

export type UserRole = 'super_admin' | 'client_admin' | 'user' | 'viewer';

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';

export type Status = 'active' | 'inactive' | 'suspended' | 'deleted';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
```

---

## Agent Types

### Agent Status & Classification

```typescript
// ==================================
// AGENT TYPES
// ==================================

export type AgentStatus = 'stopped' | 'running' | 'paused';

export interface Agent {
  id: number;
  client_id: number;
  name: string;
  status: AgentStatus;
  prospects_found_today: number;
  emails_sent_today: number;
  responses_today: number;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAgentRequest {
  client_id: number;
  name: string;
}

export interface UpdateAgentRequest {
  id: number;
  name?: string;
  status?: AgentStatus;
}

export interface AgentControlRequest {
  agent_id: number;
  action: 'start' | 'pause' | 'stop';
}

export interface AgentAnalytics {
  agent_id: number;
  date_range: {
    start: Date;
    end: Date;
  };
  total_prospects_found: number;
  total_emails_sent: number;
  total_responses: number;
  avg_prospects_per_day: number;
  avg_emails_per_day: number;
  avg_response_rate: number;
  top_prospect_types: {
    type: string;
    count: number;
  }[];
  activity_timeline: {
    date: Date;
    prospects_found: number;
    emails_sent: number;
    responses: number;
  }[];
}
```

---

## Prospect Types

### Prospect Classification & Status

```typescript
// ==================================
// PROSPECT TYPES
// ==================================

export type ProspectType =
  | 'customer'
  | 'distributor'
  | 'business_builder'
  | 'recruits'
  | 'leads'
  | 'referrals'
  | 'partners'
  | 'clients'
  | 'custom';

export type ProspectStatus =
  | 'new'
  | 'contacted'
  | 'responded'
  | 'qualified'
  | 'converted'
  | 'lost';

export interface Prospect {
  id: number;
  agent_id: number;
  client_id: number;
  name: string;
  email: string;
  phone?: string;
  linkedin_profile?: string;
  company?: string;
  position?: string;
  prospect_type: ProspectType;
  custom_prospect_type?: string;
  status: ProspectStatus;
  notes?: string;
  ai_score?: number;
  priority?: Priority;
  score_reasons?: string[];
  last_scored_at?: Date;
  tags?: string[];
  source?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface CreateProspectRequest {
  agent_id: number;
  client_id: number;
  name: string;
  email: string;
  phone?: string;
  linkedin_profile?: string;
  company?: string;
  position?: string;
  prospect_type: ProspectType;
  custom_prospect_type?: string;
  notes?: string;
  tags?: string[];
  source?: string;
}

export interface UpdateProspectRequest {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  linkedin_profile?: string;
  company?: string;
  position?: string;
  prospect_type?: ProspectType;
  custom_prospect_type?: string;
  status?: ProspectStatus;
  notes?: string;
  tags?: string[];
}

export interface ProspectSearchRequest {
  client_id: number;
  query?: string;
  prospect_types?: ProspectType[];
  statuses?: ProspectStatus[];
  priorities?: Priority[];
  min_score?: number;
  max_score?: number;
  tags?: string[];
  created_after?: Date;
  created_before?: Date;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'updated_at' | 'ai_score' | 'name';
  sort_order?: 'asc' | 'desc';
}

export interface ProspectSearchResponse {
  prospects: Prospect[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface BulkImportProspectRequest {
  client_id: number;
  agent_id: number;
  prospects: Omit<CreateProspectRequest, 'agent_id' | 'client_id'>[];
}

export interface BulkImportProspectResponse {
  success_count: number;
  error_count: number;
  errors: {
    row: number;
    email: string;
    reason: string;
  }[];
}
```

---

## Scoring Types

### Lead Scoring System

```typescript
// ==================================
// SCORING TYPES
// ==================================

export interface ProspectScore {
  prospect_id: string;
  total_score: number;
  company_score: number;
  position_score: number;
  linkedin_score: number;
  email_engagement_score: number;
  priority: Priority;
  last_updated: Date;
  reasons: string[];
}

export interface ScoringFactors {
  // Company factors
  company_size?: number; // Number of employees
  company_revenue?: number; // Annual revenue (USD)
  company_industry?: string;
  company_growth_rate?: number; // Percentage

  // Position factors
  position?: string;
  seniority?: 'individual_contributor' | 'manager' | 'director' | 'vp' | 'c_level';
  department?: string;

  // LinkedIn factors
  linkedin_connections?: number;
  linkedin_activity?: number; // Posts/comments per month
  linkedin_followers?: number;
  linkedin_profile_completeness?: number; // 0-100

  // Email engagement factors
  email_open_rate?: number; // Percentage
  email_click_rate?: number; // Percentage
  email_replies?: number; // Count
  last_email_engagement?: Date;

  // Behavioral factors
  website_visits?: number;
  content_downloads?: number;
  demo_requests?: number;
}

export interface ScoreWeights {
  company_size: number; // Default: 0.20
  company_revenue: number; // Default: 0.15
  position: number; // Default: 0.25
  seniority: number; // Default: 0.15
  linkedin_activity: number; // Default: 0.10
  email_engagement: number; // Default: 0.15
}

export interface PriorityRecommendation {
  prospect_id: string;
  name: string;
  email: string;
  company?: string;
  score: number;
  priority: Priority;
  reasons: string[];
  next_action: string;
  confidence: number; // 0-100
  estimated_conversion_probability: number; // 0-100
}

export interface ScoreAnalysisRequest {
  prospect_id: string;
  factors: ScoringFactors;
  custom_weights?: Partial<ScoreWeights>;
}

export interface ScoreAnalysisResponse {
  score: ProspectScore;
  recommendations: string[];
  improvement_areas: string[];
}

export interface BulkScoreRequest {
  prospect_ids: string[];
  force_rescore?: boolean; // Force rescore even if recently scored
}

export interface BulkScoreResponse {
  scores: ProspectScore[];
  total_scored: number;
  errors: {
    prospect_id: string;
    reason: string;
  }[];
}

export interface TopProspectsRequest {
  client_id: number;
  limit?: number; // Default: 50
  min_score?: number; // Default: 60
  priority?: Priority;
  prospect_types?: ProspectType[];
  statuses?: ProspectStatus[];
}

export interface TopProspectsResponse {
  prospects: (Prospect & { score: ProspectScore })[];
  total_count: number;
}
```

---

## Email & Campaign Types

### Email Campaigns & Templates

```typescript
// ==================================
// EMAIL & CAMPAIGN TYPES
// ==================================

export type EmailTemplateType =
  | 'initial_outreach'
  | 'follow_up'
  | 'business_builder'
  | 'product_customer'
  | 'nurturing'
  | 'custom';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'paused'
  | 'completed'
  | 'failed';

export type EmailStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'spam'
  | 'unsubscribed';

export interface EmailTemplate {
  id: number;
  client_id: number;
  name: string;
  subject: string;
  body: string;
  template_type: EmailTemplateType;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEmailTemplateRequest {
  client_id: number;
  name: string;
  subject: string;
  body: string;
  template_type: EmailTemplateType;
}

export interface EmailCampaign {
  id: number;
  client_id: number;
  name: string;
  template_id: number;
  subject: string;
  body: string;
  recipient_count: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  bounced_count: number;
  status: CampaignStatus;
  scheduled_at?: Date;
  sent_at?: Date;
  completed_at?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEmailCampaignRequest {
  client_id: number;
  name: string;
  template_id?: number;
  subject: string;
  body: string;
  prospect_ids: number[];
  scheduled_at?: Date;
}

export interface EmailLog {
  id: number;
  campaign_id: number;
  prospect_id: number;
  subject: string;
  body: string;
  status: EmailStatus;
  sent_at?: Date;
  opened_at?: Date;
  clicked_at?: Date;
  replied_at?: Date;
  bounced_at?: Date;
  bounce_reason?: string;
  open_count: number;
  click_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface SendEmailRequest {
  client_id: number;
  prospect_id: number;
  subject: string;
  body: string;
  template_id?: number;
  campaign_id?: number;
  scheduled_at?: Date;
}

export interface GenerateEmailRequest {
  prospect_name: string;
  company?: string;
  position?: string;
  prospect_type: ProspectType;
  goal: string; // e.g., "Schedule a demo", "Recruit as distributor"
  tone: 'professional' | 'casual' | 'friendly' | 'formal';
  context?: string; // Additional context for AI
}

export interface GenerateEmailResponse {
  subject: string;
  body: string;
  personalization_tokens: string[]; // e.g., ["{{name}}", "{{company}}"]
}

export interface EmailEngagementMetrics {
  campaign_id: number;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
  total_unsubscribed: number;
  open_rate: number; // Percentage
  click_rate: number; // Percentage
  reply_rate: number; // Percentage
  bounce_rate: number; // Percentage
  unsubscribe_rate: number; // Percentage
}
```

### Nurturing Sequences

```typescript
// ==================================
// NURTURING SEQUENCE TYPES
// ==================================

export type NurturingTrigger =
  | 'enrollment' // Start immediately on enrollment
  | 'opened_previous' // Previous email was opened
  | 'clicked_previous' // Previous email was clicked
  | 'not_opened' // Previous email NOT opened after X days
  | 'replied' // Prospect replied
  | 'always' // Always send (no conditions)
  | 'manual'; // Manually triggered

export interface NurturingSequence {
  id: number;
  client_id: number;
  name: string;
  description?: string;
  goal?: string; // e.g., "Book Demo", "Sign Up"
  is_active: boolean;
  exit_on_reply: boolean;
  exit_on_unsubscribe: boolean;
  exit_on_bounce: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface NurturingStep {
  id: number;
  sequence_id: number;
  step_number: number;
  template_id: number;
  subject: string;
  body: string;
  delay_days: number; // Days to wait after previous step
  delay_hours?: number; // Additional hours to wait
  trigger: NurturingTrigger;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNurturingSequenceRequest {
  client_id: number;
  name: string;
  description?: string;
  goal?: string;
  steps: Omit<NurturingStep, 'id' | 'sequence_id' | 'created_at' | 'updated_at'>[];
  exit_on_reply?: boolean;
  exit_on_unsubscribe?: boolean;
  exit_on_bounce?: boolean;
}

export interface EnrollInSequenceRequest {
  sequence_id: number;
  prospect_ids: number[];
}

export interface ProspectSequenceEnrollment {
  id: number;
  sequence_id: number;
  prospect_id: number;
  current_step: number;
  status: 'active' | 'paused' | 'completed' | 'exited';
  exit_reason?: 'replied' | 'unsubscribed' | 'bounced' | 'manual' | 'goal_achieved';
  enrolled_at: Date;
  last_email_sent_at?: Date;
  completed_at?: Date;
  exited_at?: Date;
}

export interface NurturingSequenceAnalytics {
  sequence_id: number;
  total_enrolled: number;
  currently_active: number;
  completed: number;
  exited: number;
  goal_achieved: number;
  avg_steps_completed: number;
  conversion_rate: number; // Percentage
  step_performance: {
    step_number: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    open_rate: number;
    click_rate: number;
    reply_rate: number;
  }[];
}
```

---

## AI CRM Types

### Lead Management

```typescript
// ==================================
// AI CRM TYPES
// ==================================

export type LeadSource =
  | 'website'
  | 'social_media'
  | 'referral'
  | 'cold_outreach'
  | 'event'
  | 'import'
  | 'api'
  | 'partner';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'unqualified'
  | 'converted'
  | 'lost';

export type ContactType = 'prospect' | 'customer' | 'partner' | 'vendor';

export interface Lead {
  id: string; // UUID
  client_id: number;
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
  id: string; // UUID
  client_id: number;
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
  id: string;
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
```

### Deal Pipeline

```typescript
export type DealStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface Deal {
  id: string; // UUID
  client_id: number;
  contact_id: string;
  name: string;
  value: number;
  currency: Currency;
  stage: DealStage;
  probability: number; // 0-100
  ai_win_probability: number; // AI-calculated 0-100
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

export interface CreateDealRequest {
  contact_id: string;
  name: string;
  value: number;
  currency?: Currency;
  stage: DealStage;
  probability?: number;
  expected_close_date?: Date;
  assigned_to?: string;
  source: LeadSource;
  notes?: string;
}

export interface UpdateDealRequest {
  id: string;
  name?: string;
  value?: number;
  stage?: DealStage;
  probability?: number;
  expected_close_date?: Date;
  actual_close_date?: Date;
  assigned_to?: string;
  notes?: string;
}

export interface DealPipelineView {
  total_value: number;
  weighted_value: number; // total_value * probability
  deals_by_stage: {
    stage: DealStage;
    count: number;
    total_value: number;
    avg_deal_size: number;
    deals: Deal[];
  }[];
}
```

### Activities & Insights

```typescript
export type ActivityType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'note'
  | 'task'
  | 'linkedin_message'
  | 'demo'
  | 'proposal_sent';

export type SentimentScore =
  | 'very_negative'
  | 'negative'
  | 'neutral'
  | 'positive'
  | 'very_positive';

export interface Activity {
  id: string; // UUID
  client_id: number;
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

export interface AIInsight {
  id: string; // UUID
  client_id: number;
  entity_type: 'lead' | 'contact' | 'deal' | 'activity';
  entity_id: string;
  insight_type: string; // e.g., "risk", "opportunity", "recommendation"
  title: string;
  description: string;
  confidence_score: number; // 0-100
  actionable: boolean;
  priority: Priority;
  expires_at?: Date;
  acted_upon: boolean;
  created_at: Date;
}

export interface ConversationAnalysis {
  id: string; // UUID
  activity_id: string;
  transcript?: string;
  summary: string;
  sentiment: SentimentScore;
  key_points: string[];
  action_items: string[];
  objections: string[];
  buying_signals: string[];
  next_steps: string[];
  ai_score: number; // Overall conversation quality 0-100
  created_at: Date;
}

export interface AnalyzeConversationRequest {
  activity_id: string;
  transcript?: string;
  context?: string; // Additional context for AI
}

export interface NextBestAction {
  entity_type: 'lead' | 'contact' | 'deal';
  entity_id: string;
  action: string; // e.g., "Send follow-up email", "Schedule demo"
  reasoning: string;
  priority: Priority;
  estimated_impact: number; // 0-100
  confidence: number; // 0-100
  deadline?: Date;
}
```

---

## Client Configuration Types

### Multi-Tenancy Configuration

```typescript
// ==================================
// CLIENT CONFIGURATION TYPES
// ==================================

export type BusinessType =
  | 'network_marketing'
  | 'direct_sales'
  | 'real_estate'
  | 'insurance'
  | 'consulting'
  | 'coaching'
  | 'ecommerce'
  | 'saas'
  | 'recruitment'
  | 'custom';

export interface ClientConfiguration {
  id: number;
  client_name: string;
  business_type: BusinessType;
  business_description?: string;

  // Prospect types this client wants to find
  enabled_prospect_types: ProspectType[];

  // Custom prospect types for flexible business models
  custom_prospect_types?: {
    type_name: string;
    description: string;
    priority: Priority;
  }[];

  // Search criteria configuration
  search_config: {
    target_industries?: string[];
    target_positions?: string[];
    company_size_range?: {
      min?: number;
      max?: number;
    };
    location_preferences?: string[];
    exclude_keywords?: string[];
    include_keywords?: string[];
  };

  // Email templates and messaging
  messaging_config: {
    brand_name: string;
    value_proposition: string;
    tone: 'professional' | 'casual' | 'friendly' | 'formal';
    primary_goal: string;
  };

  // System settings
  daily_limits: {
    max_prospects_per_day: number;
    max_emails_per_day: number;
  };

  // Subscription & billing
  subscription_tier: SubscriptionTier;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;

  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateClientRequest {
  client_name: string;
  business_type: BusinessType;
  business_description?: string;
  enabled_prospect_types: ProspectType[];
  custom_prospect_types?: {
    type_name: string;
    description: string;
    priority: Priority;
  }[];
  search_config: {
    target_industries?: string[];
    target_positions?: string[];
    company_size_range?: {
      min?: number;
      max?: number;
    };
    location_preferences?: string[];
    exclude_keywords?: string[];
    include_keywords?: string[];
  };
  messaging_config: {
    brand_name: string;
    value_proposition: string;
    tone: 'professional' | 'casual' | 'friendly' | 'formal';
    primary_goal: string;
  };
  daily_limits?: {
    max_prospects_per_day?: number;
    max_emails_per_day?: number;
  };
}

export interface UpdateClientRequest {
  id: number;
  client_name?: string;
  business_type?: BusinessType;
  business_description?: string;
  enabled_prospect_types?: ProspectType[];
  custom_prospect_types?: {
    type_name: string;
    description: string;
    priority: Priority;
  }[];
  search_config?: Partial<ClientConfiguration['search_config']>;
  messaging_config?: Partial<ClientConfiguration['messaging_config']>;
  daily_limits?: Partial<ClientConfiguration['daily_limits']>;
  is_active?: boolean;
}
```

---

## Analytics Types

### Analytics & Reporting

```typescript
// ==================================
// ANALYTICS TYPES
// ==================================

export interface DashboardMetrics {
  period: {
    start: Date;
    end: Date;
  };
  prospects: {
    total: number;
    new: number;
    qualified: number;
    converted: number;
    conversion_rate: number;
  };
  emails: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    open_rate: number;
    click_rate: number;
    reply_rate: number;
    bounce_rate: number;
  };
  deals: {
    total_value: number;
    active_deals: number;
    closed_won: number;
    closed_lost: number;
    win_rate: number;
    avg_deal_size: number;
    avg_sales_cycle_days: number;
  };
  agents: {
    total_agents: number;
    active_agents: number;
    avg_prospects_per_agent: number;
    top_performing_agents: {
      agent_id: number;
      agent_name: string;
      prospects_found: number;
      conversion_rate: number;
    }[];
  };
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
  conversion_rates: {
    [key: string]: number; // e.g., "new_to_contacted": 45.2
  };
  ai_score_distribution: {
    low: number; // 0-59
    medium: number; // 60-79
    high: number; // 80-100
  };
}

export interface ConversionFunnel {
  stage: string;
  count: number;
  conversion_rate: number; // % from previous stage
  drop_off_rate: number;
}

export interface TimeSeriesData {
  date: Date;
  value: number;
  label?: string;
}

export interface ReportRequest {
  client_id: number;
  report_type: 'dashboard' | 'pipeline' | 'email' | 'conversion' | 'roi';
  date_range: {
    start: Date;
    end: Date;
  };
  filters?: {
    agent_ids?: number[];
    prospect_types?: ProspectType[];
    statuses?: string[];
  };
  format?: 'json' | 'csv' | 'pdf';
}

export interface ScheduledReport {
  id: number;
  client_id: number;
  name: string;
  report_type: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[]; // Email addresses
  next_run_at: Date;
  last_run_at?: Date;
  is_active: boolean;
  created_at: Date;
}
```

---

## Integration Types

### External Service Integrations

```typescript
// ==================================
// INTEGRATION TYPES
// ==================================

// HubSpot Integration
export interface HubSpotConfig {
  client_id: number;
  access_token: string;
  refresh_token: string;
  portal_id: string;
  is_active: boolean;
  last_sync_at?: Date;
  field_mappings: {
    [localField: string]: string; // e.g., "company": "hs_company_name"
  };
  sync_direction: 'one_way' | 'bi_directional';
  auto_sync: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface HubSpotSyncRequest {
  client_id: number;
  entity_type: 'contact' | 'deal';
  entity_id: string;
}

export interface HubSpotWebhookPayload {
  portal_id: string;
  object_type: 'contact' | 'deal';
  object_id: string;
  event_type: 'created' | 'updated' | 'deleted';
  properties: Record<string, any>;
}

// Stripe Integration
export interface StripeConfig {
  client_id: number;
  customer_id: string;
  subscription_id?: string;
  plan_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSubscriptionRequest {
  client_id: number;
  plan_id: string;
  payment_method_id: string;
}

export interface StripeWebhookPayload {
  type: string; // e.g., "invoice.payment_succeeded"
  data: {
    object: any;
  };
}
```

---

## Infrastructure Types

### Rate Limiting & Audit

```typescript
// ==================================
// INFRASTRUCTURE TYPES
// ==================================

export interface RateLimit {
  user_id: string;
  client_id: number;
  endpoint: string;
  tier: SubscriptionTier;
  limit: number; // Requests per window
  window: number; // Window size in seconds
  current_usage: number;
  reset_at: Date;
}

export interface AuditLog {
  id: string; // UUID
  client_id: number;
  user_id?: string;
  action: string; // e.g., "prospect.create", "email.send"
  entity_type?: string;
  entity_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_path?: string;
  request_body?: any;
  response_status?: number;
  error_message?: string;
  created_at: Date;
}

export interface GDPRRequest {
  id: string; // UUID
  client_id: number;
  user_id: string;
  request_type: 'export' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requested_at: Date;
  completed_at?: Date;
  download_url?: string;
  error_message?: string;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: Date;
  services: {
    name: string;
    status: 'up' | 'down';
    response_time_ms: number;
  }[];
  database: {
    status: 'connected' | 'disconnected';
    latency_ms: number;
  };
  redis: {
    status: 'connected' | 'disconnected';
    latency_ms: number;
  };
}
```

---

## Error Types

### API Error Responses

```typescript
// ==================================
// ERROR TYPES
// ==================================

export interface APIError {
  code: string; // e.g., "RATE_LIMIT_EXCEEDED", "VALIDATION_ERROR"
  message: string;
  details?: any;
  timestamp: Date;
  request_id: string;
}

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'PAYMENT_REQUIRED'
  | 'CONFLICT';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

---

## Utility Types

### Common Utility Types

```typescript
// ==================================
// UTILITY TYPES
// ==================================

export interface PaginationRequest {
  page?: number; // Default: 1
  per_page?: number; // Default: 50, Max: 100
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FilterOptions {
  search_query?: string;
  filters?: Record<string, any>;
  date_range?: DateRange;
}

export type SortOrder = 'asc' | 'desc';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
```

---

## Type Guards & Validators

```typescript
// ==================================
// TYPE GUARDS
// ==================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidProspectType(type: string): type is ProspectType {
  const validTypes: ProspectType[] = [
    'customer',
    'distributor',
    'business_builder',
    'recruits',
    'leads',
    'referrals',
    'partners',
    'clients',
    'custom',
  ];
  return validTypes.includes(type as ProspectType);
}

export function isValidPriority(priority: string): priority is Priority {
  return ['low', 'medium', 'high', 'urgent'].includes(priority);
}

export function isValidSubscriptionTier(tier: string): tier is SubscriptionTier {
  return ['free', 'basic', 'premium', 'enterprise'].includes(tier);
}
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-22
**Next Review**: 2026-02-22
