-- Add database indexes for agent and email templates tables
CREATE INDEX IF NOT EXISTS idx_email_templates_type_active ON email_templates(template_type, is_active);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_activity ON agents(last_activity_at);