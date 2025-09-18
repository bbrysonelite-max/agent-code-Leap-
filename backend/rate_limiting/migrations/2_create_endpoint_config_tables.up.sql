-- Enhanced endpoint-specific rate limiting configuration tables

-- Main endpoint configuration table
CREATE TABLE endpoint_rate_limits (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('critical', 'standard', 'background', 'public')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 100,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(endpoint, method)
);

-- Tier-specific limits for each endpoint
CREATE TABLE endpoint_tier_limits (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES endpoint_rate_limits(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL,
    window_seconds INTEGER NOT NULL,
    max_requests INTEGER NOT NULL,
    burst_limit INTEGER NOT NULL DEFAULT 0,
    concurrent_limit INTEGER, -- Maximum concurrent requests
    cooldown_seconds INTEGER, -- Cooldown period after hitting limit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(config_id, tier)
);

-- Time-based rate limiting rules
CREATE TABLE endpoint_time_limits (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES endpoint_rate_limits(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    days_of_week INTEGER[] NOT NULL, -- Array of day numbers (0=Sunday)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conditional rate limiting rules
CREATE TABLE endpoint_conditional_limits (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES endpoint_rate_limits(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    conditions JSONB NOT NULL, -- Store conditions as JSON
    action VARCHAR(20) NOT NULL CHECK (action IN ('restrict', 'allow', 'monitor')),
    limit_multiplier DECIMAL(4,2),
    custom_message TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circuit breaker configuration
CREATE TABLE endpoint_circuit_breakers (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES endpoint_rate_limits(id) ON DELETE CASCADE,
    failure_threshold INTEGER NOT NULL DEFAULT 5,
    recovery_time_seconds INTEGER NOT NULL DEFAULT 30,
    success_threshold INTEGER NOT NULL DEFAULT 3,
    monitor_window_seconds INTEGER NOT NULL DEFAULT 60,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(config_id)
);

-- Circuit breaker state tracking
CREATE TABLE circuit_breaker_states (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    state VARCHAR(20) NOT NULL CHECK (state IN ('closed', 'open', 'half-open')),
    failure_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    last_failure_time TIMESTAMP WITH TIME ZONE,
    state_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recovery_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(endpoint, method)
);

-- Adaptive rate limiting configuration
CREATE TABLE endpoint_adaptive_limits (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES endpoint_rate_limits(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    baseline_window_minutes INTEGER NOT NULL DEFAULT 15,
    adjustment_factor DECIMAL(4,3) NOT NULL DEFAULT 0.100,
    max_adjustment_percent INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(config_id)
);

-- Adaptive metrics configuration
CREATE TABLE adaptive_metrics (
    id SERIAL PRIMARY KEY,
    adaptive_config_id INTEGER NOT NULL REFERENCES endpoint_adaptive_limits(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    threshold DECIMAL(10,3) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('increase', 'decrease')),
    weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Endpoint performance baseline tracking
CREATE TABLE endpoint_baselines (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    baseline_value DECIMAL(10,3) NOT NULL,
    confidence_level DECIMAL(3,2) NOT NULL DEFAULT 0.95,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    samples_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(endpoint, method, metric_name)
);

-- Quota adjustment requests tracking
CREATE TABLE quota_adjustment_requests (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    adjustment_type VARCHAR(50) NOT NULL,
    daily_quota_change INTEGER,
    monthly_quota_change INTEGER,
    valid_until TIMESTAMP WITH TIME ZONE,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
    auto_approved BOOLEAN NOT NULL DEFAULT false,
    requested_by VARCHAR(255),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quota alerts tracking
CREATE TABLE quota_alerts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    threshold_value DECIMAL(5,2) NOT NULL,
    current_usage DECIMAL(10,2) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting violation history (enhanced)
CREATE TABLE rate_limit_violations (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    violation_type VARCHAR(50) NOT NULL,
    original_limit INTEGER,
    attempted_requests INTEGER,
    blocked_requests INTEGER,
    penalty_applied BOOLEAN NOT NULL DEFAULT false,
    penalty_duration_seconds INTEGER,
    user_agent TEXT,
    ip_address INET,
    geographic_location VARCHAR(10), -- Country code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Endpoint discovery and analysis results
CREATE TABLE endpoint_discovery_results (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    estimated_category VARCHAR(20),
    confidence_score DECIMAL(3,2),
    usage_count INTEGER,
    avg_requests_per_window DECIMAL(10,3),
    peak_requests INTEGER,
    unique_users INTEGER,
    analysis_reasoning TEXT[],
    suggested_limits JSONB,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(endpoint, method, discovered_at::date)
);

-- Bulk configuration change audit log
CREATE TABLE config_change_audit (
    id SERIAL PRIMARY KEY,
    change_type VARCHAR(50) NOT NULL,
    filter_criteria JSONB,
    changes_applied JSONB,
    affected_configs INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    performed_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comprehensive indexes for performance
CREATE INDEX idx_endpoint_rate_limits_service ON endpoint_rate_limits(service_name);
CREATE INDEX idx_endpoint_rate_limits_category ON endpoint_rate_limits(category);
CREATE INDEX idx_endpoint_rate_limits_enabled ON endpoint_rate_limits(enabled);
CREATE INDEX idx_endpoint_rate_limits_priority ON endpoint_rate_limits(priority);

CREATE INDEX idx_endpoint_tier_limits_config_tier ON endpoint_tier_limits(config_id, tier);
CREATE INDEX idx_endpoint_time_limits_config ON endpoint_time_limits(config_id);
CREATE INDEX idx_endpoint_conditional_limits_config ON endpoint_conditional_limits(config_id);

CREATE INDEX idx_circuit_breaker_states_endpoint_method ON circuit_breaker_states(endpoint, method);
CREATE INDEX idx_circuit_breaker_states_state ON circuit_breaker_states(state);
CREATE INDEX idx_circuit_breaker_states_recovery_time ON circuit_breaker_states(recovery_time);

CREATE INDEX idx_quota_adjustment_requests_user_id ON quota_adjustment_requests(user_id);
CREATE INDEX idx_quota_adjustment_requests_status ON quota_adjustment_requests(status);
CREATE INDEX idx_quota_adjustment_requests_created_at ON quota_adjustment_requests(created_at);

CREATE INDEX idx_quota_alerts_user_id ON quota_alerts(user_id);
CREATE INDEX idx_quota_alerts_severity ON quota_alerts(severity);
CREATE INDEX idx_quota_alerts_acknowledged ON quota_alerts(acknowledged);
CREATE INDEX idx_quota_alerts_created_at ON quota_alerts(created_at);

CREATE INDEX idx_rate_limit_violations_identifier ON rate_limit_violations(identifier);
CREATE INDEX idx_rate_limit_violations_endpoint_method ON rate_limit_violations(endpoint, method);
CREATE INDEX idx_rate_limit_violations_created_at ON rate_limit_violations(created_at);
CREATE INDEX idx_rate_limit_violations_violation_type ON rate_limit_violations(violation_type);

CREATE INDEX idx_endpoint_baselines_endpoint_method ON endpoint_baselines(endpoint, method);
CREATE INDEX idx_endpoint_baselines_metric_name ON endpoint_baselines(metric_name);
CREATE INDEX idx_endpoint_baselines_valid_until ON endpoint_baselines(valid_until);

CREATE INDEX idx_endpoint_discovery_service ON endpoint_discovery_results(service_name);
CREATE INDEX idx_endpoint_discovery_category ON endpoint_discovery_results(estimated_category);
CREATE INDEX idx_endpoint_discovery_discovered_at ON endpoint_discovery_results(discovered_at);

-- Create GIN indexes for JSONB columns
CREATE INDEX idx_conditional_limits_conditions ON endpoint_conditional_limits USING GIN(conditions);
CREATE INDEX idx_discovery_suggested_limits ON endpoint_discovery_results USING GIN(suggested_limits);
CREATE INDEX idx_config_audit_filter ON config_change_audit USING GIN(filter_criteria);
CREATE INDEX idx_config_audit_changes ON config_change_audit USING GIN(changes_applied);

-- Insert comprehensive default endpoint configurations
INSERT INTO endpoint_rate_limits (endpoint, method, service_name, category, priority, description) VALUES
-- Authentication endpoints (Critical)
('/auth/login', 'POST', 'auth', 'critical', 1, 'User login endpoint'),
('/auth/register', 'POST', 'auth', 'critical', 1, 'User registration endpoint'),
('/auth/reset-password', 'POST', 'auth', 'critical', 2, 'Password reset endpoint'),
('/auth/verify-email', 'POST', 'auth', 'critical', 2, 'Email verification endpoint'),

-- Email endpoints (Critical for business)
('/email/send', 'POST', 'email', 'critical', 5, 'Individual email sending'),
('/email/campaigns', 'POST', 'email', 'critical', 3, 'Email campaign creation'),
('/email/templates', 'POST', 'email', 'standard', 10, 'Template management'),

-- AI and ML endpoints (High value)
('/ai/analyze', 'POST', 'ai_crm', 'critical', 4, 'AI analysis endpoints'),
('/ai/recommendations', 'GET', 'ai_crm', 'standard', 6, 'AI recommendations'),
('/ai/scoring', 'POST', 'scoring', 'critical', 4, 'Prospect scoring'),

-- Data management (Standard)
('/prospect/create', 'POST', 'prospect', 'standard', 8, 'Prospect creation'),
('/prospect/update', 'PUT', 'prospect', 'standard', 8, 'Prospect updates'),
('/prospect/search', 'POST', 'prospect', 'standard', 7, 'Prospect search'),
('/prospect/list', 'GET', 'prospect', 'standard', 9, 'Prospect listing'),

-- CRM operations
('/leads/create', 'POST', 'ai_crm', 'standard', 8, 'Lead creation'),
('/leads/update', 'PUT', 'ai_crm', 'standard', 8, 'Lead updates'),
('/deals/create', 'POST', 'ai_crm', 'standard', 8, 'Deal creation'),
('/contacts/create', 'POST', 'ai_crm', 'standard', 8, 'Contact creation'),

-- Analytics and reporting (Background)
('/analytics/metrics', 'GET', 'analytics', 'background', 15, 'Metrics retrieval'),
('/analytics/reports', 'POST', 'reporting', 'background', 12, 'Report generation'),
('/analytics/dashboard', 'GET', 'reporting', 'standard', 10, 'Dashboard data'),

-- Integration endpoints
('/hubspot/sync', 'POST', 'hubspot', 'background', 20, 'HubSpot synchronization'),
('/hubspot/webhook', 'POST', 'hubspot', 'standard', 8, 'HubSpot webhooks'),

-- System endpoints (Public/Background)
('/health', 'GET', 'system', 'public', 50, 'Health check endpoint'),
('/metrics', 'GET', 'system', 'public', 45, 'System metrics'),
('/status', 'GET', 'system', 'public', 50, 'System status');

-- Insert tier-specific limits for each endpoint
INSERT INTO endpoint_tier_limits (config_id, tier, window_seconds, max_requests, burst_limit, concurrent_limit) 
SELECT 
    id,
    tier,
    CASE 
        WHEN category = 'critical' THEN 
            CASE tier
                WHEN 'enterprise' THEN 300
                WHEN 'premium' THEN 200
                WHEN 'basic' THEN 100
                ELSE 50
            END
        WHEN category = 'standard' THEN
            CASE tier
                WHEN 'enterprise' THEN 1000
                WHEN 'premium' THEN 500
                WHEN 'basic' THEN 200
                ELSE 100
            END
        WHEN category = 'background' THEN
            CASE tier
                WHEN 'enterprise' THEN 2000
                WHEN 'premium' THEN 1000
                WHEN 'basic' THEN 300
                ELSE 150
            END
        ELSE -- public
            CASE tier
                WHEN 'enterprise' THEN 5000
                WHEN 'premium' THEN 3000
                WHEN 'basic' THEN 1000
                ELSE 500
            END
    END as max_requests,
    CASE 
        WHEN category = 'critical' THEN 
            CASE tier
                WHEN 'enterprise' THEN 450
                WHEN 'premium' THEN 300
                WHEN 'basic' THEN 150
                ELSE 75
            END
        WHEN category = 'standard' THEN
            CASE tier
                WHEN 'enterprise' THEN 1500
                WHEN 'premium' THEN 750
                WHEN 'basic' THEN 300
                ELSE 150
            END
        WHEN category = 'background' THEN
            CASE tier
                WHEN 'enterprise' THEN 3000
                WHEN 'premium' THEN 1500
                WHEN 'basic' THEN 450
                ELSE 225
            END
        ELSE -- public
            CASE tier
                WHEN 'enterprise' THEN 7500
                WHEN 'premium' THEN 4500
                WHEN 'basic' THEN 1500
                ELSE 750
            END
    END as burst_limit,
    CASE 
        WHEN category = 'critical' THEN 
            CASE tier
                WHEN 'enterprise' THEN 50
                WHEN 'premium' THEN 30
                WHEN 'basic' THEN 15
                ELSE 10
            END
        WHEN category = 'standard' THEN
            CASE tier
                WHEN 'enterprise' THEN 100
                WHEN 'premium' THEN 60
                WHEN 'basic' THEN 25
                ELSE 15
            END
        ELSE NULL
    END as concurrent_limit
FROM endpoint_rate_limits
CROSS JOIN (VALUES ('enterprise'), ('premium'), ('basic'), ('free')) AS t(tier);

-- Insert sample time-based limits (business hours)
INSERT INTO endpoint_time_limits (config_id, name, days_of_week, start_time, end_time, timezone, multiplier)
SELECT 
    id,
    'Business Hours Boost',
    ARRAY[1,2,3,4,5], -- Monday to Friday
    '09:00'::time,
    '17:00'::time,
    'UTC',
    1.5
FROM endpoint_rate_limits 
WHERE category IN ('critical', 'standard');

-- Insert off-hours restrictions
INSERT INTO endpoint_time_limits (config_id, name, days_of_week, start_time, end_time, timezone, multiplier)
SELECT 
    id,
    'Off Hours Restriction',
    ARRAY[0,6], -- Weekend
    '00:00'::time,
    '23:59'::time,
    'UTC',
    0.7
FROM endpoint_rate_limits 
WHERE category = 'background';

-- Insert circuit breaker configs for critical endpoints
INSERT INTO endpoint_circuit_breakers (config_id, failure_threshold, recovery_time_seconds, success_threshold, monitor_window_seconds)
SELECT 
    id,
    CASE category
        WHEN 'critical' THEN 3
        WHEN 'standard' THEN 5
        ELSE 10
    END,
    CASE category
        WHEN 'critical' THEN 30
        WHEN 'standard' THEN 60
        ELSE 120
    END,
    CASE category
        WHEN 'critical' THEN 2
        WHEN 'standard' THEN 3
        ELSE 5
    END,
    60
FROM endpoint_rate_limits
WHERE category IN ('critical', 'standard');

-- Insert sample conditional limits for bot detection
INSERT INTO endpoint_conditional_limits (config_id, name, conditions, action, limit_multiplier, custom_message)
SELECT 
    id,
    'Bot Detection',
    '{"userAgent": [".*bot.*", ".*crawl.*", ".*spider.*"]}',
    'restrict',
    0.1,
    'Automated traffic detected. Reduced rate limits applied.'
FROM endpoint_rate_limits
WHERE category != 'public';

-- Insert adaptive limits for high-traffic endpoints
INSERT INTO endpoint_adaptive_limits (config_id, enabled, baseline_window_minutes, adjustment_factor, max_adjustment_percent)
SELECT 
    id,
    true,
    15,
    0.100,
    30
FROM endpoint_rate_limits
WHERE category IN ('critical', 'standard');

-- Insert adaptive metrics
INSERT INTO adaptive_metrics (adaptive_config_id, metric_name, threshold, action, weight)
SELECT 
    eal.id,
    metric.name,
    metric.threshold,
    metric.action,
    metric.weight
FROM endpoint_adaptive_limits eal
CROSS JOIN (
    VALUES 
        ('errorRate', 5.0, 'decrease', 1.0),
        ('responseTime', 1000.0, 'decrease', 0.8),
        ('requestRate', 80.0, 'increase', 0.6)
) AS metric(name, threshold, action, weight);

-- Create views for easier querying
CREATE VIEW endpoint_config_summary AS
SELECT 
    erl.id,
    erl.endpoint,
    erl.method,
    erl.service_name,
    erl.category,
    erl.enabled,
    erl.priority,
    COUNT(etl.id) as tier_count,
    COUNT(etsl.id) as time_limit_count,
    COUNT(ecl.id) as conditional_limit_count,
    CASE WHEN ecb.id IS NOT NULL THEN true ELSE false END as has_circuit_breaker,
    CASE WHEN eal.id IS NOT NULL THEN true ELSE false END as has_adaptive_limits
FROM endpoint_rate_limits erl
LEFT JOIN endpoint_tier_limits etl ON erl.id = etl.config_id
LEFT JOIN endpoint_time_limits etsl ON erl.id = etsl.config_id
LEFT JOIN endpoint_conditional_limits ecl ON erl.id = ecl.config_id
LEFT JOIN endpoint_circuit_breakers ecb ON erl.id = ecb.config_id
LEFT JOIN endpoint_adaptive_limits eal ON erl.id = eal.config_id
GROUP BY erl.id, erl.endpoint, erl.method, erl.service_name, erl.category, erl.enabled, erl.priority, ecb.id, eal.id;

CREATE VIEW rate_limit_health_overview AS
SELECT 
    erl.service_name,
    erl.category,
    COUNT(*) as total_endpoints,
    COUNT(CASE WHEN erl.enabled THEN 1 END) as enabled_endpoints,
    COUNT(CASE WHEN ecb.enabled THEN 1 END) as circuit_breaker_enabled,
    COUNT(CASE WHEN eal.enabled THEN 1 END) as adaptive_limits_enabled,
    AVG(erl.priority) as avg_priority
FROM endpoint_rate_limits erl
LEFT JOIN endpoint_circuit_breakers ecb ON erl.id = ecb.config_id
LEFT JOIN endpoint_adaptive_limits eal ON erl.id = eal.config_id
GROUP BY erl.service_name, erl.category
ORDER BY erl.service_name, erl.category;