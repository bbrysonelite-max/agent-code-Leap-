-- Add missing database indexes for performance optimization
-- Note: Removing CONCURRENTLY as it cannot run in a transaction block
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects(created_at);
CREATE INDEX IF NOT EXISTS idx_prospects_search ON prospects USING gin(to_tsvector('english', name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, '')));

CREATE INDEX IF NOT EXISTS idx_email_campaigns_prospect_id ON email_campaigns(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_sent_at ON email_campaigns(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_email_templates_type_active ON email_templates(template_type, is_active);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_activity ON agents(last_activity_at);

-- Add unique constraints for data integrity
ALTER TABLE prospects ADD CONSTRAINT UNIQUE_prospect_email_per_agent UNIQUE(agent_id, email);