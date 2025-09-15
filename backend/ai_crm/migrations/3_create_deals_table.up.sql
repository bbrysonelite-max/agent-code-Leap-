CREATE TABLE deals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  stage TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability REAL NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  ai_win_probability REAL NOT NULL DEFAULT 0 CHECK (ai_win_probability >= 0 AND ai_win_probability <= 100),
  ai_risk_factors TEXT[] DEFAULT ARRAY[]::TEXT[],
  ai_recommendations TEXT[] DEFAULT ARRAY[]::TEXT[],
  expected_close_date DATE,
  actual_close_date DATE,
  assigned_to TEXT,
  source TEXT NOT NULL CHECK (source IN ('website', 'social_media', 'referral', 'cold_outreach', 'event', 'import', 'api')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deals_contact_id ON deals(contact_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_value ON deals(value);
CREATE INDEX idx_deals_ai_win_probability ON deals(ai_win_probability);
CREATE INDEX idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX idx_deals_expected_close_date ON deals(expected_close_date);
CREATE INDEX idx_deals_created_at ON deals(created_at);