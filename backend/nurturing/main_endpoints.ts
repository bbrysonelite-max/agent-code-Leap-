import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { EngagementAnalytics, SequencePerformanceMetrics } from "./types";

// Import all modules
import * as behaviorAnalysis from "./behavior_analysis";
import * as aiContentGenerator from "./ai_content_generator";
import * as sequenceManager from "./sequence_manager";
import * as realtimeTriggers from "./realtime_triggers";

// Re-export all endpoints for easy access
export {
  // Behavior Analysis
  trackBehavior,
  getEngagementProfile,
  getProspectBehaviors,
  analyzeProspectEngagement,
  getEngagementAnalytics
} from "./behavior_analysis";

export {
  // AI Content Generation
  generateAISequence,
  generateStepContent,
  generateContentVariations,
  optimizeSequence
} from "./ai_content_generator";

export {
  // Sequence Management
  createSequence,
  listSequences,
  getSequence,
  enrollProspect,
  getProspectEnrollments,
  updateEnrollmentStatus,
  smartEnrollProspect
} from "./sequence_manager";

export {
  // Real-time Triggers
  processBehaviorTrigger,
  trackEmailInteraction,
  trackWebsiteActivity,
  analyzeAndExecuteTriggers
} from "./realtime_triggers";

// Additional analytics and reporting endpoints
export const getNurturingDashboard = api(
  { method: "GET", path: "/dashboard/:client_id", expose: true },
  async ({ client_id }: { client_id: number }) => {
    // Get overall statistics
    const [stats] = await nurturingDB.query`
      SELECT 
        COUNT(DISTINCT ns.id) as total_sequences,
        COUNT(DISTINCT se.id) as total_enrollments,
        COUNT(CASE WHEN se.status = 'active' THEN 1 END) as active_enrollments,
        COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completed_enrollments,
        AVG(nc.engagement_score) as avg_engagement_score,
        COUNT(nc.opened_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as overall_open_rate,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as overall_reply_rate
      FROM nurturing_sequences ns
      LEFT JOIN sequence_enrollments se ON ns.id = se.sequence_id
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE ns.client_id = ${client_id}
    `;
    
    // Get top performing sequences
    const topSequences = await nurturingDB.query`
      SELECT 
        ns.id,
        ns.name,
        ns.classification_target,
        ns.stage_target,
        COUNT(se.id) as enrollments,
        COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completions,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as reply_rate
      FROM nurturing_sequences ns
      LEFT JOIN sequence_enrollments se ON ns.id = se.sequence_id
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE ns.client_id = ${client_id}
        AND ns.is_active = true
      GROUP BY ns.id, ns.name, ns.classification_target, ns.stage_target
      HAVING COUNT(se.id) > 0
      ORDER BY reply_rate DESC
      LIMIT 5
    `;
    
    // Get recent activity
    const recentActivity = await nurturingDB.query`
      SELECT 
        pb.behavior_type,
        pb.engagement_score,
        pb.created_at,
        'behavior' as activity_type
      FROM prospect_behavior pb
      WHERE pb.client_id = ${client_id}
        AND pb.created_at >= CURRENT_DATE - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        nc.communication_type,
        nc.engagement_score,
        nc.sent_at as created_at,
        'communication' as activity_type
      FROM nurturing_communications nc
      JOIN sequence_enrollments se ON nc.enrollment_id = se.id
      WHERE se.client_id = ${client_id}
        AND nc.sent_at >= CURRENT_DATE - INTERVAL '7 days'
      
      ORDER BY created_at DESC
      LIMIT 20
    `;
    
    // Get engagement trends
    const engagementTrends = await nurturingDB.query`
      SELECT 
        DATE(created_at) as date,
        COUNT(id) as total_behaviors,
        AVG(engagement_score) as avg_score,
        COUNT(DISTINCT prospect_id) as unique_prospects
      FROM prospect_behavior
      WHERE client_id = ${client_id}
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    
    return {
      stats: stats || {},
      top_sequences: topSequences,
      recent_activity: recentActivity,
      engagement_trends: engagementTrends
    };
  }
);

// Get detailed sequence performance metrics
export const getSequencePerformance = api(
  { method: "GET", path: "/sequence/:sequence_id/performance", expose: true },
  async ({ sequence_id }: { sequence_id: number }): Promise<SequencePerformanceMetrics> => {
    // Overall sequence performance
    const [overall] = await nurturingDB.query`
      SELECT 
        COUNT(se.id) as total_enrollments,
        COUNT(CASE WHEN se.status = 'active' THEN 1 END) as active_enrollments,
        COUNT(CASE WHEN se.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(se.id), 0) as completion_rate,
        AVG(nc.engagement_score) as average_engagement_score,
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(nc.id), 0) as conversion_rate
      FROM sequence_enrollments se
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE se.sequence_id = ${sequence_id}
    `;
    
    // Step-by-step performance
    const stepPerformance = await nurturingDB.query`
      SELECT 
        ss.step_number,
        COUNT(nc.id) as total_sent,
        COUNT(nc.opened_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as open_rate,
        COUNT(nc.clicked_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as click_rate,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as reply_rate,
        AVG(nc.engagement_score) as engagement_score
      FROM sequence_steps ss
      LEFT JOIN nurturing_communications nc ON ss.id = nc.step_id
      WHERE ss.sequence_id = ${sequence_id}
      GROUP BY ss.step_number
      ORDER BY ss.step_number
    `;
    
    return {
      sequence_id,
      total_enrollments: overall?.total_enrollments || 0,
      active_enrollments: overall?.active_enrollments || 0,
      completion_rate: overall?.completion_rate || 0,
      average_engagement_score: overall?.average_engagement_score || 0,
      conversion_rate: overall?.conversion_rate || 0,
      step_performance: stepPerformance.map(step => ({
        step_number: step.step_number,
        open_rate: step.open_rate || 0,
        click_rate: step.click_rate || 0,
        reply_rate: step.reply_rate || 0,
        engagement_score: step.engagement_score || 0
      }))
    };
  }
);

// Get A/B testing results
export const getABTestResults = api(
  { method: "GET", path: "/ab-test/:test_id/results", expose: true },
  async ({ test_id }: { test_id: number }) => {
    const [test] = await nurturingDB.query`
      SELECT * FROM sequence_ab_tests WHERE id = ${test_id}
    `;
    
    if (!test) {
      throw new Error("A/B test not found");
    }
    
    // Get performance metrics for each variant
    const results = await nurturingDB.query`
      SELECT 
        'variant_a' as variant,
        COUNT(se.id) as enrollments,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as conversion_rate
      FROM sequence_enrollments se
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE se.sequence_id = ${test.sequence_id}
        AND se.created_at >= ${test.start_date}
        AND (${test.end_date} IS NULL OR se.created_at <= ${test.end_date})
        AND MOD(se.id, 100) < ${test.traffic_split}
      
      UNION ALL
      
      SELECT 
        'variant_b' as variant,
        COUNT(se.id) as enrollments,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as conversion_rate
      FROM sequence_enrollments se
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE se.sequence_id = ${test.sequence_id}
        AND se.created_at >= ${test.start_date}
        AND (${test.end_date} IS NULL OR se.created_at <= ${test.end_date})
        AND MOD(se.id, 100) >= ${test.traffic_split}
    `;
    
    return {
      test,
      results
    };
  }
);

// Bulk operations for managing multiple prospects
export const bulkEnrollProspects = api(
  { method: "POST", path: "/bulk-enroll", expose: true },
  async (req: {
    prospect_ids: number[];
    sequence_id: number;
    client_id: number;
    use_smart_enrollment?: boolean;
  }) => {
    const results = [];
    
    for (const prospectId of req.prospect_ids) {
      try {
        if (req.use_smart_enrollment) {
          const result = await sequenceManager.smartEnrollProspect({
            prospect_id: prospectId,
            client_id: req.client_id
          });
          results.push({ prospect_id: prospectId, success: true, result });
        } else {
          const enrollment = await sequenceManager.enrollProspect({
            prospect_id: prospectId,
            sequence_id: req.sequence_id,
            client_id: req.client_id
          });
          results.push({ prospect_id: prospectId, success: true, enrollment });
        }
      } catch (error) {
        results.push({ 
          prospect_id: prospectId, 
          success: false, 
          error: (error as Error).message 
        });
      }
    }
    
    return {
      total_processed: req.prospect_ids.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
);

// Health check and system status
export const getSystemHealth = api(
  { method: "GET", path: "/health", expose: true },
  async () => {
    try {
      // Check database connectivity
      const [dbCheck] = await nurturingDB.query`SELECT 1 as status`;
      
      // Get system metrics
      const [metrics] = await nurturingDB.query`
        SELECT 
          COUNT(DISTINCT prospect_id) as total_prospects_tracked,
          COUNT(id) as total_behaviors_tracked,
          COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as behaviors_today
        FROM prospect_behavior
      `;
      
      const [sequenceMetrics] = await nurturingDB.query`
        SELECT 
          COUNT(DISTINCT ns.id) as total_sequences,
          COUNT(CASE WHEN se.status = 'active' THEN 1 END) as active_enrollments,
          COUNT(CASE WHEN nc.sent_at >= CURRENT_DATE THEN 1 END) as communications_today
        FROM nurturing_sequences ns
        LEFT JOIN sequence_enrollments se ON ns.id = se.sequence_id
        LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      `;
      
      return {
        status: 'healthy',
        database: dbCheck ? 'connected' : 'error',
        metrics: {
          ...metrics,
          ...sequenceMetrics
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message,
        timestamp: new Date()
      };
    }
  }
);