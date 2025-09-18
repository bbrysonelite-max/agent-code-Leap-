CREATE TABLE prospects (
  id BIGSERIAL PRIMARY KEY,
  agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  linkedin_profile TEXT,
  company TEXT,
  position TEXT,
  classification TEXT NOT NULL DEFAULT 'unqualified' CHECK (classification IN ('business_builder', 'product_customer', 'unqualified')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'responded', 'qualified', 'converted')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospects_agent_id ON prospects(agent_id);
CREATE INDEX idx_prospects_classification ON prospects(classification);
CREATE INDEX idx_prospects_status ON prospects(status);