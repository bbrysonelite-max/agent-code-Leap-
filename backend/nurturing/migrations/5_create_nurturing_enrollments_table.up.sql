CREATE TABLE nurturing_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  sequence_id UUID NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_step_at TIMESTAMPTZ,
  next_step_at TIMESTAMPTZ,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nurturing_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES nurturing_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES nurturing_steps(id),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL,
  result_data JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  delivery_id VARCHAR(255),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_nurturing_enrollments_prospect_id ON nurturing_enrollments(prospect_id);
CREATE INDEX idx_nurturing_enrollments_sequence_id ON nurturing_enrollments(sequence_id);
CREATE INDEX idx_nurturing_enrollments_status ON nurturing_enrollments(status);
CREATE INDEX idx_nurturing_enrollments_next_step_at ON nurturing_enrollments(next_step_at);
CREATE UNIQUE INDEX idx_nurturing_enrollments_unique ON nurturing_enrollments(prospect_id, sequence_id);
CREATE INDEX idx_nurturing_executions_enrollment_id ON nurturing_executions(enrollment_id);
CREATE INDEX idx_nurturing_executions_step_id ON nurturing_executions(step_id);
CREATE INDEX idx_nurturing_executions_executed_at ON nurturing_executions(executed_at DESC);
CREATE INDEX idx_nurturing_executions_status ON nurturing_executions(status);