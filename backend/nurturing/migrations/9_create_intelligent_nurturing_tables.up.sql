-- Create table for intelligent sequences
CREATE TABLE IF NOT EXISTS intelligent_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ai_optimized BOOLEAN DEFAULT true,
    adaptive_scheduling BOOLEAN DEFAULT true,
    target_personas JSONB DEFAULT '[]',
    entry_triggers JSONB DEFAULT '[]',
    exit_conditions JSONB DEFAULT '[]',
    last_optimization TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    performance_metrics JSONB DEFAULT '{}',
    ai_insights JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for intelligent steps
CREATE TABLE IF NOT EXISTS intelligent_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id UUID NOT NULL REFERENCES intelligent_sequences(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL, -- email, sms, call, task, wait, ai_decision
    conditions JSONB DEFAULT '[]',
    adaptive_content BOOLEAN DEFAULT true,
    dynamic_timing BOOLEAN DEFAULT true,
    fallback_actions JSONB DEFAULT '[]',
    ai_personalization JSONB DEFAULT '{}',
    branching_logic JSONB DEFAULT '[]',
    content_template TEXT,
    timing_rules JSONB DEFAULT '{}',
    performance_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sequence_id, step_number)
);

-- Create table for intelligent enrollments
CREATE TABLE IF NOT EXISTS intelligent_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL,
    sequence_id UUID NOT NULL REFERENCES intelligent_sequences(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active', -- active, paused, completed, failed, ai_optimizing
    ai_personalization_data JSONB DEFAULT '{}',
    adaptive_schedule JSONB DEFAULT '{}',
    behavior_triggers JSONB DEFAULT '[]',
    performance_metrics JSONB DEFAULT '{}',
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_step_at TIMESTAMP WITH TIME ZONE,
    next_step_at TIMESTAMP WITH TIME ZONE,
    completed_steps INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for intelligent sequence schedules
CREATE TABLE IF NOT EXISTS intelligent_sequence_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES intelligent_enrollments(id) ON DELETE CASCADE,
    next_step_at TIMESTAMP WITH TIME ZONE NOT NULL,
    optimized BOOLEAN DEFAULT false,
    optimization_reason TEXT,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(enrollment_id)
);

-- Create table for personalized follow-ups
CREATE TABLE IF NOT EXISTS personalized_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL,
    trigger_event VARCHAR(255) NOT NULL,
    followup_type VARCHAR(50) NOT NULL, -- immediate, delayed, strategic, recovery
    priority VARCHAR(50) NOT NULL, -- low, medium, high, urgent
    ai_generated BOOLEAN DEFAULT true,
    personalization_level INTEGER DEFAULT 0,
    content JSONB NOT NULL,
    timing JSONB NOT NULL,
    context JSONB DEFAULT '{}',
    performance JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, sent, delivered, opened, clicked, replied
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for followup schedule
CREATE TABLE IF NOT EXISTS followup_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    followup_id UUID NOT NULL REFERENCES personalized_followups(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, sent, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for followup performance events
CREATE TABLE IF NOT EXISTS followup_performance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    followup_id UUID NOT NULL REFERENCES personalized_followups(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- sent, delivered, opened, clicked, replied, unsubscribed
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for followup triggers
CREATE TABLE IF NOT EXISTS followup_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    conditions JSONB DEFAULT '[]',
    ai_analysis BOOLEAN DEFAULT false,
    followup_template JSONB NOT NULL,
    priority INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for nurturing executions (step execution logs)
CREATE TABLE IF NOT EXISTS nurturing_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES intelligent_enrollments(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES intelligent_steps(id) ON DELETE CASCADE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL, -- success, failed, skipped
    result_data JSONB DEFAULT '{}',
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for engagement events tracking
CREATE TABLE IF NOT EXISTS engagement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL,
    prospect_name VARCHAR(255),
    event_type VARCHAR(100) NOT NULL, -- email_open, email_click, website_visit, form_submit, download, meeting_scheduled, reply
    channel VARCHAR(50),
    content TEXT,
    score INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for engagement alerts
CREATE TABLE IF NOT EXISTS engagement_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL,
    prospect_name VARCHAR(255),
    alert_type VARCHAR(100) NOT NULL, -- high_intent, churn_risk, milestone_reached, sequence_completion, negative_response
    message TEXT NOT NULL,
    severity VARCHAR(50) DEFAULT 'info', -- info, warning, critical
    action_taken BOOLEAN DEFAULT false,
    action_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_intelligent_sequences_active ON intelligent_sequences(is_active, created_at);
CREATE INDEX IF NOT EXISTS idx_intelligent_steps_sequence ON intelligent_steps(sequence_id, step_number);
CREATE INDEX IF NOT EXISTS idx_intelligent_enrollments_prospect ON intelligent_enrollments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_enrollments_sequence ON intelligent_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_enrollments_status ON intelligent_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_intelligent_enrollments_next_step ON intelligent_enrollments(next_step_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sequence_schedules_next_step ON intelligent_sequence_schedules(next_step_at);
CREATE INDEX IF NOT EXISTS idx_personalized_followups_prospect ON personalized_followups(prospect_id);
CREATE INDEX IF NOT EXISTS idx_personalized_followups_trigger ON personalized_followups(trigger_event);
CREATE INDEX IF NOT EXISTS idx_personalized_followups_scheduled ON personalized_followups(scheduled_for) WHERE status IN ('pending', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_followup_performance_events_followup ON followup_performance_events(followup_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_followup_triggers_active ON followup_triggers(active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_nurturing_executions_enrollment ON nurturing_executions(enrollment_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_events_prospect ON engagement_events(prospect_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_events_type ON engagement_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_alerts_prospect ON engagement_alerts(prospect_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_alerts_type ON engagement_alerts(alert_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_alerts_unhandled ON engagement_alerts(action_taken, severity, timestamp DESC) WHERE action_taken = false;