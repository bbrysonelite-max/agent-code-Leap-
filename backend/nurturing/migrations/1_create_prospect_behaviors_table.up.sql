CREATE TABLE prospect_behaviors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  source VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospect_behaviors_prospect_id ON prospect_behaviors(prospect_id);
CREATE INDEX idx_prospect_behaviors_event_type ON prospect_behaviors(event_type);
CREATE INDEX idx_prospect_behaviors_timestamp ON prospect_behaviors(timestamp DESC);
CREATE INDEX idx_prospect_behaviors_score ON prospect_behaviors(score DESC);
CREATE INDEX idx_prospect_behaviors_source ON prospect_behaviors(source);