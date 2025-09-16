import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import { validateField, Rules } from "../shared/validation";
import { wrapAsync } from "../shared/errors";
import { executeQuery } from "../shared/database";
import type { 
  GetNurturingAnalyticsRequest,
  GetNurturingAnalyticsResponse
} from "./types";

// Get comprehensive nurturing analytics
export const getNurturingAnalytics = api<GetNurturingAnalyticsRequest, GetNurturingAnalyticsResponse>(
  { expose: true, method: "GET", path: "/nurturing/analytics" },
  wrapAsync(async (req) => {
    const dateFrom = req.date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days ago
    const dateTo = req.date_to || new Date();
    
    // Overall metrics
    const overallMetrics = await executeQuery(
      () => nurturingDB.queryRow`
        SELECT 
          COUNT(DISTINCT pse.prospect_id) as total_prospects_nurtured,
          COUNT(DISTINCT pse.sequence_id) as total_sequences_active,
          AVG(CASE WHEN pse.status = 'completed' AND pse.completed_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (pse.completed_at - pse.enrolled_at))/86400 
              END) as avg_time_to_conversion_days,
          COALESCE(
            CAST(COUNT(CASE WHEN pse.status = 'completed' THEN 1 END) AS DECIMAL) / 
            NULLIF(COUNT(*), 0) * 100, 0
          ) as overall_conversion_rate
        FROM prospect_sequence_enrollments pse
        WHERE pse.enrolled_at BETWEEN ${dateFrom} AND ${dateTo}
      `,
      "get overall metrics"
    );
    
    // Classification breakdown
    const classificationBreakdown = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          pc.classification,
          COUNT(DISTINCT pse.prospect_id) as count,
          AVG(pse.total_engagement_score) as avg_engagement_score,
          COALESCE(
            CAST(COUNT(CASE WHEN pse.status = 'completed' THEN 1 END) AS DECIMAL) / 
            NULLIF(COUNT(*), 0) * 100, 0
          ) as conversion_rate
        FROM prospect_sequence_enrollments pse
        JOIN prospect_classifications pc ON pse.prospect_id = pc.prospect_id
        WHERE pse.enrolled_at BETWEEN ${dateFrom} AND ${dateTo}
        GROUP BY pc.classification
        ORDER BY count DESC
      `,
      "get classification breakdown"
    );
    
    // Funnel stage distribution
    const funnelStageDistribution = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          pc.funnel_stage,
          COUNT(DISTINCT pse.prospect_id) as count,
          AVG(pc.estimated_close_probability) as avg_close_probability
        FROM prospect_sequence_enrollments pse
        JOIN prospect_classifications pc ON pse.prospect_id = pc.prospect_id
        WHERE pse.enrolled_at BETWEEN ${dateFrom} AND ${dateTo}
        GROUP BY pc.funnel_stage
        ORDER BY 
          CASE pc.funnel_stage 
            WHEN 'awareness' THEN 1
            WHEN 'interest' THEN 2
            WHEN 'consideration' THEN 3
            WHEN 'intent' THEN 4
            WHEN 'decision' THEN 5
            WHEN 'retention' THEN 6
            ELSE 7
          END
      `,
      "get funnel stage distribution"
    );
    
    // Top performing sequences
    const topPerformingSequences = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          ns.id,
          ns.name,
          ns.target_classification,
          ns.target_funnel_stage,
          COUNT(pse.*) as total_enrollments,
          COUNT(CASE WHEN pse.status = 'completed' THEN 1 END) as completions,
          ns.conversion_rate,
          ns.avg_engagement_rate,
          AVG(pse.total_engagement_score) as current_avg_engagement
        FROM nurturing_sequences ns
        LEFT JOIN prospect_sequence_enrollments pse ON ns.id = pse.sequence_id 
          AND pse.enrolled_at BETWEEN ${dateFrom} AND ${dateTo}
        WHERE ns.status = 'active'
        GROUP BY ns.id, ns.name, ns.target_classification, ns.target_funnel_stage, 
                 ns.conversion_rate, ns.avg_engagement_rate
        ORDER BY ns.conversion_rate DESC, current_avg_engagement DESC
        LIMIT 10
      `,
      "get top performing sequences"
    );
    
    // AI optimization metrics
    const aiOptimizationMetrics = await executeQuery(
      () => nurturingDB.queryRow`
        SELECT 
          COUNT(CASE WHEN ai_generated = true THEN 1 END) as ai_generated_content_count,
          AVG(CASE WHEN ai_generated = true THEN performance_score END) as ai_content_avg_performance,
          AVG(CASE WHEN ai_generated = false THEN performance_score END) as manual_content_avg_performance,
          COUNT(DISTINCT acg.prospect_id) as prospects_with_ai_content,
          AVG(acg.quality_score) as avg_ai_quality_score,
          AVG(acg.relevance_score) as avg_ai_relevance_score,
          AVG(acg.generation_time_ms) as avg_generation_time_ms
        FROM content_variations cv
        LEFT JOIN ai_content_generations acg ON cv.sequence_step_id::text = acg.sequence_step_id::text
        WHERE cv.created_at BETWEEN ${dateFrom} AND ${dateTo}
           OR acg.created_at BETWEEN ${dateFrom} AND ${dateTo}
      `,
      "get AI optimization metrics"
    );
    
    // Revenue impact calculation
    const revenueImpact = await executeQuery(
      () => nurturingDB.queryRow`
        SELECT 
          SUM(pc.predicted_revenue) as total_predicted_revenue,
          AVG(pc.predicted_revenue) as avg_predicted_revenue,
          SUM(CASE WHEN pse.status = 'completed' THEN pc.predicted_revenue ELSE 0 END) as realized_revenue_estimate
        FROM prospect_classifications pc
        JOIN prospect_sequence_enrollments pse ON pc.prospect_id = pse.prospect_id
        WHERE pse.enrolled_at BETWEEN ${dateFrom} AND ${dateTo}
      `,
      "get revenue impact"
    );
    
    // Engagement pattern insights
    const engagementInsights = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          ep.engagement_level,
          COUNT(*) as prospect_count,
          ARRAY_AGG(DISTINCT ep.pattern_type) as common_patterns,
          AVG(ep.frequency_score) as avg_frequency_score,
          AVG(ep.confidence_score) as avg_confidence_score
        FROM engagement_patterns ep
        JOIN prospect_sequence_enrollments pse ON ep.prospect_id = pse.prospect_id
        WHERE pse.enrolled_at BETWEEN ${dateFrom} AND ${dateTo}
        GROUP BY ep.engagement_level
        ORDER BY prospect_count DESC
      `,
      "get engagement insights"
    );
    
    // Format classification breakdown
    const classificationBreakdownFormatted = classificationBreakdown.reduce((acc, item) => {
      acc[item.classification] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    // Format funnel stage distribution
    const funnelStageDistributionFormatted = funnelStageDistribution.reduce((acc, item) => {
      acc[item.funnel_stage] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      period_start: dateFrom,
      period_end: dateTo,
      total_prospects_nurtured: overallMetrics.total_prospects_nurtured || 0,
      total_sequences_active: overallMetrics.total_sequences_active || 0,
      overall_conversion_rate: overallMetrics.overall_conversion_rate || 0,
      avg_time_to_conversion_days: overallMetrics.avg_time_to_conversion_days || 0,
      classification_breakdown: classificationBreakdownFormatted,
      funnel_stage_distribution: funnelStageDistributionFormatted,
      top_performing_sequences: topPerformingSequences,
      ai_optimization_metrics: {
        ai_generated_content_count: aiOptimizationMetrics?.ai_generated_content_count || 0,
        ai_content_performance_vs_manual: {
          ai_avg_performance: aiOptimizationMetrics?.ai_content_avg_performance || 0,
          manual_avg_performance: aiOptimizationMetrics?.manual_content_avg_performance || 0
        },
        prospects_with_ai_content: aiOptimizationMetrics?.prospects_with_ai_content || 0,
        avg_quality_score: aiOptimizationMetrics?.avg_ai_quality_score || 0,
        avg_relevance_score: aiOptimizationMetrics?.avg_ai_relevance_score || 0,
        avg_generation_time_ms: aiOptimizationMetrics?.avg_generation_time_ms || 0,
        engagement_insights: engagementInsights
      },
      revenue_impact: revenueImpact?.realized_revenue_estimate || 0
    };
  })
);

interface BehaviorAnalyticsResponse {
  period_start: Date;
  period_end: Date;
  behavior_distribution: any[];
  engagement_trends: any[];
  peak_activity_hours: any[];
}

// Get behavioral analytics for prospects
export const getBehaviorAnalytics = api<{ date_from?: Date; date_to?: Date }, BehaviorAnalyticsResponse>(
  { expose: true, method: "GET", path: "/nurturing/behavior-analytics" },
  wrapAsync(async (req) => {
    const dateFrom = req.date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = req.date_to || new Date();
    
    // Behavior type distribution
    const behaviorDistribution = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          behavior_type,
          COUNT(*) as count,
          AVG(engagement_score) as avg_engagement_score,
          COUNT(DISTINCT prospect_id) as unique_prospects
        FROM prospect_behaviors
        WHERE timestamp BETWEEN ${dateFrom} AND ${dateTo}
        GROUP BY behavior_type
        ORDER BY count DESC
      `,
      "get behavior distribution"
    );
    
    // Engagement trends over time
    const engagementTrends = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          DATE_TRUNC('day', timestamp) as date,
          behavior_type,
          COUNT(*) as behavior_count,
          AVG(engagement_score) as avg_engagement_score
        FROM prospect_behaviors
        WHERE timestamp BETWEEN ${dateFrom} AND ${dateTo}
        GROUP BY DATE_TRUNC('day', timestamp), behavior_type
        ORDER BY date, behavior_type
      `,
      "get engagement trends"
    );
    
    // Peak activity hours
    const peakHours = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          EXTRACT(HOUR FROM timestamp) as hour,
          COUNT(*) as activity_count,
          AVG(engagement_score) as avg_engagement_score
        FROM prospect_behaviors
        WHERE timestamp BETWEEN ${dateFrom} AND ${dateTo}
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY hour
      `,
      "get peak hours"
    );
    
    return {
      period_start: dateFrom,
      period_end: dateTo,
      behavior_distribution: behaviorDistribution,
      engagement_trends: engagementTrends,
      peak_activity_hours: peakHours
    };
  })
);

interface OptimizationRecommendationsResponse {
  sequence_recommendations: any[];
  global_recommendations: string[];
  generated_at: Date;
}

// Get sequence optimization recommendations
export const getOptimizationRecommendations = api<{ sequence_id?: string }, OptimizationRecommendationsResponse>(
  { expose: true, method: "GET", path: "/nurturing/optimization-recommendations" },
  wrapAsync(async (req) => {
    const recommendations: any[] = [];
    
    // Get sequences with low performance
    const lowPerformingSequences = await executeQuery(
      () => nurturingDB.queryAll`
        SELECT 
          ns.*,
          COUNT(pse.*) as enrollment_count,
          AVG(pse.total_engagement_score) as avg_engagement
        FROM nurturing_sequences ns
        LEFT JOIN prospect_sequence_enrollments pse ON ns.id = pse.sequence_id
        WHERE ns.status = 'active' 
        AND (${req.sequence_id ? `ns.id = ${req.sequence_id}` : 'true'})
        GROUP BY ns.id
        HAVING COUNT(pse.*) > 10 AND ns.conversion_rate < 20
        ORDER BY ns.conversion_rate ASC
      `,
      "get low performing sequences"
    );
    
    for (const sequence of lowPerformingSequences) {
      // Analyze step performance
      const stepPerformance = await executeQuery(
        () => nurturingDB.queryAll`
          SELECT 
            ss.step_number,
            ss.name,
            ss.step_type,
            COUNT(sse.*) as executions,
            COUNT(CASE WHEN sse.status = 'failed' THEN 1 END) as failures,
            AVG(CASE WHEN sse.engagement_metrics->>'engagement_score' IS NOT NULL 
                THEN CAST(sse.engagement_metrics->>'engagement_score' AS DECIMAL) END) as avg_engagement
          FROM sequence_steps ss
          LEFT JOIN sequence_step_executions sse ON ss.id = sse.step_id
          WHERE ss.sequence_id = ${sequence.id}
          GROUP BY ss.id, ss.step_number, ss.name, ss.step_type
          ORDER BY ss.step_number
        `,
        "get step performance"
      );
      
      const sequenceRecommendations: string[] = [];
      
      // Check for high failure rates
      const highFailureSteps = stepPerformance.filter(step => 
        step.executions > 0 && (step.failures / step.executions) > 0.2
      );
      
      if (highFailureSteps.length > 0) {
        sequenceRecommendations.push(
          `Steps ${highFailureSteps.map(s => s.step_number).join(', ')} have high failure rates. Consider simplifying content or adjusting timing.`
        );
      }
      
      // Check for low engagement steps
      const lowEngagementSteps = stepPerformance.filter(step => 
        step.avg_engagement && step.avg_engagement < 3
      );
      
      if (lowEngagementSteps.length > 0) {
        sequenceRecommendations.push(
          `Steps ${lowEngagementSteps.map(s => s.step_number).join(', ')} have low engagement. Consider A/B testing different content variants.`
        );
      }
      
      // Check sequence length
      if (stepPerformance.length > 8) {
        sequenceRecommendations.push(
          "Sequence is quite long. Consider shortening or adding more conditional branching to maintain relevance."
        );
      }
      
      // Check for missing AI optimization
      if (!sequence.ai_optimization_enabled) {
        sequenceRecommendations.push(
          "Enable AI optimization to automatically improve content based on prospect behavior."
        );
      }
      
      recommendations.push({
        sequence_id: sequence.id,
        sequence_name: sequence.name,
        current_conversion_rate: sequence.conversion_rate,
        enrollment_count: sequence.enrollment_count,
        avg_engagement: sequence.avg_engagement,
        recommendations: sequenceRecommendations,
        priority: sequence.conversion_rate < 10 ? 'high' : 'medium'
      });
    }
    
    // Global recommendations
    const globalRecommendations = await generateGlobalRecommendations();
    
    return {
      sequence_recommendations: recommendations,
      global_recommendations: globalRecommendations,
      generated_at: new Date()
    };
  })
);

async function generateGlobalRecommendations(): Promise<string[]> {
  const recommendations: string[] = [];
  
  // Check for prospects that haven't been classified recently
  const unclassifiedCount = await nurturingDB.queryRow`
    SELECT COUNT(*) as count
    FROM prospect_sequence_enrollments pse
    LEFT JOIN prospect_classifications pc ON pse.prospect_id = pc.prospect_id
    WHERE pc.id IS NULL OR pc.classification_expires_at < NOW()
  `;
  
  if ((unclassifiedCount?.count || 0) > 0) {
    recommendations.push(
      `${unclassifiedCount?.count} prospects need behavior analysis and classification updates.`
    );
  }
  
  // Check for inactive sequences
  const inactiveSequences = await nurturingDB.queryRow`
    SELECT COUNT(*) as count
    FROM nurturing_sequences 
    WHERE status = 'active' 
    AND id NOT IN (
      SELECT DISTINCT sequence_id 
      FROM prospect_sequence_enrollments 
      WHERE enrolled_at > NOW() - INTERVAL '30 days'
    )
  `;
  
  if ((inactiveSequences?.count || 0) > 0) {
    recommendations.push(
      `${inactiveSequences?.count} active sequences haven't had new enrollments in 30 days. Consider reviewing targeting criteria.`
    );
  }
  
  // Check content variation performance
  const contentVariationInsights = await nurturingDB.queryRow`
    SELECT 
      COUNT(CASE WHEN ai_generated = true THEN 1 END) as ai_count,
      COUNT(CASE WHEN ai_generated = false THEN 1 END) as manual_count,
      AVG(CASE WHEN ai_generated = true THEN performance_score END) as ai_performance,
      AVG(CASE WHEN ai_generated = false THEN performance_score END) as manual_performance
    FROM content_variations
    WHERE is_active = true
  `;
  
  if (contentVariationInsights && contentVariationInsights.ai_performance > contentVariationInsights.manual_performance * 1.1) {
    recommendations.push(
      "AI-generated content is performing significantly better than manual content. Consider enabling AI optimization for more sequences."
    );
  }
  
  return recommendations;
}