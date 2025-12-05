-- Comprehensive Performance Indexes for All Services
-- This migration adds optimized indexes for frequently accessed query patterns

-- ===== PROSPECTS TABLE INDEXES =====
-- Core prospect queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_agent_status ON prospects(agent_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_agent_classification ON prospects(agent_id, classification);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_agent_created ON prospects(agent_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_status_created ON prospects(status, created_at DESC);

-- Search performance (full-text search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_fts ON prospects USING gin(to_tsvector('english', name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, '')));

-- Email domain analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_email_domain ON prospects(SUBSTRING(email FROM '@(.*)$'));

-- Geographic and company size filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_location ON prospects(location) WHERE location IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_company_size ON prospects(company_size) WHERE company_size IS NOT NULL;

-- ===== EMAIL CAMPAIGNS TABLE INDEXES =====
-- Campaign performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_prospect_status ON email_campaigns(prospect_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_template_sent ON email_campaigns(template_id, sent_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_status_sent ON email_campaigns(status, sent_at DESC);

-- Email analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_opened_at ON email_campaigns(opened_at) WHERE opened_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_clicked_at ON email_campaigns(clicked_at) WHERE clicked_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_replied_at ON email_campaigns(replied_at) WHERE replied_at IS NOT NULL;

-- Bounce and delivery tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_bounced ON email_campaigns(bounced_at) WHERE bounced_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_delivered ON email_campaigns(delivered_at) WHERE delivered_at IS NOT NULL;

-- ===== PROSPECT SCORES TABLE INDEXES =====
-- Scoring queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospect_scores_total_updated ON prospect_scores(total_score DESC, last_updated DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospect_scores_priority_updated ON prospect_scores(priority, last_updated DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospect_scores_company_score ON prospect_scores(company_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospect_scores_position_score ON prospect_scores(position_score DESC);

-- Multi-factor scoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospect_scores_composite ON prospect_scores(total_score DESC, company_score DESC, position_score DESC);

-- ===== AI CRM TABLES INDEXES =====
-- Leads table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_created ON leads(source, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_assigned_user ON leads(assigned_to, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_score_created ON leads(lead_score DESC, created_at DESC);

-- Contacts table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_company_created ON contacts(company_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_email_domain ON contacts(SUBSTRING(email FROM '@(.*)$'));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_last_contact ON contacts(last_contact_date DESC) WHERE last_contact_date IS NOT NULL;

-- Deals table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_stage_value ON deals(stage, value DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_owner_created ON deals(owner_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_close_date ON deals(expected_close_date) WHERE expected_close_date IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_value_probability ON deals(value DESC, probability DESC);

-- Activities table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_contact_date ON activities(contact_id, activity_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_deal_date ON activities(deal_id, activity_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_type_date ON activities(activity_type, activity_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_date ON activities(user_id, activity_date DESC);

-- ===== AUDIT AND SECURITY INDEXES =====
-- Audit logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_timestamp ON audit_logs(resource_type, resource_id, timestamp DESC);

-- Security logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_logs_user_timestamp ON security_logs(user_id, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_logs_event_timestamp ON security_logs(event_type, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_logs_ip_timestamp ON security_logs(ip_address, timestamp DESC);

-- ===== ANALYTICS AND REPORTING INDEXES =====
-- Dashboard widgets
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_widgets_dashboard_order ON dashboard_widgets(dashboard_id, widget_order);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_widgets_type ON dashboard_widgets(widget_type);

-- Report executions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_executions_report_started ON report_executions(report_id, started_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_executions_user_started ON report_executions(user_id, started_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_executions_status_started ON report_executions(status, started_at DESC);

-- ===== RATE LIMITING INDEXES =====
-- Rate limit tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_key_window ON rate_limit_buckets(rate_limit_key, window_start DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_user_window ON rate_limit_buckets(user_id, window_start DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_ip_window ON rate_limit_buckets(ip_address, window_start DESC);

-- Rate limit violations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limit_violations_key_timestamp ON rate_limit_violations(rate_limit_key, timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limit_violations_ip_timestamp ON rate_limit_violations(ip_address, timestamp DESC);

-- ===== GDPR COMPLIANCE INDEXES =====
-- GDPR requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gdpr_requests_user_created ON gdpr_requests(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gdpr_requests_status_created ON gdpr_requests(status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gdpr_requests_type_created ON gdpr_requests(request_type, created_at DESC);

-- Data mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_mapping_user_table ON data_mapping(user_id, table_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_mapping_table_column ON data_mapping(table_name, column_name);

-- ===== COMPOSITE INDEXES FOR COMPLEX QUERIES =====
-- Prospect analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_analytics ON prospects(agent_id, status, classification, created_at DESC);

-- Email campaign performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_performance ON email_campaigns(prospect_id, status, sent_at DESC, opened_at, clicked_at);

-- Deal pipeline
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_pipeline ON deals(stage, owner_id, expected_close_date, value DESC);

-- Activity timeline
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_timeline ON activities(contact_id, deal_id, activity_date DESC, activity_type);

-- ===== PARTIAL INDEXES FOR EFFICIENCY =====
-- Only index active/relevant records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_active ON prospects(agent_id, created_at DESC) WHERE status NOT IN ('converted', 'archived');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_open ON deals(stage, value DESC, expected_close_date) WHERE stage NOT IN ('closed_won', 'closed_lost');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_pending ON email_campaigns(prospect_id, scheduled_at) WHERE status = 'pending';

-- ===== FUNCTIONAL INDEXES =====
-- Date-based partitioning helpers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_created_month ON prospects(DATE_TRUNC('month', created_at));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_sent_month ON email_campaigns(DATE_TRUNC('month', sent_at)) WHERE sent_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_month ON activities(DATE_TRUNC('month', activity_date));

-- Performance monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_hour ON audit_logs(DATE_TRUNC('hour', timestamp));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_logs_hour ON security_logs(DATE_TRUNC('hour', timestamp));