-- Add missing database indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_created_at ON prospects(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_search ON prospects USING gin(to_tsvector('english', name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_prospect_id ON email_campaigns(prospect_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_sent_at ON email_campaigns(sent_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_templates_type_active ON email_templates(template_type, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_last_activity ON agents(last_activity_at);

-- Add unique constraints for data integrity
ALTER TABLE prospects ADD CONSTRAINT UNIQUE_prospect_email_per_agent UNIQUE(agent_id, email);