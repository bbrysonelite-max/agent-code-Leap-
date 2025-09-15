CREATE TABLE prospect_scores (
  id SERIAL PRIMARY KEY,
  prospect_id VARCHAR(255) NOT NULL UNIQUE,
  total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  company_score INTEGER NOT NULL CHECK (company_score >= 0 AND company_score <= 100),
  position_score INTEGER NOT NULL CHECK (position_score >= 0 AND position_score <= 100),
  linkedin_score INTEGER NOT NULL CHECK (linkedin_score >= 0 AND linkedin_score <= 100),
  email_engagement_score INTEGER NOT NULL CHECK (email_engagement_score >= 0 AND email_engagement_score <= 100),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  reasons JSONB,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prospect_scores_prospect_id ON prospect_scores(prospect_id);
CREATE INDEX idx_prospect_scores_total_score ON prospect_scores(total_score DESC);
CREATE INDEX idx_prospect_scores_priority ON prospect_scores(priority);
CREATE INDEX idx_prospect_scores_last_updated ON prospect_scores(last_updated DESC);