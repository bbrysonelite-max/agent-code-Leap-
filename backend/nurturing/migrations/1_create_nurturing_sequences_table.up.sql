CREATE TABLE nurturing_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_conditions JSONB NOT NULL,
  target_audience JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('email', 'sms', 'task', 'wait')),
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  content_template JSONB NOT NULL,
  conditions JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE prospect_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL,
  sequence_id UUID NOT NULL REFERENCES nurturing_sequences(id),
  current_step INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  next_action_at TIMESTAMP WITH TIME ZONE,
  engagement_score DECIMAL(5,2) DEFAULT 0,
  conversion_probability DECIMAL(5,2) DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE sequence_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_sequence_id UUID NOT NULL REFERENCES prospect_sequences(id),
  step_id UUID NOT NULL REFERENCES sequence_steps(id),
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'failed')),
  content_used JSONB,
  engagement_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT
);

CREATE TABLE behavior_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  session_id VARCHAR(255),
  source VARCHAR(100),
  engagement_score DECIMAL(5,2) DEFAULT 0
);

CREATE TABLE prospect_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL,
  classification_type VARCHAR(100) NOT NULL,
  classification_value VARCHAR(255) NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL,
  funnel_stage VARCHAR(50) NOT NULL CHECK (funnel_stage IN ('awareness', 'interest', 'consideration', 'intent', 'evaluation', 'purchase')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_nurturing_sequences_client_id ON nurturing_sequences(client_id);
CREATE INDEX idx_sequence_steps_sequence_id ON sequence_steps(sequence_id, step_order);
CREATE INDEX idx_prospect_sequences_prospect_id ON prospect_sequences(prospect_id);
CREATE INDEX idx_prospect_sequences_next_action ON prospect_sequences(next_action_at) WHERE status = 'active';
CREATE INDEX idx_sequence_executions_prospect_sequence ON sequence_executions(prospect_sequence_id);
CREATE INDEX idx_behavior_analytics_prospect_timestamp ON behavior_analytics(prospect_id, timestamp DESC);
CREATE INDEX idx_prospect_classifications_prospect ON prospect_classifications(prospect_id, classification_type);