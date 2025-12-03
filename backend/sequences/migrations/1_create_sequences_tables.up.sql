-- Sequences table
CREATE TABLE sequences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  settings JSONB NOT NULL DEFAULT '{}',
  stats JSONB NOT NULL DEFAULT '{"total_enrolled":0,"active":0,"completed":0,"replied":0,"meetings_booked":0,"unsubscribed":0,"emails_sent":0,"emails_opened":0,"sms_sent":0,"sms_replied":0}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Sequence steps
CREATE TABLE sequence_steps (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  subject TEXT, -- For email only
  content TEXT NOT NULL,
  template_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(sequence_id, step_order)
);

-- Sequence enrollments (leads enrolled in sequences)
CREATE TABLE sequence_enrollments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'replied', 'unsubscribed', 'bounced')),
  current_step INTEGER NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(sequence_id, lead_id)
);

-- Scheduled sends (queue for pending sends)
CREATE TABLE scheduled_sends (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  enrollment_id TEXT NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Send history (log of all sends)
CREATE TABLE send_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  enrollment_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  message_id TEXT, -- External ID from Brevo/Twilio
  recipient TEXT NOT NULL, -- Email or phone
  subject TEXT,
  content TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_sequences_status ON sequences(status);
CREATE INDEX idx_sequence_steps_sequence ON sequence_steps(sequence_id);
CREATE INDEX idx_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_enrollments_lead ON sequence_enrollments(lead_id);
CREATE INDEX idx_enrollments_status ON sequence_enrollments(status);
CREATE INDEX idx_scheduled_sends_scheduled ON scheduled_sends(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_scheduled_sends_enrollment ON scheduled_sends(enrollment_id);
CREATE INDEX idx_send_history_lead ON send_history(lead_id);
CREATE INDEX idx_send_history_enrollment ON send_history(enrollment_id);
