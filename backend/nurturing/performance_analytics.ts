import { api } from "encore.dev/api";
import { nurturingDB } from "./db";
import * as ai from "../ai/openai";

// Advanced analytics and ROI tracking
export const getAdvancedAnalytics = api(
  { method: "GET", path: "/analytics/advanced/:client_id", expose: true },
  async ({ client_id }: { client_id: number }) => {
    // Get comprehensive performance metrics
    const overallMetricsResults = await nurturingDB.query`
      SELECT 
        COUNT(DISTINCT ns.id) as total_sequences,
        COUNT(DISTINCT se.id) as total_enrollments,
        COUNT(CASE WHEN se.status = 'active' THEN 1 END) as active_enrollments,
        COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completed_enrollments,
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) as total_conversions,
        AVG(nc.engagement_score) as avg_engagement_score,
        COUNT(nc.opened_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as overall_open_rate,
        COUNT(nc.clicked_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as overall_click_rate,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as overall_conversion_rate
      FROM nurturing_sequences ns
      LEFT JOIN sequence_enrollments se ON ns.id = se.sequence_id
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE ns.client_id = ${client_id}
    `;
    const overallMetricsArray = [];
    for await (const row of overallMetricsResults) {
      overallMetricsArray.push(row);
    }
    const overallMetrics = overallMetricsArray[0];

    // Sequence performance breakdown
    const sequenceBreakdown = [];
    for await (const row of nurturingDB.query`
      SELECT 
        ns.id,
        ns.name,
        ns.classification_target,
        ns.stage_target,
        ns.created_by_ai,
        COUNT(se.id) as enrollments,
        COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completions,
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) as conversions,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.opened_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as open_rate,
        COUNT(nc.clicked_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as click_rate,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as conversion_rate,
        AVG(EXTRACT(EPOCH FROM (se.updated_at - se.enrolled_at))/86400) as avg_duration_days
      FROM nurturing_sequences ns
      LEFT JOIN sequence_enrollments se ON ns.id = se.sequence_id
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE ns.client_id = ${client_id}
      GROUP BY ns.id, ns.name, ns.classification_target, ns.stage_target, ns.created_by_ai
      HAVING COUNT(se.id) > 0
      ORDER BY conversion_rate DESC
    `) {
      sequenceBreakdown.push(row);
    }

    // Time-based performance trends
    const performanceTrends = await nurturingDB.query`
      SELECT 
        DATE_TRUNC('week', se.enrolled_at) as week,
        COUNT(se.id) as enrollments,
        COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completions,
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) as conversions,
        AVG(nc.engagement_score) as avg_engagement
      FROM sequence_enrollments se
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE se.client_id = ${client_id}
        AND se.enrolled_at >= CURRENT_DATE - INTERVAL '12 weeks'
      GROUP BY DATE_TRUNC('week', se.enrolled_at)
      ORDER BY week ASC
    `;

    // Classification and stage performance
    const classificationPerformance = await nurturingDB.query`
      SELECT 
        ns.classification_target,
        ns.stage_target,
        COUNT(se.id) as enrollments,
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) as conversions,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as conversion_rate
      FROM nurturing_sequences ns
      LEFT JOIN sequence_enrollments se ON ns.id = se.sequence_id
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE ns.client_id = ${client_id}
      GROUP BY ns.classification_target, ns.stage_target
      HAVING COUNT(se.id) > 0
      ORDER BY conversion_rate DESC
    `;

    // AI vs Manual sequence performance
    const aiVsManualPerformance = await nurturingDB.query`
      SELECT 
        ns.created_by_ai,
        COUNT(se.id) as enrollments,
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) as conversions,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as conversion_rate
      FROM nurturing_sequences ns
      LEFT JOIN sequence_enrollments se ON ns.id = se.sequence_id
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE ns.client_id = ${client_id}
      GROUP BY ns.created_by_ai
      HAVING COUNT(se.id) > 0
    `;

    return {
      overall_metrics: overallMetrics,
      sequence_breakdown: sequenceBreakdown,
      performance_trends: performanceTrends,
      classification_performance: classificationPerformance,
      ai_vs_manual: aiVsManualPerformance
    };
  }
);

// ROI calculation and tracking
export const calculateROI = api(
  { method: "GET", path: "/analytics/roi/:client_id", expose: true },
  async ({ client_id, period_days = 30 }: { client_id: number; period_days?: number }) => {
    // Get conversion data for the period
    const conversionDataQuery = await nurturingDB.query`
      SELECT 
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) as conversions,
        COUNT(se.id) as total_enrollments,
        COUNT(nc.id) as total_communications,
        AVG(nc.engagement_score) as avg_engagement
      FROM sequence_enrollments se
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      LEFT JOIN nurturing_sequences ns ON se.sequence_id = ns.id
      WHERE ns.client_id = ${client_id}
        AND se.enrolled_at >= CURRENT_DATE - INTERVAL '${period_days} days'
    `;
    
    const conversionDataArray = [];
    for await (const row of conversionDataQuery) {
      conversionDataArray.push(row);
    }
    const conversionData = conversionDataArray[0];

    // Estimated costs (these would typically come from actual cost data)
    const estimatedCosts = {
      cost_per_email: 0.10, // $0.10 per email
      cost_per_prospect: 2.00, // $2.00 per prospect data
      ai_generation_cost: 0.05, // $0.05 per AI generation
      platform_cost_per_month: 199.00 // Platform subscription
    };

    const totalCommunications = conversionData?.total_communications || 0;
    const totalEnrollments = conversionData?.total_enrollments || 0;
    const conversions = conversionData?.conversions || 0;

    // Calculate costs
    const emailCosts = totalCommunications * estimatedCosts.cost_per_email;
    const prospectCosts = totalEnrollments * estimatedCosts.cost_per_prospect;
    const platformCosts = (period_days / 30) * estimatedCosts.platform_cost_per_month;
    const totalCosts = emailCosts + prospectCosts + platformCosts;

    // Estimated revenue (this would come from actual deal values)
    const avgDealValue = 5000; // $5,000 average deal value
    const conversionToSale = 0.25; // 25% of replies convert to sales
    const estimatedRevenue = conversions * conversionToSale * avgDealValue;

    const roi = totalCosts > 0 ? ((estimatedRevenue - totalCosts) / totalCosts) * 100 : 0;
    const costPerConversion = conversions > 0 ? totalCosts / conversions : 0;
    const revenuePerConversion = conversions > 0 ? estimatedRevenue / conversions : 0;

    return {
      period_days,
      metrics: {
        total_enrollments: totalEnrollments,
        total_communications: totalCommunications,
        conversions,
        conversion_rate: totalEnrollments > 0 ? (conversions / totalEnrollments) * 100 : 0
      },
      costs: {
        email_costs: emailCosts,
        prospect_costs: prospectCosts,
        platform_costs: platformCosts,
        total_costs: totalCosts
      },
      revenue: {
        estimated_revenue: estimatedRevenue,
        avg_deal_value: avgDealValue,
        conversion_to_sale: conversionToSale
      },
      roi_metrics: {
        roi_percentage: roi,
        cost_per_conversion: costPerConversion,
        revenue_per_conversion: revenuePerConversion,
        payback_period_days: estimatedRevenue > 0 ? (totalCosts / estimatedRevenue) * period_days : null
      }
    };
  }
);

// Step-by-step funnel analysis
export const getFunnelAnalysis = api(
  { method: "GET", path: "/analytics/funnel/:sequence_id", expose: true },
  async ({ sequence_id }: { sequence_id: number }) => {
    // Get step performance data
    const stepPerformance = await nurturingDB.query`
      SELECT 
        ss.step_number,
        ss.content_type,
        ss.delay_days,
        COUNT(nc.id) as total_sent,
        COUNT(nc.opened_at) as opened,
        COUNT(nc.clicked_at) as clicked,
        COUNT(nc.replied_at) as replied,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.opened_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as open_rate,
        COUNT(nc.clicked_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as click_rate,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as reply_rate
      FROM sequence_steps ss
      LEFT JOIN nurturing_communications nc ON ss.id = nc.step_id
      WHERE ss.sequence_id = ${sequence_id}
      GROUP BY ss.id, ss.step_number, ss.content_type, ss.delay_days
      ORDER BY ss.step_number
    `;

    // Collect step performance results into array
    const stepPerformanceArray: any[] = [];
    for await (const row of stepPerformance) {
      stepPerformanceArray.push(row);
    }

    // Calculate drop-off rates between steps
    const funnelData = stepPerformanceArray.map((step, index) => {
      const prevStep = stepPerformanceArray[index - 1];
      const dropOffRate = prevStep ? 
        ((prevStep.total_sent - step.total_sent) / prevStep.total_sent) * 100 : 0;
      
      return {
        ...step,
        drop_off_rate: dropOffRate,
        cumulative_sent: step.total_sent,
        step_effectiveness: step.total_sent > 0 ? 
          (step.opened + step.clicked + step.replied) / step.total_sent : 0
      };
    });

    // Overall funnel metrics
    const overallMetricsQuery = await nurturingDB.query`
      SELECT 
        COUNT(DISTINCT se.id) as total_enrollments,
        COUNT(CASE WHEN se.current_step > 1 THEN 1 END) as reached_step_2,
        COUNT(CASE WHEN se.current_step > 2 THEN 1 END) as reached_step_3,
        COUNT(CASE WHEN se.status = 'completed' THEN 1 END) as completed_sequence,
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) as total_conversions
      FROM sequence_enrollments se
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE se.sequence_id = ${sequence_id}
    `;
    
    const overallMetricsArray = [];
    for await (const row of overallMetricsQuery) {
      overallMetricsArray.push(row);
    }
    const overallMetrics = overallMetricsArray[0];

    return {
      sequence_id,
      step_performance: funnelData,
      overall_metrics: overallMetrics,
      insights: generateFunnelInsights(funnelData, overallMetrics)
    };
  }
);

// Engagement heat map analysis
export const getEngagementHeatMap = api(
  { method: "GET", path: "/analytics/heatmap/:client_id", expose: true },
  async ({ client_id }: { client_id: number }) => {
    // Time-based engagement patterns
    const timePatternsQuery = await nurturingDB.query`
      SELECT 
        EXTRACT(HOUR FROM nc.sent_at) as hour_of_day,
        EXTRACT(DOW FROM nc.sent_at) as day_of_week,
        COUNT(nc.id) as total_sent,
        COUNT(nc.opened_at) as opened,
        COUNT(nc.clicked_at) as clicked,
        COUNT(nc.replied_at) as replied,
        AVG(nc.engagement_score) as avg_engagement
      FROM nurturing_communications nc
      JOIN sequence_enrollments se ON nc.enrollment_id = se.id
      JOIN nurturing_sequences ns ON se.sequence_id = ns.id
      WHERE ns.client_id = ${client_id}
        AND nc.sent_at >= CURRENT_DATE - INTERVAL '60 days'
      GROUP BY EXTRACT(HOUR FROM nc.sent_at), EXTRACT(DOW FROM nc.sent_at)
      ORDER BY day_of_week, hour_of_day
    `;
    
    const timePatterns = [];
    for await (const row of timePatternsQuery) {
      timePatterns.push(row);
    }

    // Content type performance
    const contentTypePerformanceQuery = await nurturingDB.query`
      SELECT 
        ss.content_type,
        COUNT(nc.id) as total_sent,
        COUNT(nc.opened_at) as opened,
        COUNT(nc.clicked_at) as clicked,
        COUNT(nc.replied_at) as replied,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as conversion_rate
      FROM sequence_steps ss
      JOIN nurturing_communications nc ON ss.id = nc.step_id
      JOIN sequence_enrollments se ON nc.enrollment_id = se.id
      JOIN nurturing_sequences ns ON se.sequence_id = ns.id
      WHERE ns.client_id = ${client_id}
      GROUP BY ss.content_type
      ORDER BY conversion_rate DESC
    `;
    
    const contentTypePerformance = [];
    for await (const row of contentTypePerformanceQuery) {
      contentTypePerformance.push(row);
    }

    // Engagement by prospect classification
    const classificationEngagementQuery = await nurturingDB.query`
      SELECT 
        ns.classification_target,
        COUNT(nc.id) as total_communications,
        AVG(nc.engagement_score) as avg_engagement,
        COUNT(nc.opened_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as open_rate,
        COUNT(nc.replied_at) * 100.0 / NULLIF(COUNT(nc.id), 0) as reply_rate
      FROM nurturing_sequences ns
      JOIN sequence_enrollments se ON ns.id = se.sequence_id
      JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE ns.client_id = ${client_id}
      GROUP BY ns.classification_target
      ORDER BY avg_engagement DESC
    `;
    
    const classificationEngagement = [];
    for await (const row of classificationEngagementQuery) {
      classificationEngagement.push(row);
    }

    return {
      time_patterns: timePatterns,
      content_type_performance: contentTypePerformance,
      classification_engagement: classificationEngagement,
      optimal_times: findOptimalTimes(timePatterns)
    };
  }
);

// AI-powered performance insights
export const getAIInsights = api(
  { method: "POST", path: "/analytics/ai-insights", expose: true },
  async (req: { client_id: number; focus_area?: string }) => {
    // Get comprehensive data for AI analysis
    const analyticsData = await getAdvancedAnalytics({ client_id: req.client_id });
    const roiData = await calculateROI({ client_id: req.client_id, period_days: 30 });
    const heatMapData = await getEngagementHeatMap({ client_id: req.client_id });

    // Create AI prompt for insights
    const prompt = `
You are an expert sales and marketing analyst. Analyze this nurturing system performance data and provide actionable insights.

Overall Performance:
${JSON.stringify(analyticsData.overall_metrics, null, 2)}

ROI Analysis:
${JSON.stringify(roiData, null, 2)}

Top Performing Sequences:
${JSON.stringify(analyticsData.sequence_breakdown.slice(0, 5), null, 2)}

Classification Performance:
${JSON.stringify(analyticsData.classification_performance, null, 2)}

AI vs Manual Performance:
${JSON.stringify(analyticsData.ai_vs_manual, null, 2)}

Engagement Patterns:
${JSON.stringify(heatMapData.optimal_times, null, 2)}

${req.focus_area ? `Focus specifically on: ${req.focus_area}` : ''}

Provide insights on:
1. Key performance drivers and bottlenecks
2. Optimization opportunities with highest impact
3. Sequence improvements and recommendations
4. Timing and content optimization suggestions
5. ROI improvement strategies

Format your response as:
KEY_FINDINGS: [top 3-5 key findings]
BOTTLENECKS: [main performance bottlenecks]
OPPORTUNITIES: [optimization opportunities ranked by impact]
RECOMMENDATIONS: [specific actionable recommendations]
NEXT_ACTIONS: [immediate steps to take]
`;

    const aiResponse = await ai.generateText({
      prompt,
      maxTokens: 800,
      temperature: 0.3
    });

    return {
      insights: parseAIInsights(aiResponse.content),
      data_analyzed: {
        analytics_data: analyticsData,
        roi_data: roiData,
        engagement_patterns: heatMapData
      },
      generated_at: new Date()
    };
  }
);

// Generate performance reports
export const generatePerformanceReport = api(
  { method: "POST", path: "/analytics/report", expose: true },
  async (req: {
    client_id: number;
    period_days: number;
    include_sequences?: number[];
    report_type: 'summary' | 'detailed' | 'executive';
  }) => {
    const analyticsData = await getAdvancedAnalytics({ client_id: req.client_id });
    const roiData = await calculateROI({ client_id: req.client_id, period_days: req.period_days });
    
    const report = {
      report_type: req.report_type,
      period: {
        days: req.period_days,
        start_date: new Date(Date.now() - req.period_days * 24 * 60 * 60 * 1000),
        end_date: new Date()
      },
      executive_summary: {
        total_enrollments: analyticsData.overall_metrics?.total_enrollments || 0,
        conversion_rate: analyticsData.overall_metrics?.overall_conversion_rate || 0,
        roi_percentage: roiData.roi_metrics.roi_percentage,
        cost_per_conversion: roiData.roi_metrics.cost_per_conversion
      },
      detailed_metrics: req.report_type === 'detailed' ? analyticsData : null,
      roi_analysis: roiData,
      recommendations: [] // Would be populated by AI analysis
    };

    return report;
  }
);

// Cron job for daily performance calculations
// TODO: Add cron job for daily performance calculations
// This would update sequence performance scores and calculate daily metrics

// Helper functions
async function updateSequencePerformanceScores(): Promise<void> {
  const sequences = await nurturingDB.query`
    SELECT id FROM nurturing_sequences WHERE is_active = true
  `;
  
  for await (const sequence of sequences) {
    const performanceQuery = await nurturingDB.query`
      SELECT 
        COUNT(se.id) as enrollments,
        COUNT(CASE WHEN nc.replied_at IS NOT NULL THEN 1 END) as conversions,
        AVG(nc.engagement_score) as avg_engagement
      FROM sequence_enrollments se
      LEFT JOIN nurturing_communications nc ON se.id = nc.enrollment_id
      WHERE se.sequence_id = ${sequence.id}
        AND se.enrolled_at >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    let performance = null;
    for await (const row of performanceQuery) {
      performance = row;
      break;
    }
    
    const conversionRate = performance && performance.enrollments > 0 ? 
      (performance.conversions / performance.enrollments) * 100 : 0;
    const engagementScore = performance?.avg_engagement || 0;
    
    // Weighted performance score (60% conversion rate, 40% engagement)
    const performanceScore = (conversionRate * 0.6) + (engagementScore * 0.4);
    
    await nurturingDB.exec`
      UPDATE nurturing_sequences 
      SET performance_score = ${performanceScore},
          conversion_rate = ${conversionRate}
      WHERE id = ${sequence.id}
    `;
  }
}

async function calculateDailyMetrics(): Promise<void> {
  // This would calculate and store daily aggregated metrics
  // for faster dashboard loading and historical analysis
  console.log('Calculating daily metrics...');
}

function generateFunnelInsights(funnelData: any[], overallMetrics: any): string[] {
  const insights = [];
  
  // Find biggest drop-off step
  const maxDropOff = funnelData.reduce((max, step) => 
    step.drop_off_rate > max.drop_off_rate ? step : max
  , { drop_off_rate: 0 });
  
  if (maxDropOff.drop_off_rate > 20) {
    insights.push(`Highest drop-off at step ${maxDropOff.step_number} (${maxDropOff.drop_off_rate.toFixed(1)}%)`);
  }
  
  // Find best performing step
  const bestStep = funnelData.reduce((best, step) => 
    step.step_effectiveness > best.step_effectiveness ? step : best
  , { step_effectiveness: 0 });
  
  if (bestStep.step_effectiveness > 0.3) {
    insights.push(`Step ${bestStep.step_number} shows highest engagement (${(bestStep.step_effectiveness * 100).toFixed(1)}%)`);
  }
  
  return insights;
}

function findOptimalTimes(timePatterns: any[]): any {
  // Analyze time patterns to find optimal send times
  const bestHour = timePatterns.reduce((best, pattern) => 
    pattern.avg_engagement > (best.avg_engagement || 0) ? pattern : best
  , {});
  
  const bestDay = timePatterns.reduce((days: Record<string, any>, pattern) => {
    const day = pattern.day_of_week;
    if (!days[day] || pattern.avg_engagement > days[day].avg_engagement) {
      days[day] = pattern;
    }
    return days;
  }, {} as Record<string, any>);
  
  return {
    best_hour: bestHour.hour_of_day,
    best_day: Object.keys(bestDay).reduce((best: string, day: string) => 
      bestDay[day].avg_engagement > (bestDay[best]?.avg_engagement || 0) ? day : best
    , '0'),
    recommendations: [
      `Send emails at ${bestHour.hour_of_day}:00 for best engagement`,
      `Day ${Object.keys(bestDay)[0]} shows highest performance`
    ]
  };
}

function parseAIInsights(content: string): any {
  const sections = content.split('\n');
  const result = {
    key_findings: [] as string[],
    bottlenecks: [] as string[],
    opportunities: [] as string[],
    recommendations: [] as string[],
    next_actions: [] as string[]
  };
  
  let currentSection = '';
  
  for (const line of sections) {
    if (line.startsWith('KEY_FINDINGS:')) {
      currentSection = 'key_findings';
      const text = line.replace('KEY_FINDINGS:', '').trim();
      if (text) result.key_findings.push(text);
    } else if (line.startsWith('BOTTLENECKS:')) {
      currentSection = 'bottlenecks';
      const text = line.replace('BOTTLENECKS:', '').trim();
      if (text) result.bottlenecks.push(text);
    } else if (line.startsWith('OPPORTUNITIES:')) {
      currentSection = 'opportunities';
      const text = line.replace('OPPORTUNITIES:', '').trim();
      if (text) result.opportunities.push(text);
    } else if (line.startsWith('RECOMMENDATIONS:')) {
      currentSection = 'recommendations';
      const text = line.replace('RECOMMENDATIONS:', '').trim();
      if (text) result.recommendations.push(text);
    } else if (line.startsWith('NEXT_ACTIONS:')) {
      currentSection = 'next_actions';
      const text = line.replace('NEXT_ACTIONS:', '').trim();
      if (text) result.next_actions.push(text);
    } else if (line.trim() && currentSection) {
      (result as any)[currentSection].push(line.trim());
    }
  }
  
  return result;
}