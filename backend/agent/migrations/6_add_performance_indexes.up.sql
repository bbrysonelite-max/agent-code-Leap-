-- Add database indexes for agent and email related tables
CREATE INDEX IF NOT EXISTS idx_email_campaigns_prospect_id ON email_campaigns(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_sent_at ON email_campaigns(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_email_templates_type_active ON email_templates(template_type, is_active);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_activity ON agents(last_activity_at);