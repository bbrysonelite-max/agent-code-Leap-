import { api } from "encore.dev/api";
import { db } from "./db";
import { PerformancePrediction, DataPoint } from "./types";

export interface PredictPerformanceRequest {
  entityType: 'agent' | 'campaign' | 'client';
  entityId: string;
  metrics: ('conversion_rate' | 'revenue' | 'response_rate' | 'engagement')[];
  period: 'week' | 'month' | 'quarter';
  forecastPeriods?: number;
}

export interface PerformancePredictionResponse {
  predictions: PerformancePrediction[];
  historicalTrends: PerformanceTrend[];
  benchmarks: PerformanceBenchmark[];
  riskFactors: RiskFactor[];
  actionableInsights: string[];
}

export interface PerformanceTrend {
  metric: string;
  trendData: DataPoint[];
  direction: 'improving' | 'declining' | 'stable';
  velocity: number;
  confidence: number;
}

export interface PerformanceBenchmark {
  metric: string;
  currentValue: number;
  benchmarkValue: number;
  percentile: number;
  comparison: 'above' | 'below' | 'at' | 'unknown';
}

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  impact: string;
  likelihood: number;
  mitigationSuggestions: string[];
}

export interface BulkPerformancePredictionRequest {
  entities: Array<{
    entityType: 'agent' | 'campaign' | 'client';
    entityId: string;
  }>;
  metric: 'conversion_rate' | 'revenue' | 'response_rate' | 'engagement';
  period: 'week' | 'month' | 'quarter';
}

export interface BulkPerformancePredictionResponse {
  predictions: PerformancePrediction[];
  rankings: PerformanceRanking[];
  insights: BulkInsight[];
}

export interface PerformanceRanking {
  entityId: string;
  entityType: string;
  currentValue: number;
  predictedValue: number;
  rank: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface BulkInsight {
  type: 'top_performer' | 'at_risk' | 'emerging' | 'declining';
  entities: string[];
  description: string;
  recommendations: string[];
}

export const predictPerformance = api(
  { method: "POST", path: "/forecasting/performance/predict", expose: true },
  async (req: PredictPerformanceRequest): Promise<PerformancePredictionResponse> => {
    const predictions: PerformancePrediction[] = [];
    const historicalTrends: PerformanceTrend[] = [];
    const benchmarks: PerformanceBenchmark[] = [];

    for (const metric of req.metrics) {
      const historicalData = await getPerformanceHistory(req.entityType, req.entityId, metric, req.period);
      const trend = analyzeTrend(historicalData, metric);
      const prediction = await generatePerformancePrediction(req.entityType, req.entityId, metric, req.period, historicalData, trend);
      const benchmark = await calculateBenchmark(req.entityType, metric, prediction.currentValue);

      predictions.push(prediction);
      historicalTrends.push(trend);
      benchmarks.push(benchmark);

      await savePerformancePrediction(prediction);
    }

    const riskFactors = await identifyRiskFactors(req.entityType, req.entityId, predictions, historicalTrends);
    const actionableInsights = generateActionableInsights(predictions, benchmarks, riskFactors);

    return {
      predictions,
      historicalTrends,
      benchmarks,
      riskFactors,
      actionableInsights
    };
  }
);

export const bulkPredictPerformance = api(
  { method: "POST", path: "/forecasting/performance/bulk-predict", expose: true },
  async (req: BulkPerformancePredictionRequest): Promise<BulkPerformancePredictionResponse> => {
    const predictions: PerformancePrediction[] = [];

    for (const entity of req.entities) {
      const historicalData = await getPerformanceHistory(entity.entityType, entity.entityId, req.metric, req.period);
      const trend = analyzeTrend(historicalData, req.metric);
      const prediction = await generatePerformancePrediction(entity.entityType, entity.entityId, req.metric, req.period, historicalData, trend);
      
      predictions.push(prediction);
      await savePerformancePrediction(prediction);
    }

    const rankings = generatePerformanceRankings(predictions);
    const insights = generateBulkInsights(predictions, rankings);

    return {
      predictions,
      rankings,
      insights
    };
  }
);

export const getPerformancePredictions = api(
  { method: "GET", path: "/forecasting/performance/predictions", expose: true },
  async (req: {
    entityType?: 'agent' | 'campaign' | 'client';
    entityId?: string;
    metric?: string;
    limit?: number;
  }): Promise<{ predictions: PerformancePrediction[] }> => {
    let query = `SELECT * FROM performance_predictions WHERE 1=1`;
    const params: any[] = [];

    if (req.entityType) {
      query += ` AND entity_type = $${params.length + 1}`;
      params.push(req.entityType);
    }

    if (req.entityId) {
      query += ` AND entity_id = $${params.length + 1}`;
      params.push(req.entityId);
    }

    if (req.metric) {
      query += ` AND metric = $${params.length + 1}`;
      params.push(req.metric);
    }

    query += ` ORDER BY created_at DESC LIMIT ${req.limit || 50}`;

    const rows = await db.exec(query, ...params);

    return {
      predictions: rows.map(row => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metric: row.metric,
        period: row.period,
        currentValue: parseFloat(row.current_value),
        predictedValue: parseFloat(row.predicted_value),
        confidence: parseFloat(row.confidence),
        trend: row.trend,
        recommendations: JSON.parse(row.recommendations),
        createdAt: row.created_at
      }))
    };
  }
);

export const getPerformanceAnalytics = api(
  { method: "POST", path: "/forecasting/performance/analytics", expose: true },
  async (req: {
    entityType: 'agent' | 'campaign' | 'client';
    metric: string;
    period: 'week' | 'month' | 'quarter';
    startDate: Date;
    endDate: Date;
  }): Promise<{
    aggregatedTrends: PerformanceTrend[];
    topPerformers: PerformanceRanking[];
    bottomPerformers: PerformanceRanking[];
    averageMetrics: Record<string, number>;
    volatilityAnalysis: VolatilityAnalysis[];
  }> => {
    const allEntities = await getAllEntitiesOfType(req.entityType);
    const aggregatedTrends: PerformanceTrend[] = [];
    const performanceData: PerformanceRanking[] = [];

    for (const entity of allEntities) {
      const historicalData = await getPerformanceHistory(req.entityType, entity.id, req.metric, req.period);
      if (historicalData.length > 0) {
        const trend = analyzeTrend(historicalData, req.metric);
        aggregatedTrends.push(trend);

        const currentValue = historicalData[historicalData.length - 1]?.value || 0;
        const prediction = await generateSimplePerformancePrediction(historicalData, trend);

        performanceData.push({
          entityId: entity.id,
          entityType: req.entityType,
          currentValue,
          predictedValue: prediction,
          rank: 0,
          trend: trend.direction
        });
      }
    }

    performanceData.sort((a, b) => b.currentValue - a.currentValue);
    performanceData.forEach((item, index) => {
      item.rank = index + 1;
    });

    const topPerformers = performanceData.slice(0, 5);
    const bottomPerformers = performanceData.slice(-5);

    const averageMetrics = calculateAverageMetrics(performanceData);
    const volatilityAnalysis = calculateVolatilityAnalysis(aggregatedTrends);

    return {
      aggregatedTrends,
      topPerformers,
      bottomPerformers,
      averageMetrics,
      volatilityAnalysis
    };
  }
);

interface VolatilityAnalysis {
  entityId: string;
  volatility: number;
  riskLevel: 'low' | 'medium' | 'high';
  stabilityScore: number;
}

async function getPerformanceHistory(
  entityType: string, 
  entityId: string, 
  metric: string, 
  period: string
): Promise<DataPoint[]> {
  const lookbackPeriods = period === 'week' ? 12 : period === 'month' ? 12 : 8;
  const truncFunction = period === 'week' ? 'week' : period === 'month' ? 'month' : 'quarter';

  let query = '';
  const params = [entityId];

  if (metric === 'conversion_rate') {
    if (entityType === 'agent') {
      query = `
        SELECT DATE_TRUNC('${truncFunction}', d.created_at) as period,
               COUNT(CASE WHEN d.status = 'won' THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as value
        FROM deals d
        WHERE d.agent_id = $1 
          AND d.created_at >= NOW() - INTERVAL '${lookbackPeriods} ${period}s'
        GROUP BY DATE_TRUNC('${truncFunction}', d.created_at)
        ORDER BY period
      `;
    } else if (entityType === 'campaign') {
      query = `
        SELECT DATE_TRUNC('${truncFunction}', p.created_at) as period,
               COUNT(CASE WHEN p.status = 'converted' THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as value
        FROM prospects p
        WHERE p.campaign_id = $1 
          AND p.created_at >= NOW() - INTERVAL '${lookbackPeriods} ${period}s'
        GROUP BY DATE_TRUNC('${truncFunction}', p.created_at)
        ORDER BY period
      `;
    }
  } else if (metric === 'revenue') {
    if (entityType === 'agent') {
      query = `
        SELECT DATE_TRUNC('${truncFunction}', d.created_at) as period,
               COALESCE(SUM(d.amount), 0) as value
        FROM deals d
        WHERE d.agent_id = $1 
          AND d.status = 'won'
          AND d.created_at >= NOW() - INTERVAL '${lookbackPeriods} ${period}s'
        GROUP BY DATE_TRUNC('${truncFunction}', d.created_at)
        ORDER BY period
      `;
    } else if (entityType === 'client') {
      query = `
        SELECT DATE_TRUNC('${truncFunction}', d.created_at) as period,
               COALESCE(SUM(d.amount), 0) as value
        FROM deals d
        WHERE d.client_id = $1 
          AND d.status = 'won'
          AND d.created_at >= NOW() - INTERVAL '${lookbackPeriods} ${period}s'
        GROUP BY DATE_TRUNC('${truncFunction}', d.created_at)
        ORDER BY period
      `;
    }
  } else if (metric === 'response_rate') {
    query = `
      SELECT DATE_TRUNC('${truncFunction}', a.created_at) as period,
             COUNT(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered') THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as value
      FROM activities a
      WHERE a.${entityType}_id = $1 
        AND a.created_at >= NOW() - INTERVAL '${lookbackPeriods} ${period}s'
      GROUP BY DATE_TRUNC('${truncFunction}', a.created_at)
      ORDER BY period
    `;
  } else if (metric === 'engagement') {
    query = `
      SELECT DATE_TRUNC('${truncFunction}', a.created_at) as period,
             COUNT(CASE WHEN a.type IN ('email_open', 'email_click', 'meeting_scheduled', 'call_answered') THEN 1 END)::FLOAT / NULLIF(COUNT(DISTINCT a.prospect_id), 0) as value
      FROM activities a
      WHERE a.${entityType}_id = $1 
        AND a.created_at >= NOW() - INTERVAL '${lookbackPeriods} ${period}s'
      GROUP BY DATE_TRUNC('${truncFunction}', a.created_at)
      ORDER BY period
    `;
  }

  if (!query) return [];

  const rows = await db.exec(query, ...params);
  
  return rows.map(row => ({
    date: new Date(row.period),
    value: parseFloat(row.value) || 0
  }));
}

function analyzeTrend(data: DataPoint[], metric: string): PerformanceTrend {
  if (data.length < 2) {
    return {
      metric,
      trendData: data,
      direction: 'stable',
      velocity: 0,
      confidence: 0.1
    };
  }

  const values = data.map(d => d.value);
  const slope = calculateSlope(values);
  const correlation = calculateCorrelation(values);
  
  const direction: 'improving' | 'declining' | 'stable' = 
    slope > 0.05 ? 'improving' : slope < -0.05 ? 'declining' : 'stable';
  
  const velocity = Math.abs(slope);
  const confidence = Math.min(Math.abs(correlation), 1);

  return {
    metric,
    trendData: data,
    direction,
    velocity,
    confidence
  };
}

async function generatePerformancePrediction(
  entityType: string,
  entityId: string,
  metric: string,
  period: string,
  historicalData: DataPoint[],
  trend: PerformanceTrend
): Promise<PerformancePrediction> {
  const currentValue = historicalData.length > 0 ? historicalData[historicalData.length - 1].value : 0;
  
  let predictedValue = currentValue;
  if (trend.direction === 'improving') {
    predictedValue = currentValue * (1 + trend.velocity);
  } else if (trend.direction === 'declining') {
    predictedValue = currentValue * (1 - trend.velocity);
  }

  predictedValue = Math.max(predictedValue, 0);
  if (metric === 'conversion_rate' || metric === 'response_rate' || metric === 'engagement') {
    predictedValue = Math.min(predictedValue, 1);
  }

  const confidence = calculatePredictionConfidence(historicalData, trend);
  const recommendations = generateRecommendations(entityType, metric, currentValue, predictedValue, trend);

  return {
    id: crypto.randomUUID(),
    entityType: entityType as any,
    entityId,
    metric: metric as any,
    period: period as any,
    currentValue,
    predictedValue,
    confidence,
    trend: trend.direction,
    recommendations,
    createdAt: new Date()
  };
}

async function calculateBenchmark(
  entityType: string, 
  metric: string, 
  currentValue: number
): Promise<PerformanceBenchmark> {
  const benchmarkRows = await db.exec`
    SELECT 
      AVG(current_value) as avg_value,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY current_value) as median_value,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY current_value) as p75_value,
      PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY current_value) as p90_value
    FROM performance_predictions
    WHERE entity_type = ${entityType}
      AND metric = ${metric}
      AND created_at >= NOW() - INTERVAL '90 days'
  `;

  if (benchmarkRows.length === 0 || !benchmarkRows[0].avg_value) {
    return {
      metric,
      currentValue,
      benchmarkValue: currentValue,
      percentile: 50,
      comparison: 'unknown'
    };
  }

  const benchmark = benchmarkRows[0];
  const benchmarkValue = parseFloat(benchmark.median_value);
  const p75 = parseFloat(benchmark.p75_value);
  const p90 = parseFloat(benchmark.p90_value);

  let percentile = 50;
  let comparison: 'above' | 'below' | 'at' = 'at';

  if (currentValue >= p90) {
    percentile = 90;
    comparison = 'above';
  } else if (currentValue >= p75) {
    percentile = 75;
    comparison = 'above';
  } else if (currentValue < benchmarkValue) {
    percentile = 25;
    comparison = 'below';
  }

  return {
    metric,
    currentValue,
    benchmarkValue,
    percentile,
    comparison
  };
}

async function identifyRiskFactors(
  entityType: string,
  entityId: string,
  predictions: PerformancePrediction[],
  trends: PerformanceTrend[]
): Promise<RiskFactor[]> {
  const riskFactors: RiskFactor[] = [];

  const decliningTrends = trends.filter(t => t.direction === 'declining');
  if (decliningTrends.length > 0) {
    riskFactors.push({
      factor: 'Declining Performance Trend',
      severity: decliningTrends.length > trends.length / 2 ? 'high' : 'medium',
      impact: `Multiple metrics showing declining trends: ${decliningTrends.map(t => t.metric).join(', ')}`,
      likelihood: Math.min(decliningTrends.reduce((sum, t) => sum + t.confidence, 0) / decliningTrends.length, 1),
      mitigationSuggestions: [
        'Review recent changes in strategy or process',
        'Increase coaching and training focus',
        'Analyze competitor activities and market conditions'
      ]
    });
  }

  const lowConfidencePredictions = predictions.filter(p => p.confidence < 0.4);
  if (lowConfidencePredictions.length > 0) {
    riskFactors.push({
      factor: 'Prediction Uncertainty',
      severity: 'medium',
      impact: 'Low confidence in performance predictions due to data volatility or insufficient history',
      likelihood: 0.7,
      mitigationSuggestions: [
        'Increase data collection frequency',
        'Standardize performance tracking processes',
        'Consider external factors affecting performance'
      ]
    });
  }

  const significantDeclines = predictions.filter(p => 
    p.predictedValue < p.currentValue * 0.8 && p.confidence > 0.6
  );
  if (significantDeclines.length > 0) {
    riskFactors.push({
      factor: 'Predicted Performance Decline',
      severity: 'high',
      impact: `Significant performance decline predicted for: ${significantDeclines.map(p => p.metric).join(', ')}`,
      likelihood: Math.min(significantDeclines.reduce((sum, p) => sum + p.confidence, 0) / significantDeclines.length, 1),
      mitigationSuggestions: [
        'Implement immediate performance improvement initiatives',
        'Conduct root cause analysis for declining metrics',
        'Consider resource reallocation or strategy adjustment'
      ]
    });
  }

  return riskFactors;
}

function generateActionableInsights(
  predictions: PerformancePrediction[],
  benchmarks: PerformanceBenchmark[],
  riskFactors: RiskFactor[]
): string[] {
  const insights: string[] = [];

  const improvingPredictions = predictions.filter(p => p.trend === 'improving');
  if (improvingPredictions.length > 0) {
    insights.push(`Positive momentum in ${improvingPredictions.map(p => p.metric).join(', ')} - capitalize on current strategies`);
  }

  const aboveBenchmark = benchmarks.filter(b => b.comparison === 'above');
  if (aboveBenchmark.length > 0) {
    insights.push(`Outperforming benchmarks in ${aboveBenchmark.map(b => b.metric).join(', ')} - document and scale successful practices`);
  }

  const belowBenchmark = benchmarks.filter(b => b.comparison === 'below');
  if (belowBenchmark.length > 0) {
    insights.push(`Underperforming in ${belowBenchmark.map(b => b.metric).join(', ')} - focus improvement efforts here`);
  }

  const highRiskFactors = riskFactors.filter(rf => rf.severity === 'high');
  if (highRiskFactors.length > 0) {
    insights.push(`High-priority risk factors identified: ${highRiskFactors.map(rf => rf.factor).join(', ')}`);
  }

  const stablePredictions = predictions.filter(p => p.trend === 'stable');
  if (stablePredictions.length === predictions.length) {
    insights.push('Performance metrics are stable - consider growth initiatives to drive improvement');
  }

  return insights;
}

function generatePerformanceRankings(predictions: PerformancePrediction[]): PerformanceRanking[] {
  const rankings = predictions
    .map(p => ({
      entityId: p.entityId,
      entityType: p.entityType,
      currentValue: p.currentValue,
      predictedValue: p.predictedValue,
      rank: 0,
      trend: p.trend
    }))
    .sort((a, b) => b.currentValue - a.currentValue);

  rankings.forEach((item, index) => {
    item.rank = index + 1;
  });

  return rankings;
}

function generateBulkInsights(
  predictions: PerformancePrediction[],
  rankings: PerformanceRanking[]
): BulkInsight[] {
  const insights: BulkInsight[] = [];

  const topPerformers = rankings.slice(0, Math.min(3, Math.ceil(rankings.length * 0.1)));
  if (topPerformers.length > 0) {
    insights.push({
      type: 'top_performer',
      entities: topPerformers.map(p => p.entityId),
      description: 'Consistently high-performing entities',
      recommendations: [
        'Study and document best practices from top performers',
        'Consider these entities as mentors for improvement programs',
        'Analyze factors contributing to their success'
      ]
    });
  }

  const atRisk = predictions
    .filter(p => p.trend === 'declining' && p.confidence > 0.6)
    .map(p => p.entityId);
  if (atRisk.length > 0) {
    insights.push({
      type: 'at_risk',
      entities: atRisk,
      description: 'Entities showing declining performance trends',
      recommendations: [
        'Prioritize immediate intervention and support',
        'Conduct performance review and coaching sessions',
        'Investigate root causes of performance decline'
      ]
    });
  }

  const emerging = predictions
    .filter(p => p.trend === 'improving' && p.currentValue < rankings[Math.floor(rankings.length / 2)]?.currentValue)
    .map(p => p.entityId);
  if (emerging.length > 0) {
    insights.push({
      type: 'emerging',
      entities: emerging,
      description: 'Entities showing improvement from lower performance levels',
      recommendations: [
        'Provide additional resources to sustain growth momentum',
        'Share success factors with other underperforming entities',
        'Monitor closely to ensure continued improvement'
      ]
    });
  }

  return insights;
}

function calculateSlope(values: number[]): number {
  const n = values.length;
  const x = Array.from({length: n}, (_, i) => i);
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function calculateCorrelation(values: number[]): number {
  const n = values.length;
  const x = Array.from({length: n}, (_, i) => i);
  
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  
  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (values[i] - meanY), 0);
  const denomX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
  const denomY = Math.sqrt(values.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));
  
  return denomX * denomY !== 0 ? numerator / (denomX * denomY) : 0;
}

function calculatePredictionConfidence(data: DataPoint[], trend: PerformanceTrend): number {
  const dataQuality = Math.min(data.length / 8, 1);
  const trendConfidence = trend.confidence;
  const volatility = calculateVolatility(data);
  const stability = Math.max(0, 1 - volatility);
  
  return (dataQuality * 0.3 + trendConfidence * 0.4 + stability * 0.3);
}

function calculateVolatility(data: DataPoint[]): number {
  if (data.length < 2) return 0;
  
  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return mean > 0 ? Math.sqrt(variance) / mean : 0;
}

function generateRecommendations(
  entityType: string,
  metric: string,
  currentValue: number,
  predictedValue: number,
  trend: PerformanceTrend
): string[] {
  const recommendations: string[] = [];

  if (trend.direction === 'declining') {
    recommendations.push(`${metric} is trending downward - immediate attention required`);
    
    if (metric === 'conversion_rate') {
      recommendations.push('Review lead qualification process and sales methodology');
      recommendations.push('Increase follow-up frequency and personalization');
    } else if (metric === 'revenue') {
      recommendations.push('Focus on higher-value opportunities and upselling');
      recommendations.push('Review pricing strategy and deal negotiation tactics');
    } else if (metric === 'response_rate') {
      recommendations.push('A/B test email subject lines and messaging');
      recommendations.push('Optimize outreach timing and channel selection');
    }
  } else if (trend.direction === 'improving') {
    recommendations.push(`${metric} is improving - maintain and scale current strategies`);
    recommendations.push('Document successful practices for knowledge sharing');
  } else {
    recommendations.push(`${metric} is stable - consider growth initiatives`);
  }

  if (predictedValue > currentValue * 1.1) {
    recommendations.push('Strong growth predicted - prepare for increased capacity needs');
  } else if (predictedValue < currentValue * 0.9) {
    recommendations.push('Performance decline predicted - implement preventive measures');
  }

  return recommendations;
}

async function getAllEntitiesOfType(entityType: string): Promise<Array<{ id: string }>> {
  let tableName = '';
  
  switch (entityType) {
    case 'agent':
      tableName = 'agents';
      break;
    case 'campaign':
      tableName = 'email_campaigns';
      break;
    case 'client':
      tableName = 'client_configurations';
      break;
    default:
      return [];
  }

  const rows = await db.exec(`SELECT id FROM ${tableName} LIMIT 100`);
  return rows.map(row => ({ id: row.id }));
}

async function generateSimplePerformancePrediction(data: DataPoint[], trend: PerformanceTrend): Promise<number> {
  if (data.length === 0) return 0;
  
  const currentValue = data[data.length - 1].value;
  
  if (trend.direction === 'improving') {
    return currentValue * (1 + trend.velocity);
  } else if (trend.direction === 'declining') {
    return currentValue * (1 - trend.velocity);
  }
  
  return currentValue;
}

function calculateAverageMetrics(data: PerformanceRanking[]): Record<string, number> {
  if (data.length === 0) return {};
  
  const avgCurrent = data.reduce((sum, item) => sum + item.currentValue, 0) / data.length;
  const avgPredicted = data.reduce((sum, item) => sum + item.predictedValue, 0) / data.length;
  
  return {
    averageCurrent: avgCurrent,
    averagePredicted: avgPredicted,
    improvement: ((avgPredicted - avgCurrent) / avgCurrent) * 100
  };
}

function calculateVolatilityAnalysis(trends: PerformanceTrend[]): VolatilityAnalysis[] {
  return trends.map((trend, index) => {
    const volatility = calculateVolatility(trend.trendData);
    const riskLevel: 'low' | 'medium' | 'high' = 
      volatility > 0.4 ? 'high' : volatility > 0.2 ? 'medium' : 'low';
    const stabilityScore = Math.max(0, 1 - volatility);
    
    return {
      entityId: `entity_${index}`,
      volatility,
      riskLevel,
      stabilityScore
    };
  });
}

async function savePerformancePrediction(prediction: PerformancePrediction): Promise<void> {
  await db.exec`
    INSERT INTO performance_predictions (id, entity_type, entity_id, metric, period, 
                                        current_value, predicted_value, confidence, trend, recommendations)
    VALUES (${prediction.id}, ${prediction.entityType}, ${prediction.entityId}, ${prediction.metric},
            ${prediction.period}, ${prediction.currentValue}, ${prediction.predictedValue},
            ${prediction.confidence}, ${prediction.trend}, ${JSON.stringify(prediction.recommendations)})
  `;
}