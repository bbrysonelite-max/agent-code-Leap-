-- Timing Feedback table for improving predictions
CREATE TABLE IF NOT EXISTS timing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timing_id UUID NOT NULL REFERENCES outreach_timing(id),
  actual_engagement BOOLEAN NOT NULL,
  response_time INTEGER, -- in hours
  channel_used VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for timing feedback
CREATE INDEX IF NOT EXISTS idx_timing_feedback_timing ON timing_feedback(timing_id);
CREATE INDEX IF NOT EXISTS idx_timing_feedback_created ON timing_feedback(created_at);