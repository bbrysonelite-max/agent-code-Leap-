-- Add client_id to agents table
ALTER TABLE agents ADD COLUMN client_id INTEGER;

-- Add foreign key constraint
ALTER TABLE agents ADD CONSTRAINT fk_agents_client_id 
    FOREIGN KEY (client_id) REFERENCES client_configurations(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_agents_client_id ON agents(client_id);