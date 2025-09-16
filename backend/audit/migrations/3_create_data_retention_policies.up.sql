CREATE TABLE data_retention_policies (
  id SERIAL PRIMARY KEY,
  resource_type VARCHAR(100) NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL,
  auto_delete BOOLEAN DEFAULT false,
  compliance_requirement VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default retention policies
INSERT INTO data_retention_policies (resource_type, retention_days, auto_delete, compliance_requirement) VALUES
('audit_logs', 2555, false, 'GDPR - 7 years for financial records'),
('security_logs', 2555, false, 'Security compliance - 7 years'),
('user_data', 365, false, 'GDPR - Request based deletion'),
('prospect_data', 1095, false, 'Business requirement - 3 years'),
('email_data', 365, false, 'GDPR - Marketing data');