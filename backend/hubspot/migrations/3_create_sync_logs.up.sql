CREATE TABLE hubspot_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES hubspot_connections(id) ON DELETE CASCADE,
  operation VARCHAR(100) NOT NULL,
  hubspot_id VARCHAR(255),
  local_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  ai_decision JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_connection_id ON hubspot_sync_logs(connection_id);
CREATE INDEX idx_sync_logs_status ON hubspot_sync_logs(status);
CREATE INDEX idx_sync_logs_created_at ON hubspot_sync_logs(created_at);