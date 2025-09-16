CREATE TABLE gdpr_requests (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL, -- 'export', 'delete', 'rectification', 'portability'
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  submitted_by VARCHAR(255), -- Who submitted the request (user_id or admin_id)
  verification_method VARCHAR(100),
  verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'failed'
  data_categories TEXT[], -- Array of data categories requested
  export_format VARCHAR(20), -- 'json', 'csv', 'xml' for export requests
  export_file_path TEXT,
  deletion_completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ -- For temporary export links
);

CREATE INDEX idx_gdpr_user_id ON gdpr_requests (user_id);
CREATE INDEX idx_gdpr_request_type ON gdpr_requests (request_type);
CREATE INDEX idx_gdpr_status ON gdpr_requests (status);
CREATE INDEX idx_gdpr_created_at ON gdpr_requests (created_at);