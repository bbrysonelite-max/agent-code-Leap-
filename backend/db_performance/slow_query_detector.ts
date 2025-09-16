import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { performanceDB } from "./db";
import { SlowQueryRecord, PerformanceAlert } from "./types";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";

export interface SlowQueryAnalysisRequest {
  timeframe?: Query<string>;
  severity_threshold?: Query<string>;
  service_name?: Query<string>;
}

export interface SlowQueryAnalysisResponse {
  total_slow_queries: number;
  critical_queries: number;
  most_problematic_queries: Array<{
    query_hash: string;
    query_text: string;
    avg_execution_time: number;
    execution_count: number;
    affected_users: number;
    service_name: string;
    recommendations: string[];
  }>;
  trending_slow_queries: Array<{
    query_hash: string;
    service_name: string;
    trend: 'worsening' | 'improving' | 'stable';
    current_avg: number;
    previous_avg: number;
    change_percent: number;
  }>;
  service_performance: Array<{
    service_name: string;
    slow_query_count: number;
    avg_slow_query_time: number;
    worst_query_time: number;
  }>;
}

export interface DetectSlowQueriesRequest {
  threshold_ms?: number;
  check_period_minutes?: number;
}

const DEFAULT_SLOW_THRESHOLD = 1000; // 1 second
const CRITICAL_THRESHOLD = 5000; // 5 seconds
const VERY_CRITICAL_THRESHOLD = 10000; // 10 seconds

// Note: Cron jobs would be implemented using encore.dev/cron when available
// For now, this slow query detection logic can be called manually via API endpoints

export const runSlowQueryDetection = api<{}, { success: boolean; processed_queries: number }>(
  { expose: true, method: "POST", path: "/db-performance/run-detection" },
  wrapAsync(async () => {
    console.log("Running slow query detection...");
    
    try {
      // Detect slow queries in the last 5 minutes
      const slowQueries = await executeQuery(
        () => performanceDB.rawQueryAll<{
          query_hash: string;
          query_text: string;
          execution_time_ms: number;
          service_name: string;
          database_name: string;
          user_id: string;
          timestamp: Date;
        }>(`
          SELECT DISTINCT 
            query_hash, query_text, execution_time_ms, service_name, 
            database_name, user_id, timestamp
          FROM query_performance 
          WHERE timestamp >= NOW() - INTERVAL '5 minutes'
          AND execution_time_ms >= ${DEFAULT_SLOW_THRESHOLD}
          AND query_hash NOT IN (
            SELECT DISTINCT query_hash 
            FROM slow_query_log 
            WHERE timestamp >= NOW() - INTERVAL '1 hour'
            AND alert_sent = TRUE
          )
          ORDER BY execution_time_ms DESC
        `),
        "detect slow queries"
      );

      console.log(`Found ${slowQueries.length} slow queries to process`);

      for (const query of slowQueries) {
        await processSlowQuery(query);
      }

      // Check for query performance degradation
      await checkPerformanceDegradation();

      // Check for connection pool issues
      await checkConnectionPoolIssues();

      // Cleanup old alerts
      await cleanupOldAlerts();

      return { success: true, processed_queries: slowQueries.length };

    } catch (error) {
      console.error("Slow query detection failed:", error);
      
      // Create alert for detection system failure
      await executeQuery(
        () => performanceDB.exec`
          INSERT INTO performance_alerts (
            alert_type, severity, title, description, metrics
          ) VALUES (
            'system_failure', 'high', 'Slow Query Detection Failed',
            'Automatic slow query detection encountered an error',
            ${JSON.stringify({ error: String(error), timestamp: new Date() })}
          )
        `,
        "log detection failure"
      );

      throw error;
    }
  })
);

async function processSlowQuery(query: {
  query_hash: string;
  query_text: string;
  execution_time_ms: number;
  service_name: string;
  database_name: string;
  user_id: string;
  timestamp: Date;
}): Promise<void> {
  const severity = determineSeverity(query.execution_time_ms);
  
  // Count similar queries in the last hour
  const similarCount = await executeQuery(
    () => performanceDB.rawQueryRow<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM query_performance 
      WHERE query_hash = ${query.query_hash}
      AND timestamp >= NOW() - INTERVAL '1 hour'
      AND execution_time_ms >= ${DEFAULT_SLOW_THRESHOLD}
    `),
    "count similar slow queries"
  );

  const affectedUsers = await executeQuery(
    () => performanceDB.rawQueryRow<{ count: number }>(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM query_performance 
      WHERE query_hash = ${query.query_hash}
      AND timestamp >= NOW() - INTERVAL '1 hour'
      AND user_id IS NOT NULL
    `),
    "count affected users"
  );

  // Log the slow query
  await executeQuery(
    () => performanceDB.exec`
      INSERT INTO slow_query_log (
        query_hash, query_text, database_name, service_name, execution_time_ms,
        severity, affected_users, similar_query_count
      ) VALUES (
        ${query.query_hash}, ${query.query_text}, ${query.database_name},
        ${query.service_name}, ${query.execution_time_ms}, ${severity},
        ${affectedUsers?.count || 0}, ${similarCount?.count || 1}
      )
    `,
    "log slow query"
  );

  // Create alert if necessary
  if (shouldCreateAlert(query.execution_time_ms, similarCount?.count || 1)) {
    await createSlowQueryAlert(query, severity, similarCount?.count || 1, affectedUsers?.count || 0);
  }
}

function determineSeverity(executionTime: number): 'low' | 'medium' | 'high' | 'critical' {
  if (executionTime >= VERY_CRITICAL_THRESHOLD) return 'critical';
  if (executionTime >= CRITICAL_THRESHOLD) return 'high';
  if (executionTime >= 3000) return 'medium';
  return 'low';
}

function shouldCreateAlert(executionTime: number, similarCount: number): boolean {
  // Always alert on very slow queries
  if (executionTime >= CRITICAL_THRESHOLD) return true;
  
  // Alert on patterns of moderately slow queries
  if (executionTime >= 2000 && similarCount >= 5) return true;
  
  // Alert on frequent slow queries
  if (executionTime >= DEFAULT_SLOW_THRESHOLD && similarCount >= 10) return true;
  
  return false;
}

async function createSlowQueryAlert(
  query: any,
  severity: string,
  similarCount: number,
  affectedUsers: number
): Promise<void> {
  const title = `Slow Query Detected - ${severity.toUpperCase()}`;
  const description = `Query executed in ${query.execution_time_ms}ms (${similarCount} similar occurrences, ${affectedUsers} affected users)`;

  await executeQuery(
    () => performanceDB.exec`
      INSERT INTO performance_alerts (
        alert_type, severity, title, description, service_name, database_name,
        query_hash, metrics
      ) VALUES (
        'slow_query', ${severity}, ${title}, ${description}, ${query.service_name},
        ${query.database_name}, ${query.query_hash}, ${JSON.stringify({
          execution_time_ms: query.execution_time_ms,
          similar_count: similarCount,
          affected_users: affectedUsers,
          threshold: DEFAULT_SLOW_THRESHOLD
        })}
      )
    `,
    "create slow query alert"
  );

  // Mark the slow query as alerted
  await executeQuery(
    () => performanceDB.exec`
      UPDATE slow_query_log 
      SET alert_sent = TRUE 
      WHERE query_hash = ${query.query_hash}
      AND timestamp >= NOW() - INTERVAL '5 minutes'
    `,
    "mark slow query as alerted"
  );

  console.log(`Created ${severity} alert for slow query: ${query.query_hash} (${query.execution_time_ms}ms)`);
}

async function checkPerformanceDegradation(): Promise<void> {
  // Check for queries that have become significantly slower
  const degradedQueries = await executeQuery(
    () => performanceDB.rawQueryAll<{
      query_hash: string;
      service_name: string;
      current_avg: number;
      previous_avg: number;
      change_percent: number;
    }>(`
      WITH current_period AS (
        SELECT 
          query_hash, service_name,
          AVG(execution_time_ms) as current_avg,
          COUNT(*) as current_count
        FROM query_performance 
        WHERE timestamp >= NOW() - INTERVAL '30 minutes'
        GROUP BY query_hash, service_name
        HAVING COUNT(*) >= 5
      ),
      previous_period AS (
        SELECT 
          query_hash, service_name,
          AVG(execution_time_ms) as previous_avg
        FROM query_performance 
        WHERE timestamp >= NOW() - INTERVAL '2 hours'
        AND timestamp < NOW() - INTERVAL '30 minutes'
        GROUP BY query_hash, service_name
        HAVING COUNT(*) >= 5
      )
      SELECT 
        c.query_hash, c.service_name, c.current_avg, p.previous_avg,
        ROUND(((c.current_avg - p.previous_avg) / p.previous_avg * 100)::numeric, 2) as change_percent
      FROM current_period c
      JOIN previous_period p ON c.query_hash = p.query_hash AND c.service_name = p.service_name
      WHERE c.current_avg > p.previous_avg * 1.5  -- 50% slower
      AND c.current_avg > ${DEFAULT_SLOW_THRESHOLD}  -- Still meaningfully slow
      ORDER BY change_percent DESC
      LIMIT 10
    `),
    "check performance degradation"
  );

  for (const query of degradedQueries) {
    await executeQuery(
      () => performanceDB.exec`
        INSERT INTO performance_alerts (
          alert_type, severity, title, description, service_name, query_hash, metrics
        ) VALUES (
          'performance_degradation', 'medium', 'Query Performance Degradation Detected',
          'Query performance has degraded by ${query.change_percent}% (from ${Math.round(query.previous_avg)}ms to ${Math.round(query.current_avg)}ms)',
          ${query.service_name}, ${query.query_hash}, ${JSON.stringify({
            current_avg: query.current_avg,
            previous_avg: query.previous_avg,
            change_percent: query.change_percent
          })}
        )
      `,
      "create degradation alert"
    );
  }
}

async function checkConnectionPoolIssues(): Promise<void> {
  // Check for high connection utilization
  const connectionIssues = await executeQuery(
    () => performanceDB.rawQueryAll<{
      service_name: string;
      database_name: string;
      avg_utilization: number;
      max_utilization: number;
      avg_wait_time: number;
    }>(`
      SELECT 
        service_name, database_name,
        AVG(connection_utilization) as avg_utilization,
        MAX(connection_utilization) as max_utilization,
        AVG(avg_connection_time_ms) as avg_wait_time
      FROM database_connections 
      WHERE timestamp >= NOW() - INTERVAL '30 minutes'
      GROUP BY service_name, database_name
      HAVING AVG(connection_utilization) > 80
      ORDER BY avg_utilization DESC
    `),
    "check connection pool issues"
  );

  for (const issue of connectionIssues) {
    const severity = issue.avg_utilization > 95 ? 'critical' : 
                     issue.avg_utilization > 90 ? 'high' : 'medium';

    await executeQuery(
      () => performanceDB.exec`
        INSERT INTO performance_alerts (
          alert_type, severity, title, description, service_name, database_name, metrics
        ) VALUES (
          'high_connection_utilization', ${severity}, 'High Database Connection Utilization',
          'Connection utilization averaged ${Math.round(issue.avg_utilization)}% over the last 30 minutes',
          ${issue.service_name}, ${issue.database_name}, ${JSON.stringify({
            avg_utilization: issue.avg_utilization,
            max_utilization: issue.max_utilization,
            avg_wait_time: issue.avg_wait_time
          })}
        )
      `,
      "create connection alert"
    );
  }
}

async function cleanupOldAlerts(): Promise<void> {
  // Auto-resolve old alerts that are no longer relevant
  await executeQuery(
    () => performanceDB.exec`
      UPDATE performance_alerts 
      SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP
      WHERE resolved = FALSE 
      AND timestamp < NOW() - INTERVAL '24 hours'
      AND alert_type IN ('slow_query', 'performance_degradation')
    `,
    "cleanup old alerts"
  );

  // Delete very old performance records to prevent table bloat
  await executeQuery(
    () => performanceDB.exec`
      DELETE FROM query_performance 
      WHERE timestamp < NOW() - INTERVAL '7 days'
    `,
    "cleanup old performance records"
  );
}

export const getSlowQueryAnalysis = api<SlowQueryAnalysisRequest, SlowQueryAnalysisResponse>(
  { expose: true, method: "GET", path: "/db-performance/slow-queries" },
  wrapAsync(async (req) => {
    const timeframe = req.timeframe || '24h';
    const severityThreshold = req.severity_threshold || 'medium';
    
    validateField(timeframe, "timeframe", [Rules.oneOf(['1h', '24h', '7d', '30d'])]);
    validateField(severityThreshold, "severity_threshold", [Rules.oneOf(['low', 'medium', 'high', 'critical'])]);

    const intervalClause = getTimeframeClause(timeframe);
    const serviceFilter = req.service_name ? `AND service_name = '${req.service_name}'` : '';

    // Get total counts
    const totals = await executeQuery(
      () => performanceDB.rawQueryRow<{ total_slow_queries: number; critical_queries: number }>(`
        SELECT 
          COUNT(*) as total_slow_queries,
          COUNT(CASE WHEN severity IN ('high', 'critical') THEN 1 END) as critical_queries
        FROM slow_query_log 
        WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
      `),
      "get slow query totals"
    );

    // Get most problematic queries
    const problematicQueries = await executeQuery(
      () => performanceDB.rawQueryAll<{
        query_hash: string;
        query_text: string;
        avg_execution_time: number;
        execution_count: number;
        affected_users: number;
        service_name: string;
      }>(`
        SELECT 
          query_hash, query_text, service_name,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(*) as execution_count,
          MAX(affected_users) as affected_users
        FROM slow_query_log 
        WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
        GROUP BY query_hash, query_text, service_name
        ORDER BY avg_execution_time DESC, execution_count DESC
        LIMIT 10
      `),
      "get problematic queries"
    );

    // Add recommendations for each problematic query
    const queriesWithRecommendations = problematicQueries.map(query => ({
      ...query,
      avg_execution_time: Math.round(query.avg_execution_time),
      recommendations: generateOptimizationRecommendations(query.query_text, query.avg_execution_time)
    }));

    // Get trending slow queries (comparing current period with previous)
    const trendingQueries = await executeQuery(
      () => performanceDB.rawQueryAll<{
        query_hash: string;
        service_name: string;
        current_avg: number;
        previous_avg: number;
        change_percent: number;
      }>(`
        WITH current_period AS (
          SELECT 
            query_hash, service_name,
            AVG(execution_time_ms) as current_avg
          FROM slow_query_log 
          WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
          GROUP BY query_hash, service_name
        ),
        previous_period AS (
          SELECT 
            query_hash, service_name,
            AVG(execution_time_ms) as previous_avg
          FROM slow_query_log 
          WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' * 2
          AND timestamp < NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
          GROUP BY query_hash, service_name
        )
        SELECT 
          c.query_hash, c.service_name, c.current_avg, 
          COALESCE(p.previous_avg, c.current_avg) as previous_avg,
          CASE 
            WHEN p.previous_avg IS NULL THEN 0
            ELSE ROUND(((c.current_avg - p.previous_avg) / p.previous_avg * 100)::numeric, 2)
          END as change_percent
        FROM current_period c
        LEFT JOIN previous_period p ON c.query_hash = p.query_hash AND c.service_name = p.service_name
        ORDER BY change_percent DESC
        LIMIT 10
      `),
      "get trending queries"
    );

    const trendingWithTrend = trendingQueries.map(query => ({
      ...query,
      current_avg: Math.round(query.current_avg),
      previous_avg: Math.round(query.previous_avg),
      trend: query.change_percent > 20 ? 'worsening' : 
             query.change_percent < -20 ? 'improving' : 'stable' as 'worsening' | 'improving' | 'stable'
    }));

    // Get service performance summary
    const servicePerformance = await executeQuery(
      () => performanceDB.rawQueryAll<{
        service_name: string;
        slow_query_count: number;
        avg_slow_query_time: number;
        worst_query_time: number;
      }>(`
        SELECT 
          service_name,
          COUNT(*) as slow_query_count,
          AVG(execution_time_ms) as avg_slow_query_time,
          MAX(execution_time_ms) as worst_query_time
        FROM slow_query_log 
        WHERE timestamp >= NOW() - INTERVAL '${intervalClause}' ${serviceFilter}
        GROUP BY service_name
        ORDER BY avg_slow_query_time DESC
      `),
      "get service performance"
    );

    return {
      total_slow_queries: totals?.total_slow_queries || 0,
      critical_queries: totals?.critical_queries || 0,
      most_problematic_queries: queriesWithRecommendations,
      trending_slow_queries: trendingWithTrend,
      service_performance: servicePerformance.map(s => ({
        ...s,
        avg_slow_query_time: Math.round(s.avg_slow_query_time),
        worst_query_time: Math.round(s.worst_query_time)
      }))
    };
  })
);

function generateOptimizationRecommendations(queryText: string, avgExecutionTime: number): string[] {
  const recommendations: string[] = [];
  const lowerQuery = queryText.toLowerCase();

  // Basic SQL optimization recommendations
  if (lowerQuery.includes('select *')) {
    recommendations.push("Avoid SELECT * - specify only needed columns");
  }

  if (lowerQuery.includes('order by') && !lowerQuery.includes('limit')) {
    recommendations.push("Consider adding LIMIT to ORDER BY queries");
  }

  if (lowerQuery.includes('like') && lowerQuery.includes('%')) {
    recommendations.push("Consider full-text search indexes for LIKE '%text%' patterns");
  }

  if (lowerQuery.includes('join') && lowerQuery.split('join').length > 3) {
    recommendations.push("Review complex joins - consider breaking into smaller queries");
  }

  if (lowerQuery.includes('group by') && !lowerQuery.includes('having')) {
    recommendations.push("Consider adding indexes on GROUP BY columns");
  }

  if (lowerQuery.includes('where') && lowerQuery.includes('or')) {
    recommendations.push("Consider using UNION instead of OR for better index usage");
  }

  if (avgExecutionTime > 5000) {
    recommendations.push("Consider query caching for this expensive operation");
    recommendations.push("Review if this operation can be moved to a background job");
  }

  if (lowerQuery.includes('count(*)') && lowerQuery.includes('group by')) {
    recommendations.push("Consider maintaining denormalized counts for frequently accessed aggregates");
  }

  if (recommendations.length === 0) {
    recommendations.push("Review query execution plan and add appropriate indexes");
    recommendations.push("Consider query caching if this is a frequently executed query");
  }

  return recommendations;
}

function getTimeframeClause(timeframe: string): string {
  switch (timeframe) {
    case '1h': return '1 hour';
    case '24h': return '24 hours';
    case '7d': return '7 days';
    case '30d': return '30 days';
    default: return '24 hours';
  }
}

export const resolveAlert = api<{ alert_id: number }, { success: boolean }>(
  { expose: true, method: "POST", path: "/db-performance/alerts/:alert_id/resolve" },
  wrapAsync(async (req) => {
    validateField(req.alert_id, "alert_id", [Rules.required(), Rules.positive()]);

    await executeQuery(
      () => performanceDB.exec`
        UPDATE performance_alerts 
        SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP
        WHERE id = ${req.alert_id}
      `,
      "resolve alert"
    );

    return { success: true };
  })
);

export const acknowledgeAlert = api<{ alert_id: number; acknowledged_by: string }, { success: boolean }>(
  { expose: true, method: "POST", path: "/db-performance/alerts/:alert_id/acknowledge" },
  wrapAsync(async (req) => {
    validateField(req.alert_id, "alert_id", [Rules.required(), Rules.positive()]);
    validateField(req.acknowledged_by, "acknowledged_by", [Rules.required(), Rules.minLength(1)]);

    await executeQuery(
      () => performanceDB.exec`
        UPDATE performance_alerts 
        SET acknowledged = TRUE, acknowledged_by = ${req.acknowledged_by}, acknowledged_at = CURRENT_TIMESTAMP
        WHERE id = ${req.alert_id}
      `,
      "acknowledge alert"
    );

    return { success: true };
  })
);