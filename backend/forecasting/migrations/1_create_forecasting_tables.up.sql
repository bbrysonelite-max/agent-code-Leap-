-- ML Models table
CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('conversion', 'revenue', 'timing', 'performance')),
  version VARCHAR(50) NOT NULL,
  accuracy DECIMAL(5,4) NOT NULL,
  features JSONB NOT NULL,
  training_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_trained TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversion Predictions table
CREATE TABLE IF NOT EXISTS conversion_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL,
  prediction_score DECIMAL(5,4) NOT NULL CHECK (prediction_score >= 0 AND prediction_score <= 1),
  confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  factors JSONB NOT NULL,
  predicted_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Forecasts table
CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  agent_id UUID,
  period VARCHAR(20) NOT NULL CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  predicted_revenue DECIMAL(15,2) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  trend_direction VARCHAR(10) NOT NULL CHECK (trend_direction IN ('up', 'down', 'stable')),
  factors JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Timing table
CREATE TABLE IF NOT EXISTS outreach_timing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL,
  recommended_time TIMESTAMPTZ NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'call', 'linkedin', 'social')),
  probability DECIMAL(5,4) NOT NULL CHECK (probability >= 0 AND probability <= 1),
  reasoning JSONB NOT NULL,
  time_zone VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cohort Analysis table
CREATE TABLE IF NOT EXISTS cohort_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_prospects INTEGER NOT NULL,
  converted_prospects INTEGER NOT NULL,
  conversion_rate DECIMAL(5,4) NOT NULL,
  average_time_to_convert INTEGER NOT NULL, -- in days
  total_revenue DECIMAL(15,2) NOT NULL,
  average_revenue_per_prospect DECIMAL(15,2) NOT NULL,
  retention_rate DECIMAL(5,4) NOT NULL,
  dropoff_stages JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Predictions table
CREATE TABLE IF NOT EXISTS performance_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('agent', 'campaign', 'client')),
  entity_id UUID NOT NULL,
  metric VARCHAR(50) NOT NULL CHECK (metric IN ('conversion_rate', 'revenue', 'response_rate', 'engagement')),
  period VARCHAR(20) NOT NULL CHECK (period IN ('week', 'month', 'quarter')),
  current_value DECIMAL(15,4) NOT NULL,
  predicted_value DECIMAL(15,4) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  trend VARCHAR(20) NOT NULL CHECK (trend IN ('improving', 'declining', 'stable')),
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trend Analysis table
CREATE TABLE IF NOT EXISTS trend_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric VARCHAR(100) NOT NULL,
  period VARCHAR(20) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  trend_type VARCHAR(20) NOT NULL CHECK (trend_type IN ('linear', 'exponential', 'seasonal', 'cyclical')),
  slope DECIMAL(10,6) NOT NULL,
  correlation DECIMAL(5,4) NOT NULL,
  seasonal_factors JSONB NOT NULL,
  anomalies JSONB NOT NULL,
  forecast JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Performance Tracking table
CREATE TABLE IF NOT EXISTS model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ml_models(id),
  evaluation_date TIMESTAMPTZ NOT NULL,
  accuracy DECIMAL(5,4) NOT NULL,
  precision_score DECIMAL(5,4) NOT NULL,
  recall DECIMAL(5,4) NOT NULL,
  f1_score DECIMAL(5,4) NOT NULL,
  mse DECIMAL(10,6),
  mae DECIMAL(10,6),
  r2_score DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversion_predictions_prospect ON conversion_predictions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_conversion_predictions_created ON conversion_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_client ON revenue_forecasts(client_id);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_agent ON revenue_forecasts(agent_id);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_period ON revenue_forecasts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_outreach_timing_prospect ON outreach_timing(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_timing_recommended ON outreach_timing(recommended_time);
CREATE INDEX IF NOT EXISTS idx_performance_predictions_entity ON performance_predictions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_trend_analysis_metric ON trend_analysis(metric);
CREATE INDEX IF NOT EXISTS idx_model_performance_model ON model_performance(model_id);
CREATE INDEX IF NOT EXISTS idx_ml_models_type_active ON ml_models(type, is_active);