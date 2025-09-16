CREATE TABLE data_mapping (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  data_category VARCHAR(100) NOT NULL, -- 'personal', 'contact', 'financial', 'behavioral', 'technical'
  data_type VARCHAR(50) NOT NULL, -- 'identifier', 'sensitive', 'derived', 'metadata'
  is_user_identifier BOOLEAN DEFAULT false,
  retention_policy VARCHAR(255),
  anonymization_method VARCHAR(100), -- 'delete', 'hash', 'random', 'null'
  is_exportable BOOLEAN DEFAULT true,
  export_name VARCHAR(255), -- Human readable name for exports
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_name, table_name, column_name),
  INDEX idx_data_mapping_service (service_name),
  INDEX idx_data_mapping_category (data_category),
  INDEX idx_data_mapping_user_id (is_user_identifier)
);

-- Default data mappings for existing services
INSERT INTO data_mapping (service_name, table_name, column_name, data_category, data_type, is_user_identifier, export_name, anonymization_method) VALUES
-- User data
('auth', 'users', 'id', 'personal', 'identifier', true, 'User ID', 'delete'),
('auth', 'users', 'email', 'contact', 'identifier', false, 'Email Address', 'hash'),
('auth', 'users', 'name', 'personal', 'identifier', false, 'Full Name', 'delete'),
('auth', 'users', 'created_at', 'metadata', 'metadata', false, 'Account Created', 'null'),

-- Prospect data
('prospect', 'prospects', 'user_id', 'personal', 'identifier', true, 'Owner User ID', 'delete'),
('prospect', 'prospects', 'name', 'contact', 'identifier', false, 'Prospect Name', 'delete'),
('prospect', 'prospects', 'email', 'contact', 'identifier', false, 'Prospect Email', 'hash'),
('prospect', 'prospects', 'company', 'contact', 'derived', false, 'Company Name', 'delete'),
('prospect', 'prospects', 'position', 'contact', 'derived', false, 'Job Title', 'delete'),

-- CRM data
('ai_crm', 'leads', 'user_id', 'personal', 'identifier', true, 'Owner User ID', 'delete'),
('ai_crm', 'leads', 'name', 'contact', 'identifier', false, 'Lead Name', 'delete'),
('ai_crm', 'leads', 'email', 'contact', 'identifier', false, 'Lead Email', 'hash'),
('ai_crm', 'leads', 'phone', 'contact', 'identifier', false, 'Phone Number', 'hash'),

-- Email data
('email', 'campaigns', 'user_id', 'personal', 'identifier', true, 'Owner User ID', 'delete'),
('email', 'email_responses', 'prospect_email', 'contact', 'identifier', false, 'Response Email', 'hash'),

-- Scoring data
('scoring', 'prospect_scores', 'user_id', 'personal', 'identifier', true, 'Owner User ID', 'delete'),
('scoring', 'prospect_scores', 'prospect_id', 'behavioral', 'derived', false, 'Scored Prospect', 'delete');