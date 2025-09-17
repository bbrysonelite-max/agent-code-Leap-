CREATE TABLE user_subscriptions (
  user_id VARCHAR(255) PRIMARY KEY,
  subscription_id VARCHAR(255) NOT NULL,
  event_types JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  prospect_id VARCHAR(255),
  sequence_id UUID,
  priority VARCHAR(20) NOT NULL DEFAULT 'low',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE click_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(100) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_user_subscriptions_active ON user_subscriptions(is_active);
CREATE INDEX idx_user_subscriptions_event_types ON user_subscriptions USING GIN(event_types);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_event_type ON notifications(event_type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_prospect_id ON notifications(prospect_id);
CREATE INDEX idx_notifications_sequence_id ON notifications(sequence_id);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX idx_click_analytics_prospect_id ON click_analytics(prospect_id);
CREATE INDEX idx_click_analytics_clicked_at ON click_analytics(clicked_at DESC);
CREATE INDEX idx_click_analytics_source ON click_analytics(source);