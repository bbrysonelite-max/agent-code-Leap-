-- Create prospect behaviors table
CREATE TABLE prospect_behaviors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  behavior_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL,
  engagement_score DECIMAL(5,2) DEFAULT 0,
  ai_sentiment TEXT,
  source_campaign_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create engagement patterns table
CREATE TABLE engagement_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL UNIQUE,
  pattern_type VARCHAR(100) NOT NULL,
  description TEXT,
  frequency_score DECIMAL(5,2) DEFAULT 0,
  engagement_level VARCHAR(20) NOT NULL,
  preferred_channels JSONB DEFAULT '[]',
  optimal_timing VARCHAR(100),
  ai_insights JSONB DEFAULT '[]',
  confidence_score DECIMAL(5,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create prospect classification data table
CREATE TABLE prospect_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  classification VARCHAR(20) NOT NULL,
  funnel_stage VARCHAR(20) NOT NULL,
  engagement_level VARCHAR(20) NOT NULL,
  ai_reasoning TEXT,
  behavioral_indicators JSONB DEFAULT '[]',
  demographic_factors JSONB DEFAULT '[]',
  interaction_history_summary TEXT,
  confidence_score DECIMAL(5,2) DEFAULT 0,
  next_best_actions JSONB DEFAULT '[]',
  estimated_close_probability DECIMAL(5,2) DEFAULT 0,
  predicted_revenue DECIMAL(10,2) DEFAULT 0,
  classification_expires_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nurturing sequences table
CREATE TABLE nurturing_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_classification VARCHAR(20) NOT NULL,
  target_funnel_stage VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  ai_optimization_enabled BOOLEAN DEFAULT false,
  performance_metrics JSONB DEFAULT '{}',
  total_steps INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  avg_engagement_rate DECIMAL(5,2) DEFAULT 0,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sequence steps table
CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  conditions JSONB DEFAULT '{}',
  content_template TEXT,
  personalization_variables JSONB DEFAULT '[]',
  ai_dynamic_content BOOLEAN DEFAULT false,
  success_criteria JSONB DEFAULT '{}',
  fallback_action VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_id, step_number)
);

-- Create prospect sequence enrollments table
CREATE TABLE prospect_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  sequence_id UUID NOT NULL REFERENCES nurturing_sequences(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active',
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  total_engagement_score DECIMAL(5,2) DEFAULT 0,
  performance_data JSONB DEFAULT '{}',
  ai_optimization_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prospect_id, sequence_id)
);

-- Create sequence step executions table
CREATE TABLE sequence_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES prospect_sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  prospect_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  content_generated TEXT,
  personalization_data JSONB DEFAULT '{}',
  ai_optimization_applied JSONB DEFAULT '{}',
  engagement_metrics JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create content variations table
CREATE TABLE content_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_step_id UUID NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  variant_type VARCHAR(20) NOT NULL,
  template_content TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT false,
  performance_score DECIMAL(5,2) DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create AI content generation logs table
CREATE TABLE ai_content_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  sequence_step_id UUID REFERENCES sequence_steps(id),
  prompt_used TEXT NOT NULL,
  generated_content TEXT NOT NULL,
  personalization_factors JSONB DEFAULT '{}',
  quality_score DECIMAL(5,2) DEFAULT 0,
  relevance_score DECIMAL(5,2) DEFAULT 0,
  sentiment_tone VARCHAR(50),
  reading_level VARCHAR(50),
  content_length INTEGER,
  ai_model_version VARCHAR(100),
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);