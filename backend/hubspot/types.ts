export interface HubSpotContact {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  phone?: string;
  lifecyclestage?: string;
  lead_status?: string;
  hs_lead_status?: string;
  createdate?: string;
  lastmodifieddate?: string;
  properties?: Record<string, any>;
}

export interface HubSpotDeal {
  id: string;
  dealname: string;
  amount?: number;
  closedate?: string;
  dealstage: string;
  pipeline: string;
  dealtype?: string;
  hubspot_owner_id?: string;
  associations?: {
    contacts?: string[];
    companies?: string[];
  };
  properties?: Record<string, any>;
}

export interface HubSpotCompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  createdate?: string;
  properties?: Record<string, any>;
}

export interface HubSpotConnection {
  id: string;
  name: string;
  access_token: string;
  refresh_token?: string;
  portal_id: string;
  app_id: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface AIDecision {
  action: 'create_contact' | 'update_contact' | 'create_deal' | 'update_deal' | 'send_email' | 'schedule_task' | 'move_deal_stage';
  confidence: number;
  reasoning: string;
  data: Record<string, any>;
  contact_id?: string;
  deal_id?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: 'contact_created' | 'contact_updated' | 'deal_created' | 'deal_updated' | 'email_opened' | 'email_clicked';
  conditions: Record<string, any>;
  ai_prompt: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SyncLog {
  id: string;
  connection_id: string;
  operation: string;
  hubspot_id?: string;
  local_id?: string;
  status: 'success' | 'error' | 'pending';
  error_message?: string;
  ai_decision?: AIDecision;
  created_at: Date;
}

export interface CreateConnectionRequest {
  name: string;
  access_token: string;
  refresh_token?: string;
  portal_id: string;
  app_id: string;
}

export interface UpdateConnectionRequest {
  name?: string;
  access_token?: string;
  refresh_token?: string;
  is_active?: boolean;
}

export interface CreateAutomationRuleRequest {
  name: string;
  trigger: 'contact_created' | 'contact_updated' | 'deal_created' | 'deal_updated' | 'email_opened' | 'email_clicked';
  conditions: Record<string, any>;
  ai_prompt: string;
}

export interface AIActionRequest {
  connection_id: string;
  trigger_data: Record<string, any>;
  context?: Record<string, any>;
}