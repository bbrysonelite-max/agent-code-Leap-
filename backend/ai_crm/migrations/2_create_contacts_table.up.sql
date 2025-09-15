CREATE TABLE contacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  company TEXT,
  position TEXT,
  type TEXT NOT NULL DEFAULT 'prospect' CHECK (type IN ('prospect', 'customer', 'partner', 'vendor')),
  linkedin_profile TEXT,
  twitter_handle TEXT,
  website TEXT,
  address TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  ai_personality_profile TEXT,
  communication_preferences TEXT,
  lifetime_value REAL NOT NULL DEFAULT 0,
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_contacts_lead_id ON contacts(lead_id);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_lifetime_value ON contacts(lifetime_value);
CREATE INDEX idx_contacts_last_interaction_at ON contacts(last_interaction_at);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);