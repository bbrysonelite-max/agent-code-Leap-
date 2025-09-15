-- Create sync logs table for tracking synchronization
CREATE TABLE salesforce_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  connection_id BIGINT NOT NULL REFERENCES salesforce_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'realtime')),
  direction TEXT NOT NULL CHECK (direction IN ('to_salesforce', 'from_salesforce', 'bidirectional')),
  object_type TEXT NOT NULL,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_success INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_details JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create index for efficient sync log queries
CREATE INDEX idx_sync_logs_connection_status ON salesforce_sync_logs(connection_id, status);
CREATE INDEX idx_sync_logs_started_at ON salesforce_sync_logs(started_at DESC);