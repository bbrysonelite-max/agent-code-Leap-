CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  insight TEXT NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  actionable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

CREATE TABLE nurturing_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_enrolled INTEGER NOT NULL DEFAULT 0,
  active_enrollments INTEGER NOT NULL DEFAULT 0,
  completed_enrollments INTEGER NOT NULL DEFAULT 0,
  conversion_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  avg_time_to_conversion INTERVAL,
  total_sent INTEGER NOT NULL DEFAULT 0,
  open_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  click_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  response_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  unsubscribe_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_prospect_id ON ai_insights(prospect_id);
CREATE INDEX idx_ai_insights_type ON ai_insights(type);
CREATE INDEX idx_ai_insights_confidence ON ai_insights(confidence DESC);
CREATE INDEX idx_ai_insights_actionable ON ai_insights(actionable);
CREATE INDEX idx_ai_insights_created_at ON ai_insights(created_at DESC);
CREATE INDEX idx_nurturing_analytics_sequence_id ON nurturing_analytics(sequence_id);
CREATE INDEX idx_nurturing_analytics_date ON nurturing_analytics(date DESC);
CREATE UNIQUE INDEX idx_nurturing_analytics_unique ON nurturing_analytics(sequence_id, date);