-- Performance monitoring tables
CREATE TABLE IF NOT EXISTS query_performance (
  id BIGSERIAL PRIMARY KEY,
  query_hash VARCHAR(64) NOT NULL,
  query_text TEXT NOT NULL,
  database_name VARCHAR(100) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  rows_affected INTEGER,
  rows_returned INTEGER,
  query_plan TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(100),
  request_id VARCHAR(100),
  is_slow_query BOOLEAN DEFAULT FALSE,
  cache_hit BOOLEAN DEFAULT FALSE,
  connection_pool_wait_ms INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS slow_query_log (
  id BIGSERIAL PRIMARY KEY,
  query_hash VARCHAR(64) NOT NULL,
  query_text TEXT NOT NULL,
  database_name VARCHAR(100) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  query_plan TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  alert_sent BOOLEAN DEFAULT FALSE,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  affected_users INTEGER DEFAULT 0,
  similar_query_count INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS database_connections (
  id BIGSERIAL PRIMARY KEY,
  database_name VARCHAR(100) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  active_connections INTEGER NOT NULL,
  max_connections INTEGER NOT NULL,
  idle_connections INTEGER NOT NULL,
  connection_utilization DECIMAL(5,2) NOT NULL,
  avg_connection_time_ms INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS query_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern_hash VARCHAR(64) NOT NULL UNIQUE,
  pattern_template TEXT NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  total_executions INTEGER DEFAULT 1,
  avg_execution_time_ms DECIMAL(10,2),
  min_execution_time_ms INTEGER,
  max_execution_time_ms INTEGER,
  slow_query_count INTEGER DEFAULT 0,
  cache_hit_rate DECIMAL(5,2) DEFAULT 0,
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_problematic BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS performance_alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  service_name VARCHAR(100),
  database_name VARCHAR(100),
  query_hash VARCHAR(64),
  metrics JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(100),
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS index_usage_stats (
  id BIGSERIAL PRIMARY KEY,
  database_name VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  index_name VARCHAR(100) NOT NULL,
  index_scans INTEGER DEFAULT 0,
  index_tup_read INTEGER DEFAULT 0,
  index_tup_fetch INTEGER DEFAULT 0,
  efficiency_score DECIMAL(5,2),
  last_scan TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance monitoring tables
CREATE INDEX idx_query_performance_hash_timestamp ON query_performance(query_hash, timestamp DESC);
CREATE INDEX idx_query_performance_service_timestamp ON query_performance(service_name, timestamp DESC);
CREATE INDEX idx_query_performance_slow ON query_performance(is_slow_query, timestamp DESC) WHERE is_slow_query = TRUE;
CREATE INDEX idx_query_performance_execution_time ON query_performance(execution_time_ms DESC, timestamp DESC);

CREATE INDEX idx_slow_query_log_hash ON slow_query_log(query_hash);
CREATE INDEX idx_slow_query_log_service ON slow_query_log(service_name, timestamp DESC);
CREATE INDEX idx_slow_query_log_severity ON slow_query_log(severity, timestamp DESC);
CREATE INDEX idx_slow_query_log_unalerted ON slow_query_log(alert_sent, timestamp DESC) WHERE alert_sent = FALSE;

CREATE INDEX idx_database_connections_service ON database_connections(service_name, timestamp DESC);
CREATE INDEX idx_database_connections_utilization ON database_connections(connection_utilization DESC, timestamp DESC);

CREATE INDEX idx_query_patterns_service ON query_patterns(service_name, total_executions DESC);
CREATE INDEX idx_query_patterns_problematic ON query_patterns(is_problematic, avg_execution_time_ms DESC) WHERE is_problematic = TRUE;
CREATE INDEX idx_query_patterns_performance ON query_patterns(avg_execution_time_ms DESC, total_executions DESC);

CREATE INDEX idx_performance_alerts_unresolved ON performance_alerts(resolved, severity, timestamp DESC) WHERE resolved = FALSE;
CREATE INDEX idx_performance_alerts_service ON performance_alerts(service_name, timestamp DESC);
CREATE INDEX idx_performance_alerts_type ON performance_alerts(alert_type, timestamp DESC);

CREATE INDEX idx_index_usage_stats_table ON index_usage_stats(database_name, table_name, updated_at DESC);
CREATE INDEX idx_index_usage_stats_efficiency ON index_usage_stats(efficiency_score ASC, last_scan DESC);