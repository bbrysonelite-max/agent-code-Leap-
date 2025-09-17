CREATE TABLE nurturing_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_classification JSONB NOT NULL DEFAULT '[]',
  target_stages JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nurturing_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_value TEXT,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  content_template TEXT NOT NULL,
  personalization_rules JSONB NOT NULL DEFAULT '[]',
  conditions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nurturing_sequences_active ON nurturing_sequences(is_active);
CREATE INDEX idx_nurturing_sequences_classification ON nurturing_sequences USING GIN(target_classification);
CREATE INDEX idx_nurturing_sequences_stages ON nurturing_sequences USING GIN(target_stages);
CREATE INDEX idx_nurturing_steps_sequence_id ON nurturing_steps(sequence_id);
CREATE INDEX idx_nurturing_steps_step_number ON nurturing_steps(sequence_id, step_number);
CREATE INDEX idx_nurturing_steps_type ON nurturing_steps(type);
CREATE UNIQUE INDEX idx_nurturing_steps_unique_step ON nurturing_steps(sequence_id, step_number);