CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  trigger VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  ai_prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger);
CREATE INDEX idx_automation_rules_is_active ON automation_rules(is_active);