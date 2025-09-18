-- Add client_id and update prospect classification
ALTER TABLE prospects ADD COLUMN client_id INTEGER;
ALTER TABLE prospects ADD COLUMN prospect_type VARCHAR(50);
ALTER TABLE prospects ADD COLUMN custom_prospect_type VARCHAR(100);

-- Migrate existing data: convert old classification to new prospect_type
UPDATE prospects SET 
    prospect_type = CASE 
        WHEN classification = 'business_builder' THEN 'distributor'
        WHEN classification = 'product_customer' THEN 'customer'
        WHEN classification = 'unqualified' THEN 'leads'
        ELSE 'customer'
    END;

-- Set prospect_type as NOT NULL after migration
ALTER TABLE prospects ALTER COLUMN prospect_type SET NOT NULL;

-- Note: Foreign key constraint to client_configurations cannot be added 
-- because client_configurations is in a different database (client) 
-- Application logic must ensure referential integrity

-- Add indexes for performance
CREATE INDEX idx_prospects_client_id ON prospects(client_id);
CREATE INDEX idx_prospects_prospect_type ON prospects(prospect_type);
CREATE INDEX idx_prospects_custom_prospect_type ON prospects(custom_prospect_type);

-- Keep the old classification column for now to maintain compatibility
-- ALTER TABLE prospects DROP COLUMN classification; -- Uncomment later when migration is complete