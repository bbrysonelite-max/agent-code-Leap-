-- Rate limiting configuration table
CREATE TABLE rate_limit_rules (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'default',
    window_seconds INTEGER NOT NULL,
    max_requests INTEGER NOT NULL,
    burst_limit INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(endpoint, method, tier)
);

-- User quota and tier management
CREATE TABLE user_quotas (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'basic',
    daily_quota INTEGER NOT NULL DEFAULT 1000,
    monthly_quota INTEGER NOT NULL DEFAULT 30000,
    current_daily_usage INTEGER NOT NULL DEFAULT 0,
    current_monthly_usage INTEGER NOT NULL DEFAULT 0,
    quota_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    monthly_reset_date DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Rate limiting usage tracking
CREATE TABLE rate_limit_usage (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting analytics and metrics
CREATE TABLE rate_limit_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    tier VARCHAR(50) NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    blocked_requests INTEGER NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    avg_requests_per_user DECIMAL(10,2) NOT NULL DEFAULT 0,
    peak_requests_per_minute INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, endpoint, method, tier)
);

-- Rate limiting alerts configuration
CREATE TABLE rate_limit_alerts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    tier VARCHAR(50),
    threshold_type VARCHAR(50) NOT NULL, -- 'usage_percentage', 'blocked_requests', 'quota_percentage'
    threshold_value DECIMAL(5,2) NOT NULL,
    time_window_minutes INTEGER NOT NULL DEFAULT 5,
    enabled BOOLEAN NOT NULL DEFAULT true,
    webhook_url VARCHAR(500),
    email_recipients TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backoff penalties for repeated violations
CREATE TABLE rate_limit_penalties (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    violation_count INTEGER NOT NULL DEFAULT 1,
    penalty_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    penalty_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(identifier, endpoint)
);

-- Create indexes for performance
CREATE INDEX idx_rate_limit_rules_endpoint_method ON rate_limit_rules(endpoint, method);
CREATE INDEX idx_rate_limit_rules_tier ON rate_limit_rules(tier);
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_rate_limit_usage_identifier ON rate_limit_usage(identifier);
CREATE INDEX idx_rate_limit_usage_endpoint_method ON rate_limit_usage(endpoint, method);
CREATE INDEX idx_rate_limit_usage_window ON rate_limit_usage(window_start, window_end);
CREATE INDEX idx_rate_limit_analytics_date ON rate_limit_analytics(date);
CREATE INDEX idx_rate_limit_analytics_endpoint ON rate_limit_analytics(endpoint, method);
CREATE INDEX idx_rate_limit_penalties_identifier ON rate_limit_penalties(identifier);
CREATE INDEX idx_rate_limit_penalties_until ON rate_limit_penalties(penalty_until);

-- Insert default rate limiting rules
INSERT INTO rate_limit_rules (endpoint, method, tier, window_seconds, max_requests, burst_limit) VALUES
-- Email endpoints
('/email/send', 'POST', 'basic', 60, 10, 15),
('/email/send', 'POST', 'premium', 60, 50, 75),
('/email/send', 'POST', 'enterprise', 60, 200, 300),
('/email/campaigns', 'POST', 'basic', 300, 5, 8),
('/email/campaigns', 'POST', 'premium', 300, 20, 30),
('/email/campaigns', 'POST', 'enterprise', 300, 100, 150),

-- Prospect endpoints
('/prospect/create', 'POST', 'basic', 60, 50, 75),
('/prospect/create', 'POST', 'premium', 60, 200, 300),
('/prospect/create', 'POST', 'enterprise', 60, 1000, 1500),
('/prospect/search', 'POST', 'basic', 60, 100, 150),
('/prospect/search', 'POST', 'premium', 60, 500, 750),
('/prospect/search', 'POST', 'enterprise', 60, 2000, 3000),

-- AI CRM endpoints
('/ai_crm/analyze', 'POST', 'basic', 60, 20, 30),
('/ai_crm/analyze', 'POST', 'premium', 60, 100, 150),
('/ai_crm/analyze', 'POST', 'enterprise', 60, 500, 750),
('/ai_crm/recommendations', 'GET', 'basic', 60, 50, 75),
('/ai_crm/recommendations', 'GET', 'premium', 60, 200, 300),
('/ai_crm/recommendations', 'GET', 'enterprise', 60, 1000, 1500),

-- Scoring endpoints
('/scoring/score', 'POST', 'basic', 60, 100, 150),
('/scoring/score', 'POST', 'premium', 60, 500, 750),
('/scoring/score', 'POST', 'enterprise', 60, 2000, 3000),
('/scoring/bulk', 'POST', 'basic', 300, 5, 8),
('/scoring/bulk', 'POST', 'premium', 300, 20, 30),
('/scoring/bulk', 'POST', 'enterprise', 300, 100, 150),

-- Salesforce sync endpoints
('/salesforce/sync', 'POST', 'basic', 300, 10, 15),
('/salesforce/sync', 'POST', 'premium', 300, 50, 75),
('/salesforce/sync', 'POST', 'enterprise', 300, 200, 300),

-- Analytics endpoints
('/analytics/metrics', 'GET', 'basic', 60, 60, 90),
('/analytics/metrics', 'GET', 'premium', 60, 300, 450),
('/analytics/metrics', 'GET', 'enterprise', 60, 1200, 1800),

-- Agent control endpoints
('/agent/control', 'POST', 'basic', 60, 30, 45),
('/agent/control', 'POST', 'premium', 60, 100, 150),
('/agent/control', 'POST', 'enterprise', 60, 500, 750);

-- Insert default user quotas for different tiers
INSERT INTO user_quotas (user_id, tier, daily_quota, monthly_quota) VALUES
('default_basic', 'basic', 1000, 30000),
('default_premium', 'premium', 5000, 150000),
('default_enterprise', 'enterprise', 20000, 600000);

-- Insert default alert configurations
INSERT INTO rate_limit_alerts (name, threshold_type, threshold_value, time_window_minutes) VALUES
('High Usage Warning', 'usage_percentage', 80.0, 5),
('Quota Nearly Exceeded', 'quota_percentage', 90.0, 60),
('Excessive Blocking', 'blocked_requests', 50.0, 5),
('Critical Quota Breach', 'quota_percentage', 95.0, 15);