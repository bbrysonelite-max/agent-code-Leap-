-- Add business data fields required for Alien Probe Reports
ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS employee_count INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'United States';

-- Create indexes for filtering/reporting
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
CREATE INDEX IF NOT EXISTS idx_leads_employee_count ON leads(employee_count);

