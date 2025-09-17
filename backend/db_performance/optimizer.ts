import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { performanceDB } from "./db";
import { executeQuery } from "../shared/database";
import { wrapAsync } from "../shared/errors";
import { validateField, Rules } from "../shared/validation";

export interface OptimizationSuggestion {
  type: 'index' | 'query' | 'schema' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact_estimate: string;
  implementation_effort: 'low' | 'medium' | 'high';
  sql_statements?: string[];
  affected_tables: string[];
  affected_services: string[];
  estimated_improvement: {
    query_time_reduction?: string;
    resource_savings?: string;
    scalability_improvement?: string;
  };
}

export interface DatabaseHealthReport {
  overall_score: number;
  performance_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  key_metrics: {
    avg_query_time: number;
    slow_query_percentage: number;
    cache_hit_rate: number;
    connection_efficiency: number;
    index_utilization: number;
  };
  optimization_suggestions: OptimizationSuggestion[];
  urgent_issues: string[];
  maintenance_recommendations: string[];
  capacity_forecast: {
    current_utilization: number;
    projected_growth: string;
    capacity_warning_date?: string;
  };
}

export interface IndexAnalysisRequest {
  database_name?: Query<string>;
  table_name?: Query<string>;
}

export interface IndexAnalysisResponse {
  total_indexes: number;
  unused_indexes: Array<{
    database_name: string;
    table_name: string;
    index_name: string;
    size_mb: number;
    last_used?: string;
    impact: 'low' | 'medium' | 'high';
  }>;
  inefficient_indexes: Array<{
    database_name: string;
    table_name: string;
    index_name: string;
    efficiency_score: number;
    usage_pattern: string;
    recommendations: string[];
  }>;
  missing_indexes: Array<{
    table_name: string;
    suggested_columns: string[];
    query_pattern: string;
    frequency: number;
    estimated_improvement: string;
  }>;
}

export interface QueryOptimizationRequest {
  query_text: Query<string>;
  service_name?: Query<string>;
}

export interface QueryOptimizationResponse {
  original_query: string;
  optimization_suggestions: Array<{
    type: 'rewrite' | 'index' | 'structure';
    suggestion: string;
    optimized_query?: string;
    explanation: string;
    estimated_improvement: string;
  }>;
  execution_plan_analysis: {
    bottlenecks: string[];
    recommendations: string[];
    complexity_score: number;
  };
  caching_recommendations: Array<{
    cache_type: 'query' | 'result' | 'application';
    ttl_suggestion: string;
    implementation_notes: string;
  }>;
}

// Note: Cron jobs would be implemented using encore.dev/cron when available
// For now, this optimization logic can be called manually via API endpoints

async function analyzeQueryPatterns(): Promise<void> {
  // Find queries that could benefit from optimization
  const problematicQueries = await executeQuery(
    () => performanceDB.rawQueryAll<{
      pattern_hash: string;
      pattern_template: string;
      service_name: string;
      avg_execution_time_ms: number;
      total_executions: number;
      slow_query_count: number;
    }>(`
      SELECT 
        pattern_hash, pattern_template, service_name,
        avg_execution_time_ms, total_executions, slow_query_count
      FROM query_patterns 
      WHERE is_problematic = TRUE
      OR (avg_execution_time_ms > 1000 AND total_executions > 100)
      OR (slow_query_count > total_executions * 0.1)
      ORDER BY avg_execution_time_ms DESC, total_executions DESC
      LIMIT 50
    `),
    "analyze query patterns"
  );

  for (const query of problematicQueries) {
    await createOptimizationSuggestion({
      type: 'query',
      priority: query.avg_execution_time_ms > 5000 ? 'critical' : 
               query.avg_execution_time_ms > 2000 ? 'high' : 'medium',
      title: `Optimize slow query pattern in ${query.service_name}`,
      description: `Query pattern executing in ${Math.round(query.avg_execution_time_ms)}ms on average with ${query.total_executions} total executions`,
      impact_estimate: `Potential ${Math.round((query.avg_execution_time_ms - 500) / query.avg_execution_time_ms * 100)}% query time reduction`,
      implementation_effort: 'medium',
      affected_tables: extractTablesFromQuery(query.pattern_template),
      affected_services: [query.service_name],
      estimated_improvement: {
        query_time_reduction: `${Math.round((query.avg_execution_time_ms - 500) / query.avg_execution_time_ms * 100)}%`,
        resource_savings: `${Math.round(query.total_executions * (query.avg_execution_time_ms - 500) / 1000 / 60)} minutes/day`
      }
    });
  }
}

async function analyzeIndexUsage(): Promise<void> {
  // This would typically query database statistics tables
  // For now, we'll create a placeholder implementation
  console.log("Analyzing index usage patterns...");
  
  // Simulate finding unused indexes
  const unusedIndexes = [
    {
      database_name: 'ai_crm',
      table_name: 'leads',
      index_name: 'idx_leads_old_status',
      size_mb: 15.2,
      last_used: null,
      impact: 'medium' as const
    }
  ];

  for (const index of unusedIndexes) {
    await createOptimizationSuggestion({
      type: 'index',
      priority: index.impact === 'high' ? 'high' : (index.impact === 'medium' ? 'medium' : 'low'),
      title: `Remove unused index: ${index.index_name}`,
      description: `Index ${index.index_name} on ${index.table_name} appears to be unused and consumes ${index.size_mb}MB of storage`,
      impact_estimate: `${index.size_mb}MB storage savings, reduced write overhead`,
      implementation_effort: 'low',
      sql_statements: [`DROP INDEX IF EXISTS ${index.index_name};`],
      affected_tables: [index.table_name],
      affected_services: [],
      estimated_improvement: {
        resource_savings: `${index.size_mb}MB storage, faster writes`
      }
    });
  }
}

async function suggestMissingIndexes(): Promise<void> {
  // Analyze slow queries to suggest missing indexes
  const missingIndexCandidates = await executeQuery(
    () => performanceDB.rawQueryAll<{
      query_text: string;
      service_name: string;
      avg_execution_time: number;
      frequency: number;
    }>(`
      SELECT 
        query_text, service_name,
        AVG(execution_time_ms) as avg_execution_time,
        COUNT(*) as frequency
      FROM query_performance 
      WHERE timestamp >= NOW() - INTERVAL '7 days'
      AND execution_time_ms > 1000
      AND (
        query_text ILIKE '%WHERE%' 
        OR query_text ILIKE '%JOIN%' 
        OR query_text ILIKE '%ORDER BY%'
      )
      GROUP BY query_text, service_name
      HAVING COUNT(*) > 10
      ORDER BY avg_execution_time DESC, frequency DESC
      LIMIT 20
    `),
    "find missing index candidates"
  );

  for (const candidate of missingIndexCandidates) {
    const indexSuggestions = analyzeQueryForIndexes(candidate.query_text);
    
    for (const suggestion of indexSuggestions) {
      await createOptimizationSuggestion({
        type: 'index',
        priority: candidate.avg_execution_time > 3000 ? 'high' : 'medium',
        title: `Add index for ${candidate.service_name} queries`,
        description: `Frequently executed query (${candidate.frequency} times) could benefit from an index on ${suggestion.columns.join(', ')}`,
        impact_estimate: `Potential ${suggestion.estimated_improvement} query time reduction`,
        implementation_effort: 'low',
        sql_statements: [`CREATE INDEX CONCURRENTLY idx_${suggestion.table}_${suggestion.columns.join('_')} ON ${suggestion.table}(${suggestion.columns.join(', ')});`],
        affected_tables: [suggestion.table],
        affected_services: [candidate.service_name],
        estimated_improvement: {
          query_time_reduction: suggestion.estimated_improvement
        }
      });
    }
  }
}

async function generateHealthReport(): Promise<void> {
  console.log("Generating database health report...");
  
  // This would aggregate all the metrics and create a comprehensive report
  // Store it for later retrieval via API
  const report = {
    generated_at: new Date(),
    overall_score: 85,
    performance_grade: 'B' as const,
    summary: 'Database performance is good with some optimization opportunities'
  };

  await executeQuery(
    () => performanceDB.exec`
      INSERT INTO performance_alerts (
        alert_type, severity, title, description, metrics
      ) VALUES (
        'health_report', 'low', 'Daily Health Report Generated',
        'Database health analysis completed with overall score of ${report.overall_score}',
        ${JSON.stringify(report)}
      )
    `,
    "store health report"
  );
}

async function performMaintenanceCleanup(): Promise<void> {
  console.log("Performing maintenance cleanup...");
  
  // Clean up old performance data (keep last 30 days)
  await executeQuery(
    () => performanceDB.exec`
      DELETE FROM query_performance 
      WHERE timestamp < NOW() - INTERVAL '30 days'
    `,
    "cleanup old query performance data"
  );

  // Clean up resolved alerts older than 7 days
  await executeQuery(
    () => performanceDB.exec`
      DELETE FROM performance_alerts 
      WHERE resolved = TRUE 
      AND resolved_at < NOW() - INTERVAL '7 days'
    `,
    "cleanup old resolved alerts"
  );

  // Update query pattern statistics
  await executeQuery(
    () => performanceDB.exec`
      UPDATE query_patterns 
      SET is_problematic = (
        avg_execution_time_ms > 1000 
        OR slow_query_count > total_executions * 0.1
      )
    `,
    "update problematic pattern flags"
  );
}

async function createOptimizationSuggestion(suggestion: OptimizationSuggestion): Promise<void> {
  await executeQuery(
    () => performanceDB.exec`
      INSERT INTO performance_alerts (
        alert_type, severity, title, description, metrics
      ) VALUES (
        'optimization_suggestion', ${suggestion.priority}, ${suggestion.title},
        ${suggestion.description}, ${JSON.stringify(suggestion)}
      )
    `,
    "create optimization suggestion"
  );
}

function extractTablesFromQuery(queryText: string): string[] {
  const tables: string[] = [];
  const lowerQuery = queryText.toLowerCase();
  
  // Simple table extraction (would be more sophisticated in production)
  const fromMatch = lowerQuery.match(/from\s+(\w+)/);
  if (fromMatch) tables.push(fromMatch[1]);
  
  const joinMatches = lowerQuery.match(/join\s+(\w+)/g);
  if (joinMatches) {
    joinMatches.forEach(match => {
      const table = match.replace(/join\s+/, '');
      if (table && !tables.includes(table)) {
        tables.push(table);
      }
    });
  }
  
  return tables;
}

function analyzeQueryForIndexes(queryText: string): Array<{
  table: string;
  columns: string[];
  estimated_improvement: string;
}> {
  const suggestions: Array<{
    table: string;
    columns: string[];
    estimated_improvement: string;
  }> = [];
  
  const lowerQuery = queryText.toLowerCase();
  
  // Look for WHERE clauses
  const whereMatch = lowerQuery.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/);
  if (whereMatch) {
    const whereClause = whereMatch[1];
    const columnMatches = whereClause.match(/(\w+)\s*[=<>]/g);
    
    if (columnMatches) {
      const columns = columnMatches.map(match => match.replace(/\s*[=<>].*/, ''));
      const table = extractTablesFromQuery(queryText)[0];
      
      if (table && columns.length > 0) {
        suggestions.push({
          table,
          columns,
          estimated_improvement: '60-80%'
        });
      }
    }
  }
  
  // Look for ORDER BY clauses
  const orderByMatch = lowerQuery.match(/order\s+by\s+(.+?)(?:\s+limit|$)/);
  if (orderByMatch) {
    const orderByClause = orderByMatch[1];
    const columns = orderByClause.split(',').map(col => col.trim().split(' ')[0]);
    const table = extractTablesFromQuery(queryText)[0];
    
    if (table && columns.length > 0) {
      suggestions.push({
        table,
        columns,
        estimated_improvement: '40-60%'
      });
    }
  }
  
  return suggestions;
}

export const getIndexAnalysis = api<IndexAnalysisRequest, IndexAnalysisResponse>(
  { expose: true, method: "GET", path: "/db-performance/indexes" },
  wrapAsync(async (req) => {
    // This would query actual database statistics in production
    // For now, return mock data
    return {
      total_indexes: 45,
      unused_indexes: [
        {
          database_name: 'ai_crm',
          table_name: 'leads',
          index_name: 'idx_leads_old_status',
          size_mb: 15.2,
          last_used: undefined,
          impact: 'medium'
        }
      ],
      inefficient_indexes: [
        {
          database_name: 'nuscan',
          table_name: 'prospects',
          index_name: 'idx_prospects_partial',
          efficiency_score: 32.5,
          usage_pattern: 'Low selectivity',
          recommendations: [
            'Consider adding additional columns to improve selectivity',
            'Review if this index can be combined with others'
          ]
        }
      ],
      missing_indexes: [
        {
          table_name: 'email_campaigns',
          suggested_columns: ['prospect_id', 'sent_at'],
          query_pattern: 'Frequent date range queries on prospect campaigns',
          frequency: 1250,
          estimated_improvement: '70% query time reduction'
        }
      ]
    };
  })
);

export const optimizeQuery = api<QueryOptimizationRequest, QueryOptimizationResponse>(
  { expose: true, method: "POST", path: "/db-performance/optimize-query" },
  wrapAsync(async (req) => {
    validateField(req.query_text, "query_text", [Rules.required(), Rules.minLength(10)]);
    
    const suggestions = analyzeQueryForOptimization(req.query_text);
    
    return {
      original_query: req.query_text,
      optimization_suggestions: suggestions.map(s => ({
        type: s.type,
        suggestion: s.suggestion,
        optimized_query: s.optimized_query,
        explanation: s.explanation,
        estimated_improvement: s.estimated_improvement
      })),
      execution_plan_analysis: {
        bottlenecks: ['Sequential scan on large table', 'Missing index on join condition'],
        recommendations: ['Add composite index', 'Consider query rewrite'],
        complexity_score: 7.5
      },
      caching_recommendations: [
        {
          cache_type: 'query',
          ttl_suggestion: '5 minutes',
          implementation_notes: 'Cache at application level for frequently accessed data'
        }
      ]
    };
  })
);

function analyzeQueryForOptimization(queryText: string): Array<{
  type: 'rewrite' | 'index' | 'structure';
  suggestion: string;
  optimized_query?: string;
  explanation: string;
  estimated_improvement: string;
}> {
  const suggestions = [];
  const lowerQuery = queryText.toLowerCase();
  
  // Check for SELECT *
  if (lowerQuery.includes('select *')) {
    suggestions.push({
      type: 'rewrite' as const,
      suggestion: 'Specify only required columns instead of SELECT *',
      optimized_query: queryText.replace(/select\s+\*/i, 'SELECT column1, column2, column3'),
      explanation: 'Selecting only needed columns reduces network traffic and memory usage',
      estimated_improvement: '20-40% faster'
    });
  }
  
  // Check for inefficient LIKE patterns
  if (lowerQuery.includes("like '%") && lowerQuery.includes("%'")) {
    suggestions.push({
      type: 'index' as const,
      suggestion: 'Consider full-text search index for wildcard searches',
      explanation: 'Leading wildcard LIKE queries cannot use regular indexes efficiently',
      estimated_improvement: '60-80% faster'
    });
  }
  
  // Check for ORDER BY without LIMIT
  if (lowerQuery.includes('order by') && !lowerQuery.includes('limit')) {
    suggestions.push({
      type: 'structure' as const,
      suggestion: 'Add LIMIT clause to ORDER BY queries when possible',
      explanation: 'Sorting large result sets is expensive without limiting results',
      estimated_improvement: '30-50% faster'
    });
  }
  
  return suggestions;
}

export const getDatabaseHealthReport = api<{}, DatabaseHealthReport>(
  { expose: true, method: "GET", path: "/db-performance/health" },
  wrapAsync(async () => {
    // Get recent performance metrics
    const recentMetrics = await executeQuery(
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
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `),
      "get recent metrics"
    );

    // Get connection efficiency
    const connectionMetrics = await executeQuery(
      () => performanceDB.rawQueryRow<{
        avg_utilization: number;
      }>(`
        SELECT AVG(connection_utilization) as avg_utilization
        FROM database_connections 
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `),
      "get connection metrics"
    );

    const metrics = {
      avg_query_time: Math.round(recentMetrics?.avg_query_time || 0),
      slow_query_percentage: recentMetrics ? (recentMetrics.slow_query_count / recentMetrics.total_queries) * 100 : 0,
      cache_hit_rate: Math.round(recentMetrics?.cache_hit_rate || 0),
      connection_efficiency: Math.round(connectionMetrics?.avg_utilization || 0),
      index_utilization: 85 // Mock data - would calculate from actual index stats
    };

    // Calculate overall score
    const scores = [
      Math.max(0, 100 - (metrics.avg_query_time / 10)), // Lower query time = higher score
      Math.max(0, 100 - (metrics.slow_query_percentage * 10)), // Fewer slow queries = higher score
      metrics.cache_hit_rate, // Higher cache hit rate = higher score
      Math.max(0, 100 - metrics.connection_efficiency), // Lower utilization = higher score
      metrics.index_utilization // Higher index utilization = higher score
    ];

    const overall_score = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

    const performance_grade = overall_score >= 90 ? 'A' : 
                             overall_score >= 80 ? 'B' : 
                             overall_score >= 70 ? 'C' : 
                             overall_score >= 60 ? 'D' : 'F';

    // Get optimization suggestions from recent alerts
    const suggestions = await executeQuery(
      () => performanceDB.rawQueryAll<{
        title: string;
        description: string;
        severity: string;
        metrics: string;
      }>(`
        SELECT title, description, severity, metrics
        FROM performance_alerts 
        WHERE alert_type = 'optimization_suggestion'
        AND timestamp >= NOW() - INTERVAL '7 days'
        AND resolved = FALSE
        ORDER BY 
          CASE severity 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            ELSE 4 
          END,
          timestamp DESC
        LIMIT 10
      `),
      "get optimization suggestions"
    );

    const optimization_suggestions: OptimizationSuggestion[] = suggestions.map(s => {
      try {
        const metrics = JSON.parse(s.metrics);
        return {
          type: metrics.type || 'query',
          priority: s.severity as 'low' | 'medium' | 'high' | 'critical',
          title: s.title,
          description: s.description,
          impact_estimate: metrics.impact_estimate || 'Performance improvement expected',
          implementation_effort: metrics.implementation_effort || 'medium',
          affected_tables: metrics.affected_tables || [],
          affected_services: metrics.affected_services || [],
          estimated_improvement: metrics.estimated_improvement || {}
        };
      } catch {
        return {
          type: 'query' as const,
          priority: s.severity as 'low' | 'medium' | 'high' | 'critical',
          title: s.title,
          description: s.description,
          impact_estimate: 'Performance improvement expected',
          implementation_effort: 'medium' as const,
          affected_tables: [],
          affected_services: [],
          estimated_improvement: {}
        };
      }
    });

    return {
      overall_score,
      performance_grade,
      key_metrics: metrics,
      optimization_suggestions,
      urgent_issues: suggestions
        .filter(s => s.severity === 'critical')
        .map(s => s.title),
      maintenance_recommendations: [
        'Review and optimize slow queries weekly',
        'Monitor connection pool utilization',
        'Update table statistics regularly',
        'Consider partitioning for large tables'
      ],
      capacity_forecast: {
        current_utilization: metrics.connection_efficiency,
        projected_growth: '15% over next 3 months',
        capacity_warning_date: metrics.connection_efficiency > 70 ? 
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : undefined
      }
    };
  })
);