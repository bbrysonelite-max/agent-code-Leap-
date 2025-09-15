-- Create field mappings table for AI-powered data mapping
CREATE TABLE salesforce_field_mappings (
  id BIGSERIAL PRIMARY KEY,
  connection_id BIGINT NOT NULL REFERENCES salesforce_connections(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN ('Lead', 'Contact', 'Account', 'Opportunity')),
  local_field TEXT NOT NULL,
  salesforce_field TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'email', 'phone', 'date', 'boolean', 'picklist', 'number')),
  transformation_rule JSONB,
  is_ai_mapped BOOLEAN NOT NULL DEFAULT false,
  confidence_score DECIMAL(3,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, object_type, local_field)
);