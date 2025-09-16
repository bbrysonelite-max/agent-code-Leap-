CREATE TABLE security_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
  user_id VARCHAR(255),
  session_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN,
  failure_reason TEXT,
  metadata JSONB,
  service_name VARCHAR(100) NOT NULL,
  endpoint VARCHAR(255),
  request_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_event_type ON security_logs (event_type);
CREATE INDEX idx_security_user_id ON security_logs (user_id);
CREATE INDEX idx_security_severity ON security_logs (severity);
CREATE INDEX idx_security_success ON security_logs (success);
CREATE INDEX idx_security_created_at ON security_logs (created_at);
CREATE INDEX idx_security_service ON security_logs (service_name);