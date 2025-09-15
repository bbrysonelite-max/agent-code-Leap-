export type AgentStatus = 'stopped' | 'running' | 'paused';
export type ProspectClassification = 'business_builder' | 'product_customer' | 'unqualified';
export type ProspectStatus = 'new' | 'contacted' | 'responded' | 'qualified' | 'converted';
export type EmailTemplateType = 'initial_outreach' | 'follow_up' | 'business_builder' | 'product_customer';
export type CampaignStatus = 'draft' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced';

export interface Agent {
  id: number;
  name: string;
  status: AgentStatus;
  prospects_found_today: number;
  emails_sent_today: number;
  responses_today: number;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Prospect {
  id: number;
  agent_id: number;
  name: string;
  email: string;
  linkedin_profile: string | null;
  company: string | null;
  position: string | null;
  classification: ProspectClassification;
  status: ProspectStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  template_type: EmailTemplateType;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmailCampaign {
  id: number;
  prospect_id: number;
  template_id: number;
  subject: string;
  body: string;
  sent_at: Date | null;
  opened_at: Date | null;
  clicked_at: Date | null;
  replied_at: Date | null;
  status: CampaignStatus;
  created_at: Date;
}

export interface DailyAnalytics {
  id: number;
  agent_id: number;
  date: Date;
  prospects_found: number;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  prospects_qualified: number;
  prospects_converted: number;
  created_at: Date;
}
