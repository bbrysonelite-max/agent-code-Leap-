-- Add client_id to agents table
ALTER TABLE agents ADD COLUMN client_id INTEGER;

-- Add index for performance
CREATE INDEX idx_agents_client_id ON agents(client_id);

-- Note: Foreign key constraint will be added later when client_configurations table is guaranteed to exist