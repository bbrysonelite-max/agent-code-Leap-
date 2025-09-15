-- Create sync mappings table to track record relationships
CREATE TABLE salesforce_sync_mappings (
  id BIGSERIAL PRIMARY KEY,
  connection_id BIGINT NOT NULL REFERENCES salesforce_connections(id) ON DELETE CASCADE,
  local_table TEXT NOT NULL CHECK (local_table IN ('prospects', 'agents', 'email_campaigns')),
  local_record_id BIGINT NOT NULL,
  salesforce_object TEXT NOT NULL,
  salesforce_record_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  local_updated_at TIMESTAMPTZ,
  salesforce_updated_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, local_table, local_record_id, salesforce_object)
);

-- Create indexes for efficient mapping lookups
CREATE INDEX idx_sync_mappings_local ON salesforce_sync_mappings(local_table, local_record_id);
CREATE INDEX idx_sync_mappings_salesforce ON salesforce_sync_mappings(salesforce_object, salesforce_record_id);
CREATE INDEX idx_sync_mappings_status ON salesforce_sync_mappings(sync_status);