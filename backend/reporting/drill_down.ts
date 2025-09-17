import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db } from "./db";
import { 
  DrillDownRequest, 
  DrillDownAnalysis, 
  SavedDrillDown,
  CohortAnalysisConfig,
  CohortAnalysisResult,
  FunnelAnalysisConfig,
  FunnelAnalysisResult,
  ComparisonData,
  TimeSeriesAnalysis
} from "./types";
import { advancedAnalytics } from "./advanced_analytics";

export const performDrillDown = api(
  { method: "POST", path: "/reports/drill-down", auth: true, expose: true },
  async (request: DrillDownRequest): Promise<DrillDownAnalysis> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    // Log drill-down usage for analytics
    await db.queryAll`
      INSERT INTO audit_logs (user_id, action, resource_type, details)
      VALUES (${userID}, 'drill_down_analysis', 'report', ${JSON.stringify({
        metric: request.metric,
        filters: request.filters
      })})
    `;

    return await advancedAnalytics.performDrillDown(request);
  }
);

export const saveDrillDown = api(
  { method: "POST", path: "/reports/drill-down/save", auth: true, expose: true },
  async (request: {
    name: string;
    description?: string;
    base_metric: string;
    filters: any;
  }): Promise<SavedDrillDown> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    const result = await db.queryRow`
      INSERT INTO saved_drill_downs (user_id, name, description, base_metric, filters)
      VALUES (${userID}, ${request.name}, ${request.description || null}, 
              ${request.base_metric}, ${JSON.stringify(request.filters)})
      RETURNING *
    `;

    return {
      ...result,
      filters: JSON.parse(result.filters as string)
    };
  }
);

export const listSavedDrillDowns = api(
  { method: "GET", path: "/reports/drill-down/saved", auth: true, expose: true },
  async (): Promise<{ saved_drill_downs: SavedDrillDown[] }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    const results = await db.queryAll`
      SELECT * FROM saved_drill_downs
      WHERE user_id = ${userID}
      ORDER BY created_at DESC
    `;

    const savedDrillDowns = results.map(row => ({
      ...row,
      filters: JSON.parse(row.filters as string)
    }));

    return { saved_drill_downs: savedDrillDowns };
  }
);

export const performCohortAnalysis = api(
  { method: "POST", path: "/reports/cohort-analysis", auth: true, expose: true },
  async (config: CohortAnalysisConfig): Promise<CohortAnalysisResult> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    // Log cohort analysis usage
    await db.queryAll`
      INSERT INTO audit_logs (user_id, action, resource_type, details)
      VALUES (${userID}, 'cohort_analysis', 'report', ${JSON.stringify(config)})
    `;

    return await advancedAnalytics.performCohortAnalysis(config);
  }
);

export const performFunnelAnalysis = api(
  { method: "POST", path: "/reports/funnel-analysis", auth: true, expose: true },
  async (config: FunnelAnalysisConfig): Promise<FunnelAnalysisResult> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    // Log funnel analysis usage
    await db.queryAll`
      INSERT INTO audit_logs (user_id, action, resource_type, details)
      VALUES (${userID}, 'funnel_analysis', 'report', ${JSON.stringify(config)})
    `;

    return await advancedAnalytics.performFunnelAnalysis(config);
  }
);

export const compareReportPeriods = api(
  { method: "POST", path: "/reports/compare-periods", auth: true, expose: true },
  async (request: {
    report_id: string;
    current_period: { start_date: Date; end_date: Date };
    comparison_period: { start_date: Date; end_date: Date };
  }): Promise<{ comparisons: ComparisonData[] }> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    // Verify user owns the report
    const report = await db.queryRow`
      SELECT * FROM reports 
      WHERE id = ${request.report_id} AND user_id = ${userID}
    `;

    if (!report) {
      throw new Error("Report not found or access denied");
    }

    // Generate report data for both periods
    const { generateReportData } = await import("./report_generator");
    
    const reportConfig = {
      ...report,
      config: { ...JSON.parse(report.config as string), date_range: request.current_period },
      filters: JSON.parse(report.filters as string)
    };

    const currentData = await generateReportData(reportConfig);
    
    const comparisonConfig = {
      ...reportConfig,
      config: { ...reportConfig.config, date_range: request.comparison_period }
    };
    
    const comparisonData = await generateReportData(comparisonConfig);

    // Perform comparison analysis
    const comparisons = await advancedAnalytics.compareTimePeriods(
      currentData,
      request.current_period,
      request.comparison_period
    );

    return { comparisons };
  }
);

export const getTimeSeriesAnalysis = api(
  { method: "POST", path: "/reports/time-series", auth: true, expose: true },
  async (request: {
    metric: string;
    date_range: { start_date: Date; end_date: Date };
    granularity: 'hour' | 'day' | 'week' | 'month';
    filters?: any;
  }): Promise<TimeSeriesAnalysis> => {
    const auth = getAuthData()!;
    const userID = auth.userID;

    const { metric, date_range, granularity, filters = {} } = request;

    // Build time series query based on metric
    let table = '';
    let valueColumn = '';
    let whereClause = `WHERE created_at >= $1 AND created_at <= $2`;
    const params = [date_range.start_date, date_range.end_date];

    switch (metric) {
      case 'prospect_count':
        table = 'prospects';
        valueColumn = 'COUNT(*)';
        break;
      case 'email_open_rate':
        table = 'email_campaigns';
        valueColumn = 'AVG(open_rate)';
        break;
      case 'deal_value':
        table = 'deals';
        valueColumn = 'SUM(value)';
        break;
      default:
        throw new Error(`Unsupported time series metric: ${metric}`);
    }

    const query = `
      WITH time_series AS (
        SELECT 
          DATE_TRUNC('${granularity}', created_at) as time_bucket,
          ${valueColumn} as value
        FROM ${table}
        ${whereClause}
        GROUP BY time_bucket
        ORDER BY time_bucket
      )
      SELECT 
        time_bucket as timestamp,
        value,
        LAG(value) OVER (ORDER BY time_bucket) as previous_value
      FROM time_series
    `;

    const data = await db.rawQueryAll(query, ...params);

    const dataPoints = data.map(row => ({
      timestamp: row.timestamp,
      value: parseFloat(row.value || 0),
      metadata: {
        change_from_previous: row.previous_value ? 
          ((parseFloat(row.value || 0) - parseFloat(row.previous_value)) / parseFloat(row.previous_value)) * 100 : 0
      }
    }));

    // Analyze trend
    const values = dataPoints.map(point => point.value);
    const trendAnalysis = {
      direction: this.calculateTrendDirection(values),
      slope: this.calculateSlope(dataPoints),
      r_squared: this.calculateRSquared(dataPoints),
      projection_30_days: this.projectValue(dataPoints, 30)
    };

    // Detect anomalies (simplified)
    const anomalies = this.detectAnomalies(dataPoints);

    return {
      metric,
      data_points: dataPoints,
      trend_analysis: trendAnalysis,
      anomalies
    };
  }
);

export const getAvailableDrillDownOptions = api(
  { method: "GET", path: "/reports/drill-down-options", auth: true, expose: true },
  async (request: { metric: string }): Promise<{
    available_dimensions: string[];
    suggested_filters: { [key: string]: any };
    related_metrics: string[];
  }> => {
    const { metric } = request;

    const drillDownOptions: { [key: string]: any } = {
      'prospect_conversion': {
        available_dimensions: ['source', 'industry', 'company_size', 'score_range', 'geographic_region'],
        suggested_filters: {
          score_range: { min: 60, max: 100 },
          time_window: '30_days',
          status: ['qualified', 'converted']
        },
        related_metrics: ['email_engagement', 'agent_performance', 'deal_velocity']
      },
      'email_engagement': {
        available_dimensions: ['template_type', 'send_time', 'subject_category', 'recipient_industry'],
        suggested_filters: {
          send_time_range: { start: 9, end: 17 },
          template_performance: 'above_average'
        },
        related_metrics: ['prospect_conversion', 'agent_performance']
      },
      'agent_performance': {
        available_dimensions: ['agent_id', 'daily_limit', 'assigned_territory', 'experience_level'],
        suggested_filters: {
          status: 'active',
          performance_tier: 'top_25_percent'
        },
        related_metrics: ['prospect_conversion', 'email_engagement', 'deal_velocity']
      },
      'deal_velocity': {
        available_dimensions: ['deal_size', 'source', 'industry', 'stage', 'sales_rep'],
        suggested_filters: {
          deal_size_min: 10000,
          stage: ['proposal', 'negotiation', 'closed_won']
        },
        related_metrics: ['prospect_conversion', 'agent_performance']
      }
    };

    return drillDownOptions[metric] || {
      available_dimensions: [],
      suggested_filters: {},
      related_metrics: []
    };
  }
);

// Helper methods for time series analysis
function calculateTrendDirection(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 2) return 'stable';
  
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  const diff = Math.abs(secondAvg - firstAvg) / firstAvg;
  
  if (diff < 0.05) return 'stable';
  return secondAvg > firstAvg ? 'increasing' : 'decreasing';
}

function calculateSlope(dataPoints: any[]): number {
  if (dataPoints.length < 2) return 0;
  
  const n = dataPoints.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  dataPoints.forEach((point, index) => {
    sumX += index;
    sumY += point.value;
    sumXY += index * point.value;
    sumXX += index * index;
  });
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function calculateRSquared(dataPoints: any[]): number {
  // Simplified R² calculation
  if (dataPoints.length < 2) return 0;
  
  const slope = calculateSlope(dataPoints);
  const mean = dataPoints.reduce((sum, point) => sum + point.value, 0) / dataPoints.length;
  
  let totalVariation = 0;
  let unexplainedVariation = 0;
  
  dataPoints.forEach((point, index) => {
    const predicted = slope * index;
    totalVariation += Math.pow(point.value - mean, 2);
    unexplainedVariation += Math.pow(point.value - predicted, 2);
  });
  
  return totalVariation > 0 ? 1 - (unexplainedVariation / totalVariation) : 0;
}

function projectValue(dataPoints: any[], daysAhead: number): number {
  if (dataPoints.length < 2) return 0;
  
  const slope = calculateSlope(dataPoints);
  const lastValue = dataPoints[dataPoints.length - 1].value;
  
  return lastValue + (slope * daysAhead);
}

function detectAnomalies(dataPoints: any[]): any[] {
  // Simple anomaly detection using standard deviation
  const values = dataPoints.map(point => point.value);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  );
  
  const threshold = 2 * stdDev; // 2 standard deviations
  
  return dataPoints
    .filter(point => Math.abs(point.value - mean) > threshold)
    .map(point => ({
      timestamp: point.timestamp,
      actual_value: point.value,
      expected_value: mean,
      deviation_score: Math.abs(point.value - mean) / stdDev,
      severity: Math.abs(point.value - mean) > 3 * stdDev ? 'high' : 'medium'
    }));
}