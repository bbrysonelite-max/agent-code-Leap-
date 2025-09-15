CREATE TABLE scoring_factors (
  id SERIAL PRIMARY KEY,
  prospect_id VARCHAR(255) NOT NULL UNIQUE,
  company_size INTEGER,
  company_revenue BIGINT,
  company_industry VARCHAR(255),
  position VARCHAR(255),
  seniority VARCHAR(100),
  linkedin_connections INTEGER,
  linkedin_activity INTEGER,
  email_open_rate DECIMAL(5,4),
  email_click_rate DECIMAL(5,4),
  email_replies INTEGER DEFAULT 0,
  last_email_engagement TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scoring_factors_prospect_id ON scoring_factors(prospect_id);
CREATE INDEX idx_scoring_factors_company_size ON scoring_factors(company_size);
CREATE INDEX idx_scoring_factors_seniority ON scoring_factors(seniority);
CREATE INDEX idx_scoring_factors_last_email_engagement ON scoring_factors(last_email_engagement DESC);