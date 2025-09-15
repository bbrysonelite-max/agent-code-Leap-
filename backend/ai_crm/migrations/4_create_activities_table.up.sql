CREATE TABLE activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id TEXT REFERENCES deals(id) ON DELETE CASCADE,
  lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task', 'linkedin_message')),
  subject TEXT NOT NULL,
  description TEXT,
  outcome TEXT,
  ai_sentiment TEXT DEFAULT 'neutral' CHECK (ai_sentiment IN ('very_negative', 'negative', 'neutral', 'positive', 'very_positive')),
  ai_key_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  ai_action_items TEXT[] DEFAULT ARRAY[]::TEXT[],
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT activities_entity_check CHECK (
    (contact_id IS NOT NULL) OR (deal_id IS NOT NULL) OR (lead_id IS NOT NULL)
  )
);

CREATE INDEX idx_activities_contact_id ON activities(contact_id);
CREATE INDEX idx_activities_deal_id ON activities(deal_id);
CREATE INDEX idx_activities_lead_id ON activities(lead_id);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_ai_sentiment ON activities(ai_sentiment);
CREATE INDEX idx_activities_scheduled_at ON activities(scheduled_at);
CREATE INDEX idx_activities_completed_at ON activities(completed_at);
CREATE INDEX idx_activities_created_at ON activities(created_at);