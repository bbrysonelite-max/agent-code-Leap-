CREATE TABLE client_configurations (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL UNIQUE,
    business_type VARCHAR(50) NOT NULL,
    business_description TEXT,
    
    -- JSON fields for complex configuration
    enabled_prospect_types JSONB NOT NULL DEFAULT '[]',
    custom_prospect_types JSONB,
    search_config JSONB NOT NULL DEFAULT '{}',
    messaging_config JSONB NOT NULL DEFAULT '{}',
    daily_limits JSONB NOT NULL DEFAULT '{"max_prospects_per_day": 50, "max_emails_per_day": 100}',
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_client_configurations_client_name ON client_configurations(client_name);
CREATE INDEX idx_client_configurations_business_type ON client_configurations(business_type);
CREATE INDEX idx_client_configurations_is_active ON client_configurations(is_active);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_configurations_updated_at 
    BEFORE UPDATE ON client_configurations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();