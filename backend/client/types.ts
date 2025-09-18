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
    priority: 'high' | 'medium' | 'low';
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
    primary_goal: string; // e.g., "recruit distributors", "find customers", "generate leads"
  };
  
  // System settings
  daily_limits: {
    max_prospects_per_day: number;
    max_emails_per_day: number;
  };
  
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: number;
  client_id: number; // Link to client configuration
  name: string;
  status: 'stopped' | 'running' | 'paused';
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
  client_id: number; // Link to client configuration
  name: string;
  email: string;
  linkedin_profile: string | null;
  company: string | null;
  position: string | null;
  prospect_type: ProspectType; // Replaces old classification
  custom_prospect_type?: string; // For custom types
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'converted';
  notes: string | null;
  ai_score?: number;
  priority?: 'high' | 'medium' | 'low';
  score_reasons?: string[];
  last_scored_at?: Date;
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
    priority: 'high' | 'medium' | 'low';
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
    priority: 'high' | 'medium' | 'low';
  }[];
  search_config?: {
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
  messaging_config?: {
    brand_name?: string;
    value_proposition?: string;
    tone?: 'professional' | 'casual' | 'friendly' | 'formal';
    primary_goal?: string;
  };
  daily_limits?: {
    max_prospects_per_day?: number;
    max_emails_per_day?: number;
  };
  is_active?: boolean;
}