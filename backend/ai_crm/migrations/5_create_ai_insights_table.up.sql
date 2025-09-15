CREATE TABLE ai_insights (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'contact', 'deal', 'activity')),
  entity_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  actionable BOOLEAN NOT NULL DEFAULT true,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  expires_at TIMESTAMP WITH TIME ZONE,
  acted_upon BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_entity ON ai_insights(entity_type, entity_id);
CREATE INDEX idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX idx_ai_insights_priority ON ai_insights(priority);
CREATE INDEX idx_ai_insights_actionable ON ai_insights(actionable);
CREATE INDEX idx_ai_insights_acted_upon ON ai_insights(acted_upon);
CREATE INDEX idx_ai_insights_created_at ON ai_insights(created_at);