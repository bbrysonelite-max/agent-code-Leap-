CREATE TABLE score_weights (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  company_size_weight DECIMAL(3,2) NOT NULL DEFAULT 0.20,
  company_revenue_weight DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  position_weight DECIMAL(3,2) NOT NULL DEFAULT 0.25,
  seniority_weight DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  linkedin_activity_weight DECIMAL(3,2) NOT NULL DEFAULT 0.10,
  email_engagement_weight DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO score_weights (name) VALUES ('default');

CREATE INDEX idx_score_weights_is_active ON score_weights(is_active);
CREATE INDEX idx_score_weights_name ON score_weights(name);