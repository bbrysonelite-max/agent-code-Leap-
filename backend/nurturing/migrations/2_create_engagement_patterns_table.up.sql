CREATE TABLE engagement_patterns (
  prospect_id VARCHAR(255) PRIMARY KEY,
  total_engagements INTEGER NOT NULL DEFAULT 0,
  avg_time_between_engagements INTERVAL,
  preferred_contact_times JSONB NOT NULL DEFAULT '[]',
  preferred_channels JSONB NOT NULL DEFAULT '[]',
  response_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  last_engagement TIMESTAMPTZ,
  engagement_trend VARCHAR(20) NOT NULL DEFAULT 'stable',
  peak_engagement_days JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_engagement_patterns_last_engagement ON engagement_patterns(last_engagement DESC);
CREATE INDEX idx_engagement_patterns_response_rate ON engagement_patterns(response_rate DESC);
CREATE INDEX idx_engagement_patterns_trend ON engagement_patterns(engagement_trend);