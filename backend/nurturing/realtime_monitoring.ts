import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync } from "../shared/errors";
import { executeQuery } from "../shared/database";
import { broadcastMessage } from "../realtime/websocket";

// Real-time monitoring and alerting for nurturing performance

interface RealtimeDashboardResponse {
  active_sequences: any[];
  recent_activities: any[];
  performance_alerts: any[];
  engagement_trends: any[];
  prospects_needing_attention: any[];
  last_updated: string;
}

// Get real-time dashboard data
export const getRealtimeDashboard = api<{}, RealtimeDashboardResponse>(
  { expose: true, method: "GET", path: "/nurturing/realtime-dashboard" },
  wrapAsync(async () => {
    // Active sequences overview
    const activeSequences = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          ns.id,
          ns.name,
          ns.target_classification,
          COUNT(pse.id) as active_enrollments,
          AVG(pse.total_engagement_score) as avg_engagement,
          COUNT(CASE WHEN sse.status = 'scheduled' AND sse.scheduled_at <= NOW() + INTERVAL '1 hour' THEN 1 END) as upcoming_executions
        FROM nurturing_sequences ns
        LEFT JOIN prospect_sequence_enrollments pse ON ns.id = pse.sequence_id AND pse.status = 'active'
        LEFT JOIN sequence_step_executions sse ON pse.id = sse.enrollment_id
        WHERE ns.status = 'active'
        GROUP BY ns.id, ns.name, ns.target_classification
        ORDER BY active_enrollments DESC
        LIMIT 10
      `,
      "get active sequences overview"
    );

    // Recent high-value activities
    const recentActivities = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          pb.prospect_id,
          pb.behavior_type,
          pb.engagement_score,
          pb.timestamp,
          pc.classification,
          pc.predicted_revenue
        FROM prospect_behaviors pb
        LEFT JOIN prospect_classifications pc ON pb.prospect_id = pc.prospect_id
        WHERE pb.timestamp > NOW() - INTERVAL '1 hour'
        AND pb.engagement_score >= 5
        ORDER BY pb.timestamp DESC, pb.engagement_score DESC
        LIMIT 20
      `,
      "get recent high-value activities"
    );

    // Sequence performance alerts
    const performanceAlerts = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          ns.id,
          ns.name,
          ns.conversion_rate,
          COUNT(sse.id) as recent_failures
        FROM nurturing_sequences ns
        LEFT JOIN prospect_sequence_enrollments pse ON ns.id = pse.sequence_id
        LEFT JOIN sequence_step_executions sse ON pse.id = sse.enrollment_id 
          AND sse.status = 'failed' 
          AND sse.failed_at > NOW() - INTERVAL '24 hours'
        WHERE ns.status = 'active'
        GROUP BY ns.id, ns.name, ns.conversion_rate
        HAVING COUNT(sse.id) > 5 OR ns.conversion_rate < 10
        ORDER BY recent_failures DESC, ns.conversion_rate ASC
        LIMIT 5
      `,
      "get performance alerts"
    );

    // Engagement trends (last 24 hours)
    const engagementTrends = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          DATE_TRUNC('hour', pb.timestamp) as hour,
          COUNT(*) as total_behaviors,
          AVG(pb.engagement_score) as avg_engagement_score,
          COUNT(DISTINCT pb.prospect_id) as unique_prospects
        FROM prospect_behaviors pb
        WHERE pb.timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', pb.timestamp)
        ORDER BY hour DESC
        LIMIT 24
      `,
      "get engagement trends"
    );

    // Prospects needing attention
    const prospectsNeedingAttention = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          pc.prospect_id,
          pc.classification,
          pc.predicted_revenue,
          pc.estimated_close_probability,
          EXTRACT(EPOCH FROM (NOW() - MAX(pb.timestamp)))/3600 as hours_since_last_activity
        FROM prospect_classifications pc
        LEFT JOIN prospect_behaviors pb ON pc.prospect_id = pb.prospect_id
        WHERE pc.classification IN ('hot', 'warm')
        AND pc.estimated_close_probability > 0.3
        GROUP BY pc.prospect_id, pc.classification, pc.predicted_revenue, pc.estimated_close_probability
        HAVING MAX(pb.timestamp) IS NULL OR MAX(pb.timestamp) < NOW() - INTERVAL '48 hours'
        ORDER BY pc.predicted_revenue DESC, pc.estimated_close_probability DESC
        LIMIT 10
      `,
      "get prospects needing attention"
    );

    return {
      active_sequences: activeSequences,
      recent_activities: recentActivities,
      performance_alerts: performanceAlerts,
      engagement_trends: engagementTrends,
      prospects_needing_attention: prospectsNeedingAttention,
      last_updated: new Date().toISOString()
    };
  })
);

interface ExecutionMonitorResponse {
  upcoming_executions: any[];
  failed_executions: any[];
  execution_stats: any;
  monitoring_timestamp: string;
}

// Monitor sequence execution status
export const monitorSequenceExecution = api<{ sequence_id?: string }, ExecutionMonitorResponse>(
  { expose: true, method: "GET", path: "/nurturing/monitor-execution" },
  wrapAsync(async (req) => {
    const whereClause = req.sequence_id ? `AND ns.id = '${req.sequence_id}'` : '';

    // Scheduled executions in next 24 hours
    const upcomingExecutions = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          sse.id,
          sse.prospect_id,
          sse.scheduled_at,
          sse.status,
          ss.name as step_name,
          ss.step_type,
          ns.name as sequence_name,
          pc.classification,
          pc.predicted_revenue
        FROM sequence_step_executions sse
        JOIN sequence_steps ss ON sse.step_id = ss.id
        JOIN nurturing_sequences ns ON ss.sequence_id = ns.id
        LEFT JOIN prospect_classifications pc ON sse.prospect_id = pc.prospect_id
        WHERE sse.status = 'scheduled' 
        AND sse.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
        ${whereClause}
        ORDER BY sse.scheduled_at ASC
        LIMIT 50
      `,
      "get upcoming executions"
    );

    // Failed executions that need retry
    const failedExecutions = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          sse.id,
          sse.prospect_id,
          sse.failed_at,
          sse.error_message,
          sse.retry_count,
          ss.name as step_name,
          ns.name as sequence_name
        FROM sequence_step_executions sse
        JOIN sequence_steps ss ON sse.step_id = ss.id
        JOIN nurturing_sequences ns ON ss.sequence_id = ns.id
        WHERE sse.status = 'failed' 
        AND sse.retry_count < 3
        AND sse.failed_at > NOW() - INTERVAL '24 hours'
        ${whereClause}
        ORDER BY sse.failed_at DESC
        LIMIT 20
      `,
      "get failed executions"
    );

    // Execution statistics
    const executionStats = await executeQuery(
      () => nurturingDB.queryRow`
        SELECT 
          COUNT(CASE WHEN sse.status = 'scheduled' THEN 1 END) as scheduled_count,
          COUNT(CASE WHEN sse.status = 'sent' THEN 1 END) as sent_count,
          COUNT(CASE WHEN sse.status = 'failed' THEN 1 END) as failed_count,
          COUNT(CASE WHEN sse.executed_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_executions
        FROM sequence_step_executions sse
        JOIN sequence_steps ss ON sse.step_id = ss.id
        JOIN nurturing_sequences ns ON ss.sequence_id = ns.id
        WHERE sse.created_at > NOW() - INTERVAL '7 days'
        ${whereClause}
      `,
      "get execution statistics"
    );

    return {
      upcoming_executions: upcomingExecutions,
      failed_executions: failedExecutions,
      execution_stats: executionStats,
      monitoring_timestamp: new Date().toISOString()
    };
  })
);

interface NurturingAlertsResponse {
  alerts: any[];
  total_alerts: number;
  checked_at: string;
}

// Alert system for critical nurturing events
export const checkNurturingAlerts = api<{}, NurturingAlertsResponse>(
  { expose: true, method: "POST", path: "/nurturing/check-alerts" },
  wrapAsync(async () => {
    const alerts: any[] = [];

    // Check for sequences with high failure rates
    const highFailureSequences = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          ns.id,
          ns.name,
          COUNT(sse.id) as total_executions,
          COUNT(CASE WHEN sse.status = 'failed' THEN 1 END) as failed_executions,
          (COUNT(CASE WHEN sse.status = 'failed' THEN 1 END)::DECIMAL / COUNT(sse.id) * 100) as failure_rate
        FROM nurturing_sequences ns
        JOIN prospect_sequence_enrollments pse ON ns.id = pse.sequence_id
        JOIN sequence_step_executions sse ON pse.id = sse.enrollment_id
        WHERE sse.created_at > NOW() - INTERVAL '24 hours'
        AND ns.status = 'active'
        GROUP BY ns.id, ns.name
        HAVING COUNT(sse.id) > 10 AND (COUNT(CASE WHEN sse.status = 'failed' THEN 1 END)::DECIMAL / COUNT(sse.id) * 100) > 20
        ORDER BY failure_rate DESC
      `,
      "check high failure sequences"
    );

    highFailureSequences.forEach(seq => {
      alerts.push({
        type: 'high_failure_rate',
        severity: 'high',
        sequence_id: seq.id,
        sequence_name: seq.name,
        message: `Sequence "${seq.name}" has ${seq.failure_rate.toFixed(1)}% failure rate`,
        data: seq
      });
    });

    // Check for hot prospects with no recent activity
    const staleHotProspects = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          pc.prospect_id,
          pc.predicted_revenue,
          pc.estimated_close_probability,
          EXTRACT(EPOCH FROM (NOW() - MAX(pb.timestamp)))/3600 as hours_since_activity
        FROM prospect_classifications pc
        LEFT JOIN prospect_behaviors pb ON pc.prospect_id = pb.prospect_id
        WHERE pc.classification = 'hot'
        AND pc.estimated_close_probability > 0.5
        GROUP BY pc.prospect_id, pc.predicted_revenue, pc.estimated_close_probability
        HAVING MAX(pb.timestamp) IS NULL OR MAX(pb.timestamp) < NOW() - INTERVAL '24 hours'
        ORDER BY pc.predicted_revenue DESC
        LIMIT 5
      `,
      "check stale hot prospects"
    );

    staleHotProspects.forEach(prospect => {
      alerts.push({
        type: 'stale_hot_prospect',
        severity: 'medium',
        prospect_id: prospect.prospect_id,
        message: `Hot prospect ${prospect.prospect_id} has no activity for ${Math.floor(prospect.hours_since_activity)} hours`,
        data: prospect
      });
    });

    // Check for sequences with declining performance
    const decliningSequences = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          ns.id,
          ns.name,
          ns.conversion_rate,
          AVG(pse.total_engagement_score) as current_avg_engagement
        FROM nurturing_sequences ns
        LEFT JOIN prospect_sequence_enrollments pse ON ns.id = pse.sequence_id 
          AND pse.enrolled_at > NOW() - INTERVAL '7 days'
        WHERE ns.status = 'active'
        AND ns.conversion_rate < ns.avg_engagement_rate * 0.7  -- 30% decline
        GROUP BY ns.id, ns.name, ns.conversion_rate
        HAVING COUNT(pse.id) > 5
        ORDER BY ns.conversion_rate ASC
        LIMIT 3
      `,
      "check declining sequences"
    );

    decliningSequences.forEach(seq => {
      alerts.push({
        type: 'declining_performance',
        severity: 'medium',
        sequence_id: seq.id,
        sequence_name: seq.name,
        message: `Sequence "${seq.name}" performance declining - ${seq.conversion_rate.toFixed(1)}% conversion rate`,
        data: seq
      });
    });

    // Broadcast alerts if any
    if (alerts.length > 0) {
      await broadcastMessage({
        type: "nurturing_alerts",
        data: {
          alerts,
          timestamp: new Date().toISOString(),
          total_alerts: alerts.length
        },
        timestamp: new Date().toISOString()
      }, "nurturing_alerts");
    }

    return {
      alerts,
      total_alerts: alerts.length,
      checked_at: new Date().toISOString()
    };
  })
);

interface NurturingHealthResponse {
  overall_health_score: number;
  health_scores: Record<string, number>;
  system_metrics: any;
  classification_distribution: any[];
  ai_metrics: any;
  recommendations: string[];
  last_updated: string;
}

// Get nurturing health metrics
export const getNurturingHealth = api<{}, NurturingHealthResponse>(
  { expose: true, method: "GET", path: "/nurturing/health" },
  wrapAsync(async () => {
    // Overall system health
    const systemHealth = await executeQuery(
      () => nurturingDB.queryRow`
        SELECT 
          COUNT(DISTINCT ns.id) as active_sequences,
          COUNT(DISTINCT pse.prospect_id) as prospects_in_nurturing,
          COUNT(CASE WHEN sse.status = 'scheduled' AND sse.scheduled_at <= NOW() THEN 1 END) as overdue_executions,
          COUNT(CASE WHEN sse.status = 'failed' AND sse.failed_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_failures,
          AVG(ns.conversion_rate) as avg_conversion_rate,
          AVG(pse.total_engagement_score) as avg_engagement_score
        FROM nurturing_sequences ns
        LEFT JOIN prospect_sequence_enrollments pse ON ns.id = pse.sequence_id AND pse.status = 'active'
        LEFT JOIN sequence_step_executions sse ON pse.id = sse.enrollment_id
        WHERE ns.status = 'active'
      `,
      "get system health"
    );

    // Classification distribution health
    const classificationHealth = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          classification,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence,
          COUNT(CASE WHEN classification_expires_at < NOW() THEN 1 END) as expired_classifications
        FROM prospect_classifications
        GROUP BY classification
        ORDER BY count DESC
      `,
      "get classification health"
    );

    // AI optimization health
    const aiHealth = await executeQuery(
      () => nurturingDB.queryRow`
        SELECT 
          COUNT(CASE WHEN ai_optimization_enabled = true THEN 1 END) as ai_enabled_sequences,
          COUNT(*) as total_sequences,
          AVG(CASE WHEN ai_optimization_enabled = true THEN conversion_rate END) as ai_avg_conversion,
          AVG(CASE WHEN ai_optimization_enabled = false THEN conversion_rate END) as manual_avg_conversion,
          COUNT(CASE WHEN ai_dynamic_content = true THEN 1 END) as ai_content_steps
        FROM nurturing_sequences ns
        LEFT JOIN sequence_steps ss ON ns.id = ss.sequence_id
        WHERE ns.status = 'active'
      `,
      "get AI health"
    );

    // Calculate health scores
    const healthScores = {
      execution_health: systemHealth.overdue_executions === 0 ? 100 : Math.max(0, 100 - (systemHealth.overdue_executions * 10)),
      performance_health: Math.min(100, (systemHealth.avg_conversion_rate || 0) * 5),
      ai_optimization_health: aiHealth.total_sequences > 0 ? (aiHealth.ai_enabled_sequences / aiHealth.total_sequences) * 100 : 0,
      data_quality_health: classificationHealth.reduce((avg, c) => avg + c.avg_confidence, 0) / classificationHealth.length * 100
    };

    const overallHealth = Object.values(healthScores).reduce((sum, score) => sum + score, 0) / Object.keys(healthScores).length;

    return {
      overall_health_score: overallHealth,
      health_scores: healthScores,
      system_metrics: systemHealth,
      classification_distribution: classificationHealth,
      ai_metrics: aiHealth,
      recommendations: generateHealthRecommendations(healthScores, systemHealth),
      last_updated: new Date().toISOString()
    };
  })
);

function generateHealthRecommendations(healthScores: any, systemMetrics: any): string[] {
  const recommendations: string[] = [];

  if (healthScores.execution_health < 80) {
    recommendations.push("Address overdue sequence executions to improve delivery reliability");
  }

  if (healthScores.performance_health < 60) {
    recommendations.push("Review and optimize underperforming sequences");
  }

  if (healthScores.ai_optimization_health < 50) {
    recommendations.push("Enable AI optimization for more sequences to improve performance");
  }

  if (healthScores.data_quality_health < 70) {
    recommendations.push("Update prospect classifications to improve targeting accuracy");
  }

  if (systemMetrics.recent_failures > 10) {
    recommendations.push("Investigate and resolve recent execution failures");
  }

  if (systemMetrics.avg_engagement_score < 3) {
    recommendations.push("Focus on improving content relevance and personalization");
  }

  return recommendations;
}