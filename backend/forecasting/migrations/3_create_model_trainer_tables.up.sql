-- Auto Retrain Configuration table
CREATE TABLE IF NOT EXISTS auto_retrain_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type VARCHAR(50) NOT NULL UNIQUE CHECK (model_type IN ('conversion', 'revenue', 'timing', 'performance')),
  schedule VARCHAR(20) NOT NULL CHECK (schedule IN ('daily', 'weekly', 'monthly')),
  accuracy_threshold DECIMAL(5,4) NOT NULL CHECK (accuracy_threshold >= 0 AND accuracy_threshold <= 1),
  data_window INTEGER NOT NULL CHECK (data_window > 0),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training Jobs table
CREATE TABLE IF NOT EXISTS training_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('conversion', 'revenue', 'timing', 'performance')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  trigger_reason VARCHAR(50) NOT NULL CHECK (trigger_reason IN ('scheduled', 'performance_decline', 'data_drift', 'manual')),
  training_data_start TIMESTAMPTZ NOT NULL,
  training_data_end TIMESTAMPTZ NOT NULL,
  features JSONB NOT NULL,
  hyperparameters JSONB,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training Events table (for logging)
CREATE TABLE IF NOT EXISTS training_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_job_id UUID NOT NULL REFERENCES training_jobs(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL,
  event_details JSONB NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('info', 'warning', 'error', 'success')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Evaluation Results table
CREATE TABLE IF NOT EXISTS model_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ml_models(id),
  evaluation_type VARCHAR(50) NOT NULL CHECK (evaluation_type IN ('validation', 'test', 'production')),
  test_data_start TIMESTAMPTZ NOT NULL,
  test_data_end TIMESTAMPTZ NOT NULL,
  sample_size INTEGER NOT NULL,
  accuracy DECIMAL(5,4) NOT NULL,
  precision_score DECIMAL(5,4) NOT NULL,
  recall DECIMAL(5,4) NOT NULL,
  f1_score DECIMAL(5,4) NOT NULL,
  mse DECIMAL(10,6),
  mae DECIMAL(10,6),
  r2_score DECIMAL(5,4),
  insights JSONB,
  predictions_sample JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Deployment History table
CREATE TABLE IF NOT EXISTS model_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ml_models(id),
  previous_model_id UUID REFERENCES ml_models(id),
  deployment_reason VARCHAR(100) NOT NULL,
  deployment_status VARCHAR(20) NOT NULL CHECK (deployment_status IN ('active', 'rolled_back', 'superseded')),
  performance_before JSONB,
  performance_after JSONB,
  deployed_by VARCHAR(100),
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  rolled_back_at TIMESTAMPTZ
);

-- Feature Importance table
CREATE TABLE IF NOT EXISTS feature_importance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ml_models(id),
  feature_name VARCHAR(100) NOT NULL,
  importance_score DECIMAL(8,6) NOT NULL,
  rank_position INTEGER NOT NULL,
  calculation_method VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Drift Detection table
CREATE TABLE IF NOT EXISTS data_drift_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('conversion', 'revenue', 'timing', 'performance')),
  monitoring_period_start TIMESTAMPTZ NOT NULL,
  monitoring_period_end TIMESTAMPTZ NOT NULL,
  drift_score DECIMAL(5,4) NOT NULL CHECK (drift_score >= 0),
  drift_threshold DECIMAL(5,4) NOT NULL CHECK (drift_threshold >= 0),
  drift_detected BOOLEAN NOT NULL,
  affected_features JSONB,
  statistical_tests JSONB,
  recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Health Checks table
CREATE TABLE IF NOT EXISTS model_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ml_models(id),
  check_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  health_status VARCHAR(20) NOT NULL CHECK (health_status IN ('healthy', 'warning', 'critical')),
  accuracy_score DECIMAL(5,4),
  latency_ms INTEGER,
  memory_usage_mb INTEGER,
  prediction_volume INTEGER,
  error_rate DECIMAL(5,4),
  issues_detected JSONB,
  recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_model_type ON training_jobs(model_type);
CREATE INDEX IF NOT EXISTS idx_training_events_job_id ON training_events(training_job_id);
CREATE INDEX IF NOT EXISTS idx_model_evaluations_model_id ON model_evaluations(model_id);
CREATE INDEX IF NOT EXISTS idx_model_deployments_model_id ON model_deployments(model_id);
CREATE INDEX IF NOT EXISTS idx_feature_importance_model_id ON feature_importance(model_id);
CREATE INDEX IF NOT EXISTS idx_data_drift_model_type ON data_drift_monitoring(model_type);
CREATE INDEX IF NOT EXISTS idx_model_health_checks_model_id ON model_health_checks(model_id);
CREATE INDEX IF NOT EXISTS idx_model_health_checks_timestamp ON model_health_checks(check_timestamp);

-- Auto-retrain configuration defaults
INSERT INTO auto_retrain_config (model_type, schedule, accuracy_threshold, data_window, enabled)
VALUES 
  ('conversion', 'weekly', 0.65, 90, true),
  ('revenue', 'monthly', 0.70, 120, true),
  ('timing', 'weekly', 0.60, 60, true),
  ('performance', 'monthly', 0.65, 90, true)
ON CONFLICT (model_type) DO NOTHING;