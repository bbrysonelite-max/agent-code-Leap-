-- Add missing database indexes for prospects table performance optimization
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_created_at ON prospects(created_at);
CREATE INDEX IF NOT EXISTS idx_prospects_search ON prospects USING gin(to_tsvector('english', name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, '')));

-- Add unique constraints for data integrity
ALTER TABLE prospects ADD CONSTRAINT UNIQUE_prospect_email_per_agent UNIQUE(agent_id, email);