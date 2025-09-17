CREATE TABLE prospect_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  classification VARCHAR(50) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL,
  factors JSONB NOT NULL DEFAULT '[]',
  stage VARCHAR(50) NOT NULL,
  buying_signals JSONB NOT NULL DEFAULT '[]',
  pain_points JSONB NOT NULL DEFAULT '[]',
  interests JSONB NOT NULL DEFAULT '[]',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_prospect_classifications_prospect_id ON prospect_classifications(prospect_id);
CREATE INDEX idx_prospect_classifications_classification ON prospect_classifications(classification);
CREATE INDEX idx_prospect_classifications_stage ON prospect_classifications(stage);
CREATE INDEX idx_prospect_classifications_confidence ON prospect_classifications(confidence DESC);
CREATE INDEX idx_prospect_classifications_last_updated ON prospect_classifications(last_updated DESC);