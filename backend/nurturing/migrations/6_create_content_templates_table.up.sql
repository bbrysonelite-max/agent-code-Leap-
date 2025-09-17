CREATE TABLE content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  subject VARCHAR(500),
  content TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  classification JSONB NOT NULL DEFAULT '[]',
  stages JSONB NOT NULL DEFAULT '[]',
  industry VARCHAR(100),
  persona VARCHAR(100),
  sent_count INTEGER NOT NULL DEFAULT 0,
  open_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  click_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  response_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE behavior_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_templates_type ON content_templates(type);
CREATE INDEX idx_content_templates_classification ON content_templates USING GIN(classification);
CREATE INDEX idx_content_templates_stages ON content_templates USING GIN(stages);
CREATE INDEX idx_content_templates_industry ON content_templates(industry);
CREATE INDEX idx_content_templates_persona ON content_templates(persona);
CREATE INDEX idx_content_templates_performance ON content_templates(response_rate DESC, open_rate DESC);
CREATE INDEX idx_behavior_triggers_event_type ON behavior_triggers(event_type);
CREATE INDEX idx_behavior_triggers_active ON behavior_triggers(is_active);