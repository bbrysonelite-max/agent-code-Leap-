CREATE TABLE conversation_analysis (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  transcript TEXT,
  summary TEXT NOT NULL,
  sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('very_negative', 'negative', 'neutral', 'positive', 'very_positive')),
  key_points TEXT[] DEFAULT ARRAY[]::TEXT[],
  action_items TEXT[] DEFAULT ARRAY[]::TEXT[],
  objections TEXT[] DEFAULT ARRAY[]::TEXT[],
  buying_signals TEXT[] DEFAULT ARRAY[]::TEXT[],
  next_steps TEXT[] DEFAULT ARRAY[]::TEXT[],
  ai_score REAL NOT NULL DEFAULT 0 CHECK (ai_score >= 0 AND ai_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversation_analysis_activity_id ON conversation_analysis(activity_id);
CREATE INDEX idx_conversation_analysis_sentiment ON conversation_analysis(sentiment);
CREATE INDEX idx_conversation_analysis_ai_score ON conversation_analysis(ai_score);
CREATE INDEX idx_conversation_analysis_created_at ON conversation_analysis(created_at);