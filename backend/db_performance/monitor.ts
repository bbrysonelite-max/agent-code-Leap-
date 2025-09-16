import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { performanceDB } from "./db";
import { 
  QueryPerformanceRecord, 
  SlowQueryRecord, 
  DatabaseConnectionStats, 
  QueryPattern,
  PerformanceAlert,
  PerformanceDashboard,
  QueryAnalysis,
  PerformanceMetrics
} from "./types";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";
import { fastCache, generateCacheKey } from "../shared/query-cache";
import crypto from "crypto";

export interface LogQueryPerformanceRequest {
  query_text: string;
  database_name: string;
  service_name: string;
  execution_time_ms: number;
  rows_affected?: number;
  rows_returned?: number;
  query_plan?: string;
  user_id?: string;
  request_id?: string;
  cache_hit?: boolean;
  connection_pool_wait_ms?: number;
}

export interface GetPerformanceDashboardRequest {
  timeframe?: Query<string>; // '1h', '24h', '7d', '30d'
  service_name?: Query<string>;
}

export interface GetQueryAnalysisRequest {
  query_hash: Query<string>;
  timeframe?: Query<string>;
}

export interface GetPerformanceMetricsRequest {
  timeframe?: Query<string>;
  service_name?: Query<string>;
}

const SLOW_QUERY_THRESHOLD_MS = 1000;
const CRITICAL_THRESHOLD_MS = 5000;

function generateQueryHash(queryText: string): string {
  // Normalize query for pattern matching
  const normalized = queryText
    .replace(/\s+/g, ' ')
    .replace(/\$\d+/g, '$?')
    .replace(/\d+/g, '?')
    .replace(/'[^']*'/g, "'?'")
    .trim()
    .toLowerCase();
  
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

function generateQueryTemplate(queryText: string): string {
  return queryText
    .replace(/\$\d+/g, '$?')
    .replace(/\d+/g, '?')
    .replace(/'[^']*'/g, "'?'")
    .replace(/\s+/g, ' ')
    .trim();
}

export const logQueryPerformance = api<LogQueryPerformanceRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/db-performance/log" },
  wrapAsync(async (req) => {
    validateField(req.query_text, "query_text", [Rules.required(), Rules.minLength(1)]);
    validateField(req.database_name, "database_name", [Rules.required(), Rules.minLength(1)]);
    validateField(req.service_name, "service_name", [Rules.required(), Rules.minLength(1)]);
    validateField(req.execution_time_ms, "execution_time_ms", [Rules.required(), Rules.min(0)]);

    const query_hash = generateQueryHash(req.query_text);
    const is_slow_query = req.execution_time_ms >= SLOW_QUERY_THRESHOLD_MS;

    // Log the query performance
    await executeQuery(
      () => performanceDB.exec`
        INSERT INTO query_performance (
          query_hash, query_text, database_name, service_name, execution_time_ms,
          rows_affected, rows_returned, query_plan, user_id, request_id,
          is_slow_query, cache_hit, connection_pool_wait_ms
        ) VALUES (
          ${query_hash}, ${req.query_text}, ${req.database_name}, ${req.service_name},
          ${req.execution_time_ms}, ${req.rows_affected || null}, ${req.rows_returned || null},
          ${req.query_plan || null}, ${req.user_id || null}, ${req.request_id || null},
          ${is_slow_query}, ${req.cache_hit || false}, ${req.connection_pool_wait_ms || 0}
        )
      `,
      "log query performance"
    );

    // Update query patterns
    await updateQueryPattern(query_hash, req.query_text, req.service_name, req.execution_time_ms, is_slow_query, req.cache_hit || false);

    // Log slow queries separately
    if (is_slow_query) {
      await logSlowQuery(req, query_hash);
    }

    // Check for alerts
    await checkPerformanceAlerts(req, query_hash, is_slow_query);

    return { success: true };
  })
);

async function updateQueryPattern(
  queryHash: string, 
  queryText: string, 
  serviceName: string, 
  executionTime: number, 
  isSlowQuery: boolean,
  cacheHit: boolean
): Promise<void> {
  const template = generateQueryTemplate(queryText);
  const patternHash = generateQueryHash(template);

  await executeQuery(
    () => performanceDB.exec`
      INSERT INTO query_patterns (
        pattern_hash, pattern_template, service_name, total_executions,
        avg_execution_time_ms, min_execution_time_ms, max_execution_time_ms,
        slow_query_count, cache_hit_rate
      ) VALUES (
        ${patternHash}, ${template}, ${serviceName}, 1, ${executionTime},
        ${executionTime}, ${executionTime}, ${isSlowQuery ? 1 : 0}, ${cacheHit ? 100 : 0}
      )
      ON CONFLICT (pattern_hash) DO UPDATE SET
        total_executions = query_patterns.total_executions + 1,
        avg_execution_time_ms = (
          (query_patterns.avg_execution_time_ms * query_patterns.total_executions + ${executionTime}) / 
          (query_patterns.total_executions + 1)
        ),
        min_execution_time_ms = LEAST(query_patterns.min_execution_time_ms, ${executionTime}),
        max_execution_time_ms = GREATEST(query_patterns.max_execution_time_ms, ${executionTime}),
        slow_query_count = query_patterns.slow_query_count + ${isSlowQuery ? 1 : 0},
        cache_hit_rate = (
          (query_patterns.cache_hit_rate * query_patterns.total_executions + ${cacheHit ? 100 : 0}) /
          (query_patterns.total_executions + 1)
        ),
        last_seen = CURRENT_TIMESTAMP,
        is_problematic = (
          (query_patterns.avg_execution_time_ms * query_patterns.total_executions + ${executionTime}) / 
          (query_patterns.total_executions + 1)
        ) > ${SLOW_QUERY_THRESHOLD_MS} OR 
        (query_patterns.slow_query_count + ${isSlowQuery ? 1 : 0}) > (query_patterns.total_executions + 1) * 0.1
    `,
    "update query pattern"
  );
}

async function logSlowQuery(req: LogQueryPerformanceRequest, queryHash: string): Promise<void> {
  const severity = req.execution_time_ms >= CRITICAL_THRESHOLD_MS ? 'critical' : 
                   req.execution_time_ms >= 3000 ? 'high' : 'medium';

  await executeQuery(
    () => performanceDB.exec`
      INSERT INTO slow_query_log (
        query_hash, query_text, database_name, service_name, execution_time_ms,
        query_plan, severity
      ) VALUES (
        ${queryHash}, ${req.query_text}, ${req.database_name}, ${req.service_name},
        ${req.execution_time_ms}, ${req.query_plan || null}, ${severity}
      )
    `,
    "log slow query"
  );
}

async function checkPerformanceAlerts(
  req: LogQueryPerformanceRequest, 
  queryHash: string, 
  isSlowQuery: boolean
): Promise<void> {
  if (req.execution_time_ms >= CRITICAL_THRESHOLD_MS) {
    await createAlert(
      'critical_slow_query',
      'critical',
      'Critical Slow Query Detected',
      `Query executed in ${req.execution_time_ms}ms (threshold: ${CRITICAL_THRESHOLD_MS}ms)`,
      req.service_name,
      req.database_name,
      queryHash,
      { execution_time_ms: req.execution_time_ms, threshold: CRITICAL_THRESHOLD_MS }
    );
  }

  // Check for high connection pool wait times
  if (req.connection_pool_wait_ms && req.connection_pool_wait_ms > 5000) {
    await createAlert(
      'high_connection_wait',
      'high',
      'High Connection Pool Wait Time',
      `Query waited ${req.connection_pool_wait_ms}ms for database connection`,
      req.service_name,
      req.database_name,
      queryHash,
      { wait_time_ms: req.connection_pool_wait_ms }
    );
  }
}

async function createAlert(
  alertType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  title: string,
  description: string,
  serviceName?: string,
  databaseName?: string,
  queryHash?: string,
  metrics?: any
): Promise<void> {
  await executeQuery(
    () => performanceDB.exec`
      INSERT INTO performance_alerts (
        alert_type, severity, title, description, service_name,
        database_name, query_hash, metrics
      ) VALUES (
        ${alertType}, ${severity}, ${title}, ${description}, ${serviceName || null},
        ${databaseName || null}, ${queryHash || null}, ${JSON.stringify(metrics) || null}
      )
    `,
    "create performance alert"
  );
}

export const logConnectionStats = api<DatabaseConnectionStats, { success: boolean }>(
  { expose: true, method: "POST", path: "/db-performance/connections" },
  wrapAsync(async (req) => {
    validateField(req.database_name, "database_name", [Rules.required()]);
    validateField(req.service_name, "service_name", [Rules.required()]);
    validateField(req.active_connections, "active_connections", [Rules.required(), Rules.min(0)]);
    validateField(req.max_connections, "max_connections", [Rules.required(), Rules.min(1)]);

    await executeQuery(
      () => performanceDB.exec`
        INSERT INTO database_connections (
          database_name, service_name, active_connections, max_connections,
          idle_connections, connection_utilization, avg_connection_time_ms
        ) VALUES (
          ${req.database_name}, ${req.service_name}, ${req.active_connections},
          ${req.max_connections}, ${req.idle_connections}, ${req.connection_utilization},
          ${req.avg_connection_time_ms || null}
        )
      `,
      "log connection stats"
    );

    // Check for high utilization alerts
    if (req.connection_utilization > 90) {
      await createAlert(
        'high_connection_utilization',
        req.connection_utilization > 95 ? 'critical' : 'high',
        'High Database Connection Utilization',
        `Connection utilization at ${req.connection_utilization}% (${req.active_connections}/${req.max_connections})`,
        req.service_name,
        req.database_name,
        undefined,
        { utilization: req.connection_utilization, active: req.active_connections, max: req.max_connections }
      );
    }

    return { success: true };
  })
);

export const getPerformanceDashboard = api<GetPerformanceDashboardRequest, PerformanceDashboard>(
  { expose: true, method: "GET", path: "/db-performance/dashboard" },
  wrapAsync(async (req) => {
    const timeframe = req.timeframe || '24h';
    const cacheKey = generateCacheKey('perf_dashboard', timeframe, req.service_name || 'all');
    
    const cached = await fastCache.get<PerformanceDashboard>(cacheKey);
    if (cached) return cached;

    validateField(timeframe, "timeframe", [Rules.oneOf(['1h', '24h', '7d', '30d'])]);

    const intervalClause = getTimeframeClause(timeframe);
    const serviceFilter = req.service_name ? `AND service_name = '${req.service_name}'` : '';

    // Get overview metrics
    const overview = await executeQuery(
      () => performanceDB.rawQueryRow<{
        avg_query_time: number;
        slow_query_count: number;
        total_queries: number;
        cache_hit_rate: number;
      }>(`
        SELECT 
          AVG(execution_time_ms) as avg_query_time,
          COUNT(CASE WHEN is_slow_query THEN 1 END) as slow_query_count,
          COUNT(*) as total_queries,
          AVG(CASE WHEN cache_hit THEN 100 ELSE 0 END) as cache_hit_rate
        FROM query_performance 
        WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
      `),
      "fetch overview metrics"
    );

    // Get connection utilization
    const connectionStats = await executeQuery(
      () => performanceDB.rawQueryAll<DatabaseConnectionStats>(`
        SELECT DISTINCT ON (database_name, service_name)
          database_name, service_name, active_connections, max_connections,
          idle_connections, connection_utilization, avg_connection_time_ms, timestamp
        FROM database_connections 
        WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
        ORDER BY database_name, service_name, timestamp DESC
      `),
      "fetch connection stats"
    );

    const avgConnectionUtilization = connectionStats.length > 0 
      ? connectionStats.reduce((sum, stat) => sum + stat.connection_utilization, 0) / connectionStats.length 
      : 0;

    // Get slowest queries
    const slowestQueries = await executeQuery(
      () => performanceDB.rawQueryAll<{
        query_hash: string;
        query_text: string;
        avg_execution_time: number;
        execution_count: number;
        service_name: string;
      }>(`
        SELECT 
          query_hash,
          query_text,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(*) as execution_count,
          service_name
        FROM query_performance 
        WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
        GROUP BY query_hash, query_text, service_name
        ORDER BY avg_execution_time DESC
        LIMIT 10
      `),
      "fetch slowest queries"
    );

    // Get most frequent queries
    const mostFrequentQueries = await executeQuery(
      () => performanceDB.rawQueryAll<{
        query_hash: string;
        query_text: string;
        execution_count: number;
        avg_execution_time: number;
        service_name: string;
      }>(`
        SELECT 
          query_hash,
          query_text,
          COUNT(*) as execution_count,
          AVG(execution_time_ms) as avg_execution_time,
          service_name
        FROM query_performance 
        WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
        GROUP BY query_hash, query_text, service_name
        ORDER BY execution_count DESC
        LIMIT 10
      `),
      "fetch most frequent queries"
    );

    // Get recent alerts
    const recentAlerts = await executeQuery(
      () => performanceDB.rawQueryAll<PerformanceAlert>(`
        SELECT * FROM performance_alerts 
        WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' 
        ${req.service_name ? `AND service_name = '${req.service_name}'` : ''}
        AND resolved = FALSE
        ORDER BY timestamp DESC
        LIMIT 20
      `),
      "fetch recent alerts"
    );

    // Get problematic patterns
    const problematicPatterns = await executeQuery(
      () => performanceDB.rawQueryAll<QueryPattern>(`
        SELECT * FROM query_patterns 
        WHERE is_problematic = TRUE 
        ${req.service_name ? `AND service_name = '${req.service_name}'` : ''}
        ORDER BY avg_execution_time_ms DESC
        LIMIT 10
      `),
      "fetch problematic patterns"
    );

    const dashboard: PerformanceDashboard = {
      overview: {
        avg_query_time: Math.round(overview?.avg_query_time || 0),
        slow_query_count: overview?.slow_query_count || 0,
        total_queries: overview?.total_queries || 0,
        cache_hit_rate: Math.round((overview?.cache_hit_rate || 0) * 10) / 10,
        connection_utilization: Math.round(avgConnectionUtilization * 10) / 10
      },
      slowest_queries: slowestQueries.map(q => ({
        ...q,
        avg_execution_time: Math.round(q.avg_execution_time)
      })),
      most_frequent_queries: mostFrequentQueries.map(q => ({
        ...q,
        avg_execution_time: Math.round(q.avg_execution_time)
      })),
      connection_stats: connectionStats,
      recent_alerts: recentAlerts,
      problematic_patterns: problematicPatterns
    };

    await fastCache.set(cacheKey, dashboard, 300); // Cache for 5 minutes
    return dashboard;
  })
);

function getTimeframeClause(timeframe: string): string {
  switch (timeframe) {
    case '1h': return '1 hour';
    case '24h': return '24 hours';
    case '7d': return '7 days';
    case '30d': return '30 days';
    default: return '24 hours';
  }
}