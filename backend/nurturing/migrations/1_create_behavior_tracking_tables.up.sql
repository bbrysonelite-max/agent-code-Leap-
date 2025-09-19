-- Create table for tracking prospect behavior and engagement
CREATE TABLE IF NOT EXISTS prospect_behavior (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  behavior_type VARCHAR(50) NOT NULL, -- email_open, email_click, website_visit, linkedin_view, etc.
  behavior_data JSONB NOT NULL DEFAULT '{}', -- Additional context data
  engagement_score INTEGER DEFAULT 0, -- 1-100 score for this specific behavior
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for tracking cumulative engagement patterns
CREATE TABLE IF NOT EXISTS prospect_engagement_profile (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  total_score INTEGER DEFAULT 0,
  email_engagement_score INTEGER DEFAULT 0,
  content_engagement_score INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2) DEFAULT 0.0,
  avg_response_time_hours INTEGER DEFAULT 0,
  preferred_content_type VARCHAR(50), -- email, linkedin, phone, etc.
  optimal_send_time TIME,
  optimal_send_day INTEGER, -- 1=Monday, 7=Sunday
  engagement_trend VARCHAR(20) DEFAULT 'neutral', -- increasing, decreasing, stable, neutral
  last_engagement_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for AI-generated nurturing sequences
CREATE TABLE IF NOT EXISTS nurturing_sequences (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  classification_target VARCHAR(50) NOT NULL, -- hot, warm, cold, nurture, unqualified
  stage_target VARCHAR(50) NOT NULL, -- awareness, interest, consideration, intent, evaluation, purchase
  sequence_type VARCHAR(50) DEFAULT 'email', -- email, multi_channel, linkedin, phone
  total_steps INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  performance_score DECIMAL(5,2) DEFAULT 0.0,
  conversion_rate DECIMAL(5,2) DEFAULT 0.0,
  created_by_ai BOOLEAN DEFAULT true,
  template_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for individual sequence steps
CREATE TABLE IF NOT EXISTS sequence_steps (
  id SERIAL PRIMARY KEY,
  sequence_id INTEGER NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  content_type VARCHAR(50) NOT NULL, -- email, linkedin_message, phone_call, task
  delay_days INTEGER DEFAULT 1,
  delay_hours INTEGER DEFAULT 0,
  subject_template TEXT,
  content_template TEXT NOT NULL,
  conditions JSONB DEFAULT '{}', -- Conditions for this step to execute
  performance_metrics JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for tracking prospect enrollment in sequences
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL,
  sequence_id INTEGER NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL,
  current_step INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'active', -- active, paused, completed, stopped
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_step_sent_at TIMESTAMP,
  next_step_scheduled_at TIMESTAMP,
  completion_reason VARCHAR(100), -- completed, manual_stop, converted, unsubscribed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for tracking sent nurturing communications
CREATE TABLE IF NOT EXISTS nurturing_communications (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id INTEGER NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  prospect_id INTEGER NOT NULL,
  communication_type VARCHAR(50) NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP,
  engagement_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for A/B testing different sequence variations
CREATE TABLE IF NOT EXISTS sequence_ab_tests (
  id SERIAL PRIMARY KEY,
  sequence_id INTEGER NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  test_name VARCHAR(255) NOT NULL,
  variant_a_data JSONB NOT NULL,
  variant_b_data JSONB NOT NULL,
  traffic_split INTEGER DEFAULT 50, -- Percentage for variant A
  status VARCHAR(20) DEFAULT 'active', -- active, paused, completed
  winner VARCHAR(10), -- a, b, or null if no clear winner
  statistical_significance DECIMAL(5,2) DEFAULT 0.0,
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospect_behavior_prospect_id ON prospect_behavior(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_behavior_client_id ON prospect_behavior(client_id);
CREATE INDEX IF NOT EXISTS idx_prospect_behavior_type ON prospect_behavior(behavior_type);
CREATE INDEX IF NOT EXISTS idx_prospect_behavior_created_at ON prospect_behavior(created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_profile_prospect_id ON prospect_engagement_profile(prospect_id);
CREATE INDEX IF NOT EXISTS idx_engagement_profile_client_id ON prospect_engagement_profile(client_id);
CREATE INDEX IF NOT EXISTS idx_engagement_profile_score ON prospect_engagement_profile(total_score DESC);

CREATE INDEX IF NOT EXISTS idx_nurturing_sequences_client_id ON nurturing_sequences(client_id);
CREATE INDEX IF NOT EXISTS idx_nurturing_sequences_active ON nurturing_sequences(is_active);
CREATE INDEX IF NOT EXISTS idx_nurturing_sequences_classification ON nurturing_sequences(classification_target);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_prospect_id ON sequence_enrollments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_step ON sequence_enrollments(next_step_scheduled_at);

CREATE INDEX IF NOT EXISTS idx_nurturing_communications_enrollment_id ON nurturing_communications(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_nurturing_communications_prospect_id ON nurturing_communications(prospect_id);
CREATE INDEX IF NOT EXISTS idx_nurturing_communications_sent_at ON nurturing_communications(sent_at);