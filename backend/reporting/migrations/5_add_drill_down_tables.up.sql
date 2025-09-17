-- Add tables for drill-down analytics and enhanced reporting

-- Report segments for demographic/behavioral analysis
CREATE TABLE report_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved drill-down queries for reuse
CREATE TABLE saved_drill_downs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_metric TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report comparisons for A/B testing and trend analysis
CREATE TABLE report_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  comparison_type TEXT NOT NULL, -- 'time_period', 'segment', 'cohort'
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled report jobs
CREATE TABLE scheduled_report_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  cron_expression TEXT NOT NULL,
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_run_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  notification_emails TEXT[], -- Array of email addresses
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report subscriptions for automated delivery
CREATE TABLE report_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  format TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'excel', 'email_summary'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_report_segments_criteria ON report_segments USING GIN (criteria);
CREATE INDEX idx_saved_drill_downs_user_id ON saved_drill_downs(user_id);
CREATE INDEX idx_saved_drill_downs_base_metric ON saved_drill_downs(base_metric);
CREATE INDEX idx_report_comparisons_report_id ON report_comparisons(report_id);
CREATE INDEX idx_scheduled_report_jobs_next_run ON scheduled_report_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX idx_report_subscriptions_user_id ON report_subscriptions(user_id);
CREATE INDEX idx_report_subscriptions_report_id ON report_subscriptions(report_id);

-- Add enhanced columns to existing tables
ALTER TABLE reports ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT '{}';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS complexity_score INTEGER DEFAULT 1;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS estimated_runtime_ms INTEGER;

ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS refresh_interval_seconds INTEGER DEFAULT 300;
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS is_real_time BOOLEAN DEFAULT false;
ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS drill_down_config JSONB;

-- Add more comprehensive indexing
CREATE INDEX idx_reports_tags ON reports USING GIN (tags);
CREATE INDEX idx_reports_data_sources ON reports USING GIN (data_sources);
CREATE INDEX idx_reports_complexity ON reports(complexity_score);
CREATE INDEX idx_dashboard_widgets_real_time ON dashboard_widgets(is_real_time) WHERE is_real_time = true;