export interface QueryPerformanceRecord {
  id?: number;
  query_hash: string;
  query_text: string;
  database_name: string;
  service_name: string;
  execution_time_ms: number;
  rows_affected?: number;
  rows_returned?: number;
  query_plan?: string;
  timestamp: Date;
  user_id?: string;
  request_id?: string;
  is_slow_query: boolean;
  cache_hit: boolean;
  connection_pool_wait_ms: number;
}

export interface SlowQueryRecord {
  id?: number;
  query_hash: string;
  query_text: string;
  database_name: string;
  service_name: string;
  execution_time_ms: number;
  query_plan?: string;
  timestamp: Date;
  alert_sent: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_users: number;
  similar_query_count: number;
}

export interface DatabaseConnectionStats {
  id?: number;
  database_name: string;
  service_name: string;
  active_connections: number;
  max_connections: number;
  idle_connections: number;
  connection_utilization: number;
  avg_connection_time_ms?: number;
  timestamp: Date;
}

export interface QueryPattern {
  id?: number;
  pattern_hash: string;
  pattern_template: string;
  service_name: string;
  total_executions: number;
  avg_execution_time_ms: number;
  min_execution_time_ms: number;
  max_execution_time_ms: number;
  slow_query_count: number;
  cache_hit_rate: number;
  first_seen: Date;
  last_seen: Date;
  is_problematic: boolean;
}

export interface PerformanceAlert {
  id?: number;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  service_name?: string;
  database_name?: string;
  query_hash?: string;
  metrics?: any;
  timestamp: Date;
  resolved: boolean;
  resolved_at?: Date;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
}

export interface IndexUsageStats {
  id?: number;
  database_name: string;
  table_name: string;
  index_name: string;
  index_scans: number;
  index_tup_read: number;
  index_tup_fetch: number;
  efficiency_score?: number;
  last_scan?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PerformanceDashboard {
  overview: {
    avg_query_time: number;
    slow_query_count: number;
    total_queries: number;
    cache_hit_rate: number;
    connection_utilization: number;
  };
  slowest_queries: Array<{
    query_hash: string;
    query_text: string;
    avg_execution_time: number;
    execution_count: number;
    service_name: string;
  }>;
  most_frequent_queries: Array<{
    query_hash: string;
    query_text: string;
    execution_count: number;
    avg_execution_time: number;
    service_name: string;
  }>;
  connection_stats: DatabaseConnectionStats[];
  recent_alerts: PerformanceAlert[];
  problematic_patterns: QueryPattern[];
}

export interface QueryAnalysis {
  query_hash: string;
  performance_trend: 'improving' | 'stable' | 'degrading';
  execution_statistics: {
    total_executions: number;
    avg_execution_time: number;
    p95_execution_time: number;
    p99_execution_time: number;
    cache_hit_rate: number;
  };
  optimization_suggestions: string[];
  related_indexes: string[];
  problematic_periods: Array<{
    period: string;
    avg_execution_time: number;
    execution_count: number;
  }>;
}

export interface PerformanceMetrics {
  timeframe: string;
  query_performance: {
    total_queries: number;
    avg_execution_time: number;
    slow_queries: number;
    cache_hit_rate: number;
  };
  connection_metrics: {
    avg_utilization: number;
    peak_utilization: number;
    connection_timeouts: number;
    avg_wait_time: number;
  };
  index_efficiency: {
    total_indexes: number;
    unused_indexes: number;
    inefficient_indexes: number;
    avg_efficiency_score: number;
  };
  top_services: Array<{
    service_name: string;
    query_count: number;
    avg_execution_time: number;
    slow_query_count: number;
  }>;
}