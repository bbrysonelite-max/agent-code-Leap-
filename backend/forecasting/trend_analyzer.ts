import { api } from "encore.dev/api";
import { db } from "./db";
import { TrendAnalysis, DataPoint, SeasonalFactor, Anomaly } from "./types";

export interface AnalyzeTrendRequest {
  metric: string;
  entityType?: 'agent' | 'campaign' | 'client' | 'global';
  entityId?: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  detectionSensitivity?: 'low' | 'medium' | 'high';
}

export interface TrendAnalysisResponse {
  analysis: TrendAnalysis;
  patterns: DetectedPattern[];
  forecasts: DataPoint[];
  recommendations: TrendRecommendation[];
}

export interface DetectedPattern {
  type: 'seasonal' | 'cyclical' | 'linear' | 'exponential' | 'irregular';
  description: string;
  strength: number;
  confidence: number;
  period?: number;
  amplitude?: number;
  phase?: number;
}

export interface TrendRecommendation {
  category: 'opportunity' | 'risk' | 'optimization' | 'maintenance';
  message: string;
  priority: 'low' | 'medium' | 'high';
  actionItems: string[];
  expectedImpact: number;
}

export interface PatternDetectionRequest {
  metrics: string[];
  entityType?: 'agent' | 'campaign' | 'client' | 'global';
  lookbackDays: number;
  minPatternStrength?: number;
}

export interface PatternDetectionResponse {
  patterns: MultiMetricPattern[];
  correlations: MetricCorrelation[];
  insights: PatternInsight[];
}

export interface MultiMetricPattern {
  metrics: string[];
  patternType: 'correlation' | 'leading_indicator' | 'seasonal_sync' | 'inverse_relationship';
  strength: number;
  description: string;
  lagDays?: number;
}

export interface MetricCorrelation {
  metric1: string;
  metric2: string;
  correlation: number;
  significance: number;
  relationship: 'positive' | 'negative' | 'none';
}

export interface PatternInsight {
  pattern: string;
  insight: string;
  confidence: number;
  actionable: boolean;
  recommendations: string[];
}

export interface AnomalyDetectionRequest {
  metric: string;
  entityType?: 'agent' | 'campaign' | 'client' | 'global';
  entityId?: string;
  period: 'daily' | 'weekly' | 'monthly';
  lookbackDays: number;
  sensitivity?: number;
}

export interface AnomalyDetectionResponse {
  anomalies: Anomaly[];
  baseline: DataPoint[];
  statistics: AnomalyStatistics;
  alerts: AnomalyAlert[];
}

export interface AnomalyStatistics {
  totalAnomalies: number;
  positiveAnomalies: number;
  negativeAnomalies: number;
  averageDeviation: number;
  maxDeviation: number;
  anomalyRate: number;
}

export interface AnomalyAlert {
  date: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  impact: string;
  recommendations: string[];
}

export const analyzeTrend = api(
  { method: "POST", path: "/forecasting/trends/analyze", expose: true },
  async (req: AnalyzeTrendRequest): Promise<TrendAnalysisResponse> => {
    const data = await getMetricData(req);
    const analysis = await performTrendAnalysis(data, req);
    const patterns = detectDataPatterns(data, req.detectionSensitivity || 'medium');
    const forecasts = generateForecasts(data, analysis, 12);
    const recommendations = generateTrendRecommendations(analysis, patterns, data);

    await saveTrendAnalysis(analysis);

    return {
      analysis,
      patterns,
      forecasts,
      recommendations
    };
  }
);

export const detectPatterns = api(
  { method: "POST", path: "/forecasting/trends/patterns", expose: true },
  async (req: PatternDetectionRequest): Promise<PatternDetectionResponse> => {
    const patterns: MultiMetricPattern[] = [];
    const correlations: MetricCorrelation[] = [];

    const metricData = await Promise.all(
      req.metrics.map(async (metric) => ({
        metric,
        data: await getMetricData({
          metric,
          entityType: req.entityType,
          period: 'daily',
          startDate: new Date(Date.now() - req.lookbackDays * 24 * 60 * 60 * 1000),
          endDate: new Date()
        })
      }))
    );

    for (let i = 0; i < metricData.length; i++) {
      for (let j = i + 1; j < metricData.length; j++) {
        const correlation = calculateCorrelation(metricData[i].data, metricData[j].data);
        correlations.push({
          metric1: metricData[i].metric,
          metric2: metricData[j].metric,
          correlation: correlation.coefficient,
          significance: correlation.significance,
          relationship: correlation.coefficient > 0.3 ? 'positive' : correlation.coefficient < -0.3 ? 'negative' : 'none'
        });

        if (Math.abs(correlation.coefficient) > (req.minPatternStrength || 0.5)) {
          const leadingIndicator = findLeadingIndicator(metricData[i].data, metricData[j].data);
          if (leadingIndicator.lagDays > 0) {
            patterns.push({
              metrics: [metricData[i].metric, metricData[j].metric],
              patternType: 'leading_indicator',
              strength: Math.abs(correlation.coefficient),
              description: `${metricData[i].metric} leads ${metricData[j].metric} by ${leadingIndicator.lagDays} days`,
              lagDays: leadingIndicator.lagDays
            });
          }
        }
      }
    }

    const seasonalPatterns = findSeasonalPatterns(metricData, req.minPatternStrength || 0.5);
    patterns.push(...seasonalPatterns);

    const insights = generatePatternInsights(patterns, correlations);

    return {
      patterns,
      correlations,
      insights
    };
  }
);

export const detectAnomalies = api(
  { method: "POST", path: "/forecasting/trends/anomalies", expose: true },
  async (req: AnomalyDetectionRequest): Promise<AnomalyDetectionResponse> => {
    const data = await getMetricData({
      metric: req.metric,
      entityType: req.entityType,
      entityId: req.entityId,
      period: req.period,
      startDate: new Date(Date.now() - req.lookbackDays * 24 * 60 * 60 * 1000),
      endDate: new Date()
    });

    const anomalies = detectDataAnomalies(data, req.sensitivity || 2.0);
    const baseline = calculateBaseline(data);
    const statistics = calculateAnomalyStatistics(anomalies, data);
    const alerts = generateAnomalyAlerts(anomalies, req.metric);

    return {
      anomalies,
      baseline,
      statistics,
      alerts
    };
  }
);

export const getTrendInsights = api(
  { method: "GET", path: "/forecasting/trends/insights", expose: true },
  async (req: {
    entityType?: 'agent' | 'campaign' | 'client' | 'global';
    period?: 'week' | 'month' | 'quarter';
    limit?: number;
  }): Promise<{
    insights: TrendInsight[];
    topPatterns: DetectedPattern[];
    criticalAnomalies: Anomaly[];
    recommendedActions: string[];
  }> => {
    const recentAnalyses = await getRecentTrendAnalyses(req.period || 'month', req.limit || 10);
    const insights = generateInsightsFromAnalyses(recentAnalyses);
    const topPatterns = extractTopPatterns(recentAnalyses);
    const criticalAnomalies = await getCriticalAnomalies(req.period || 'month');
    const recommendedActions = generateRecommendedActions(insights, topPatterns, criticalAnomalies);

    return {
      insights,
      topPatterns,
      criticalAnomalies,
      recommendedActions
    };
  }
);

export const compareMetricTrends = api(
  { method: "POST", path: "/forecasting/trends/compare", expose: true },
  async (req: {
    metrics: string[];
    entities: Array<{ type: 'agent' | 'campaign' | 'client'; id: string }>;
    period: 'daily' | 'weekly' | 'monthly';
    startDate: Date;
    endDate: Date;
  }): Promise<{
    comparisons: TrendComparison[];
    rankings: EntityRanking[];
    insights: ComparisonInsight[];
  }> => {
    const comparisons: TrendComparison[] = [];
    const entityPerformance: Record<string, number> = {};

    for (const entity of req.entities) {
      for (const metric of req.metrics) {
        const data = await getMetricData({
          metric,
          entityType: entity.type,
          entityId: entity.id,
          period: req.period,
          startDate: req.startDate,
          endDate: req.endDate
        });

        const trendAnalysis = await performTrendAnalysis(data, {
          metric,
          entityType: entity.type,
          period: req.period,
          startDate: req.startDate,
          endDate: req.endDate
        });

        comparisons.push({
          entityId: entity.id,
          entityType: entity.type,
          metric,
          trendDirection: trendAnalysis.slope > 0 ? 'up' : trendAnalysis.slope < 0 ? 'down' : 'stable',
          trendStrength: Math.abs(trendAnalysis.slope),
          correlation: trendAnalysis.correlation,
          currentValue: data.length > 0 ? data[data.length - 1].value : 0,
          changePercent: calculateChangePercent(data)
        });

        entityPerformance[`${entity.type}_${entity.id}`] = (entityPerformance[`${entity.type}_${entity.id}`] || 0) + Math.abs(trendAnalysis.correlation);
      }
    }

    const rankings = Object.entries(entityPerformance)
      .map(([key, score]) => {
        const [type, id] = key.split('_');
        return {
          entityId: id,
          entityType: type as 'agent' | 'campaign' | 'client',
          overallScore: score,
          rank: 0
        };
      })
      .sort((a, b) => b.overallScore - a.overallScore)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const insights = generateComparisonInsights(comparisons, rankings);

    return {
      comparisons,
      rankings,
      insights
    };
  }
);

interface TrendInsight {
  type: 'growth' | 'decline' | 'volatility' | 'stability' | 'seasonality';
  metric: string;
  message: string;
  confidence: number;
  timeframe: string;
  magnitude: number;
}

interface TrendComparison {
  entityId: string;
  entityType: string;
  metric: string;
  trendDirection: 'up' | 'down' | 'stable';
  trendStrength: number;
  correlation: number;
  currentValue: number;
  changePercent: number;
}

interface EntityRanking {
  entityId: string;
  entityType: string;
  overallScore: number;
  rank: number;
}

interface ComparisonInsight {
  type: 'performance_gap' | 'best_practice' | 'risk_factor' | 'opportunity';
  message: string;
  affectedEntities: string[];
  recommendations: string[];
}

async function getMetricData(req: Partial<AnalyzeTrendRequest>): Promise<DataPoint[]> {
  let query = '';
  let params: any[] = [req.startDate, req.endDate];

  const truncFunction = req.period === 'daily' ? 'day' : req.period === 'weekly' ? 'week' : 'month';

  switch (req.metric) {
    case 'conversion_rate':
      if (req.entityType === 'agent') {
        query = `
          SELECT DATE_TRUNC('${truncFunction}', d.created_at) as period,
                 COUNT(CASE WHEN d.status = 'won' THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as value
          FROM deals d
          WHERE d.created_at BETWEEN $1 AND $2
          ${req.entityId ? `AND d.agent_id = $3` : ''}
          GROUP BY DATE_TRUNC('${truncFunction}', d.created_at)
          ORDER BY period
        `;
        if (req.entityId) params.push(req.entityId);
      }
      break;

    case 'revenue':
      query = `
        SELECT DATE_TRUNC('${truncFunction}', d.created_at) as period,
               COALESCE(SUM(d.amount), 0) as value
        FROM deals d
        WHERE d.status = 'won' 
          AND d.created_at BETWEEN $1 AND $2
          ${req.entityId ? `AND d.${req.entityType}_id = $3` : ''}
        GROUP BY DATE_TRUNC('${truncFunction}', d.created_at)
        ORDER BY period
      `;
      if (req.entityId) params.push(req.entityId);
      break;

    case 'email_open_rate':
      query = `
        SELECT DATE_TRUNC('${truncFunction}', a.created_at) as period,
               COUNT(CASE WHEN a.type = 'email_open' THEN 1 END)::FLOAT / NULLIF(COUNT(CASE WHEN a.type = 'email_sent' THEN 1 END), 0) as value
        FROM activities a
        WHERE a.created_at BETWEEN $1 AND $2
          ${req.entityId ? `AND a.${req.entityType}_id = $3` : ''}
        GROUP BY DATE_TRUNC('${truncFunction}', a.created_at)
        ORDER BY period
      `;
      if (req.entityId) params.push(req.entityId);
      break;

    case 'response_rate':
      query = `
        SELECT DATE_TRUNC('${truncFunction}', a.created_at) as period,
               COUNT(CASE WHEN a.type IN ('email_open', 'email_click', 'call_answered') THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) as value
        FROM activities a
        WHERE a.created_at BETWEEN $1 AND $2
          ${req.entityId ? `AND a.${req.entityType}_id = $3` : ''}
        GROUP BY DATE_TRUNC('${truncFunction}', a.created_at)
        ORDER BY period
      `;
      if (req.entityId) params.push(req.entityId);
      break;

    default:
      throw new Error(`Unsupported metric: ${req.metric}`);
  }

  const rows = await db.exec(query, ...params);
  return rows.map(row => ({
    date: new Date(row.period),
    value: parseFloat(row.value) || 0
  }));
}

async function performTrendAnalysis(data: DataPoint[], req: Partial<AnalyzeTrendRequest>): Promise<TrendAnalysis> {
  if (data.length < 3) {
    throw new Error('Insufficient data for trend analysis');
  }

  const values = data.map(d => d.value);
  const slope = calculateSlope(values);
  const correlation = calculateLinearCorrelation(values);
  const trendType = detectTrendType(data);
  const seasonalFactors = analyzeSeasonality(data);
  const anomalies = detectDataAnomalies(data, 2.0);
  const forecast = generateForecasts(data, { slope, correlation } as any, 6);

  return {
    id: crypto.randomUUID(),
    metric: req.metric || 'unknown',
    period: req.period || 'daily',
    trendType,
    slope,
    correlation,
    seasonalFactors,
    anomalies,
    forecast,
    createdAt: new Date()
  };
}

function detectDataPatterns(data: DataPoint[], sensitivity: 'low' | 'medium' | 'high'): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const sensitivityThresholds = { low: 0.3, medium: 0.5, high: 0.7 };
  const threshold = sensitivityThresholds[sensitivity];

  const linearPattern = detectLinearPattern(data);
  if (linearPattern.strength > threshold) {
    patterns.push(linearPattern);
  }

  const seasonalPattern = detectSeasonalPattern(data);
  if (seasonalPattern.strength > threshold) {
    patterns.push(seasonalPattern);
  }

  const cyclicalPattern = detectCyclicalPattern(data);
  if (cyclicalPattern.strength > threshold) {
    patterns.push(cyclicalPattern);
  }

  const exponentialPattern = detectExponentialPattern(data);
  if (exponentialPattern.strength > threshold) {
    patterns.push(exponentialPattern);
  }

  return patterns;
}

function detectLinearPattern(data: DataPoint[]): DetectedPattern {
  const values = data.map(d => d.value);
  const correlation = Math.abs(calculateLinearCorrelation(values));
  
  return {
    type: 'linear',
    description: correlation > 0.5 ? 'Strong linear trend detected' : 'Weak linear trend detected',
    strength: correlation,
    confidence: Math.min(correlation * 1.2, 1.0)
  };
}

function detectSeasonalPattern(data: DataPoint[]): DetectedPattern {
  if (data.length < 12) {
    return {
      type: 'seasonal',
      description: 'Insufficient data for seasonal analysis',
      strength: 0,
      confidence: 0
    };
  }

  const seasonalStrength = calculateSeasonalStrength(data);
  const period = findSeasonalPeriod(data);

  return {
    type: 'seasonal',
    description: seasonalStrength > 0.5 ? 'Strong seasonal pattern detected' : 'Weak seasonal pattern detected',
    strength: seasonalStrength,
    confidence: seasonalStrength,
    period,
    amplitude: calculateSeasonalAmplitude(data, period)
  };
}

function detectCyclicalPattern(data: DataPoint[]): DetectedPattern {
  const cyclicalStrength = detectCycles(data);
  
  return {
    type: 'cyclical',
    description: cyclicalStrength > 0.4 ? 'Cyclical pattern detected' : 'No significant cyclical pattern',
    strength: cyclicalStrength,
    confidence: cyclicalStrength * 0.8
  };
}

function detectExponentialPattern(data: DataPoint[]): DetectedPattern {
  const values = data.map(d => d.value);
  const logValues = values.filter(v => v > 0).map(v => Math.log(v));
  const exponentialCorrelation = logValues.length > 2 ? Math.abs(calculateLinearCorrelation(logValues)) : 0;
  
  return {
    type: 'exponential',
    description: exponentialCorrelation > 0.7 ? 'Exponential growth/decay pattern detected' : 'No exponential pattern',
    strength: exponentialCorrelation,
    confidence: exponentialCorrelation * 0.9
  };
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

function calculateLinearCorrelation(values: number[]): number {
  const n = values.length;
  const x = Array.from({length: n}, (_, i) => i);
  
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  
  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (values[i] - meanY), 0);
  const denomX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
  const denomY = Math.sqrt(values.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));
  
  return denomX * denomY !== 0 ? numerator / (denomX * denomY) : 0;
}

function detectTrendType(data: DataPoint[]): 'linear' | 'exponential' | 'seasonal' | 'cyclical' {
  const values = data.map(d => d.value);
  const linearCorr = Math.abs(calculateLinearCorrelation(values));
  
  const logValues = values.filter(v => v > 0).map(v => Math.log(v));
  const exponentialCorr = logValues.length > 2 ? Math.abs(calculateLinearCorrelation(logValues)) : 0;
  
  const seasonalStrength = data.length >= 12 ? calculateSeasonalStrength(data) : 0;
  const cyclicalStrength = detectCycles(data);

  const strengths = [
    { type: 'linear' as const, strength: linearCorr },
    { type: 'exponential' as const, strength: exponentialCorr },
    { type: 'seasonal' as const, strength: seasonalStrength },
    { type: 'cyclical' as const, strength: cyclicalStrength }
  ];

  return strengths.reduce((best, current) => 
    current.strength > best.strength ? current : best
  ).type;
}

function analyzeSeasonality(data: DataPoint[]): SeasonalFactor[] {
  if (data.length < 12) return [];

  const monthlyData: Record<number, number[]> = {};
  data.forEach(point => {
    const month = point.date.getMonth();
    if (!monthlyData[month]) monthlyData[month] = [];
    monthlyData[month].push(point.value);
  });

  const overallAverage = data.reduce((sum, point) => sum + point.value, 0) / data.length;
  const factors: SeasonalFactor[] = [];

  for (let month = 0; month < 12; month++) {
    if (monthlyData[month] && monthlyData[month].length > 0) {
      const monthAverage = monthlyData[month].reduce((a, b) => a + b, 0) / monthlyData[month].length;
      const factor = overallAverage > 0 ? monthAverage / overallAverage : 1;
      
      factors.push({
        period: new Date(2024, month).toLocaleString('default', { month: 'long' }),
        factor,
        confidence: Math.min(monthlyData[month].length / 3, 1)
      });
    }
  }

  return factors;
}

function detectDataAnomalies(data: DataPoint[], sensitivity: number = 2.0): Anomaly[] {
  if (data.length < 5) return [];

  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
  
  const anomalies: Anomaly[] = [];
  const threshold = sensitivity * stdDev;

  data.forEach(point => {
    const deviation = Math.abs(point.value - mean);
    if (deviation > threshold) {
      anomalies.push({
        date: point.date,
        value: point.value,
        expectedValue: mean,
        severity: deviation > 3 * stdDev ? 'high' : deviation > 2.5 * stdDev ? 'medium' : 'low',
        possibleCauses: generateAnomalyCauses(point.value, mean, point.date)
      });
    }
  });

  return anomalies;
}

function generateForecasts(data: DataPoint[], analysis: { slope: number; correlation: number }, periods: number): DataPoint[] {
  if (data.length === 0) return [];

  const lastPoint = data[data.length - 1];
  const forecasts: DataPoint[] = [];

  for (let i = 1; i <= periods; i++) {
    const futureDate = new Date(lastPoint.date);
    futureDate.setMonth(futureDate.getMonth() + i);
    
    const predictedValue = Math.max(lastPoint.value + analysis.slope * i, 0);
    const confidence = Math.max(0.9 - i * 0.1, 0.3);
    
    forecasts.push({
      date: futureDate,
      value: predictedValue,
      confidence
    });
  }

  return forecasts;
}

function generateTrendRecommendations(
  analysis: TrendAnalysis, 
  patterns: DetectedPattern[], 
  data: DataPoint[]
): TrendRecommendation[] {
  const recommendations: TrendRecommendation[] = [];

  if (analysis.slope > 0.1 && analysis.correlation > 0.6) {
    recommendations.push({
      category: 'opportunity',
      message: 'Strong positive trend detected - consider scaling current strategies',
      priority: 'high',
      actionItems: [
        'Analyze successful factors driving the trend',
        'Increase resource allocation to maintain momentum',
        'Document best practices for replication'
      ],
      expectedImpact: 0.8
    });
  }

  if (analysis.slope < -0.1 && analysis.correlation < -0.6) {
    recommendations.push({
      category: 'risk',
      message: 'Declining trend detected - immediate intervention required',
      priority: 'high',
      actionItems: [
        'Identify root causes of decline',
        'Implement corrective measures',
        'Monitor progress closely'
      ],
      expectedImpact: 0.9
    });
  }

  const strongSeasonalPattern = patterns.find(p => p.type === 'seasonal' && p.strength > 0.7);
  if (strongSeasonalPattern) {
    recommendations.push({
      category: 'optimization',
      message: 'Strong seasonal pattern identified - optimize for seasonal variations',
      priority: 'medium',
      actionItems: [
        'Prepare for seasonal peaks and troughs',
        'Adjust resource allocation based on seasonal patterns',
        'Plan campaigns around seasonal trends'
      ],
      expectedImpact: 0.6
    });
  }

  if (analysis.anomalies.length > data.length * 0.1) {
    recommendations.push({
      category: 'maintenance',
      message: 'High anomaly frequency detected - improve process consistency',
      priority: 'medium',
      actionItems: [
        'Review data quality and collection processes',
        'Investigate causes of irregular performance',
        'Implement monitoring and alerting systems'
      ],
      expectedImpact: 0.5
    });
  }

  return recommendations;
}

function calculateCorrelation(data1: DataPoint[], data2: DataPoint[]): { coefficient: number; significance: number } {
  const minLength = Math.min(data1.length, data2.length);
  if (minLength < 3) return { coefficient: 0, significance: 0 };

  const values1 = data1.slice(0, minLength).map(d => d.value);
  const values2 = data2.slice(0, minLength).map(d => d.value);

  const correlation = calculateLinearCorrelation(values1.map((v, i) => values2[i]));
  const significance = Math.min(minLength / 30, 1);

  return { coefficient: correlation, significance };
}

function findLeadingIndicator(data1: DataPoint[], data2: DataPoint[]): { lagDays: number; correlation: number } {
  const maxLag = Math.min(30, Math.floor(data1.length / 3));
  let bestLag = 0;
  let bestCorrelation = 0;

  for (let lag = 1; lag <= maxLag; lag++) {
    if (data1.length > lag && data2.length > lag) {
      const leadingValues = data1.slice(0, -lag).map(d => d.value);
      const laggingValues = data2.slice(lag).map(d => d.value);
      
      if (leadingValues.length === laggingValues.length && leadingValues.length > 2) {
        const correlation = Math.abs(calculatePearsonCorrelation(leadingValues, laggingValues));
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestLag = lag;
        }
      }
    }
  }

  return { lagDays: bestLag, correlation: bestCorrelation };
}

function findSeasonalPatterns(
  metricData: Array<{ metric: string; data: DataPoint[] }>,
  minStrength: number
): MultiMetricPattern[] {
  const patterns: MultiMetricPattern[] = [];

  for (const { metric, data } of metricData) {
    if (data.length >= 12) {
      const seasonalStrength = calculateSeasonalStrength(data);
      if (seasonalStrength > minStrength) {
        patterns.push({
          metrics: [metric],
          patternType: 'seasonal_sync',
          strength: seasonalStrength,
          description: `${metric} shows strong seasonal pattern with ${seasonalStrength.toFixed(2)} strength`
        });
      }
    }
  }

  return patterns;
}

function generatePatternInsights(patterns: MultiMetricPattern[], correlations: MetricCorrelation[]): PatternInsight[] {
  const insights: PatternInsight[] = [];

  const strongCorrelations = correlations.filter(c => Math.abs(c.correlation) > 0.7);
  strongCorrelations.forEach(corr => {
    insights.push({
      pattern: 'strong_correlation',
      insight: `Strong ${corr.relationship} correlation (${corr.correlation.toFixed(2)}) between ${corr.metric1} and ${corr.metric2}`,
      confidence: Math.abs(corr.correlation),
      actionable: true,
      recommendations: [
        `Use ${corr.metric1} as a leading indicator for ${corr.metric2}`,
        'Monitor both metrics together for early trend detection'
      ]
    });
  });

  const leadingIndicators = patterns.filter(p => p.patternType === 'leading_indicator');
  leadingIndicators.forEach(pattern => {
    insights.push({
      pattern: 'leading_indicator',
      insight: pattern.description,
      confidence: pattern.strength,
      actionable: true,
      recommendations: [
        `Monitor ${pattern.metrics[0]} for early warning signals`,
        `Adjust strategies based on ${pattern.metrics[0]} trends`
      ]
    });
  });

  return insights;
}

function calculateSeasonalStrength(data: DataPoint[]): number {
  if (data.length < 12) return 0;

  const monthlyAverages: number[] = [];
  for (let month = 0; month < 12; month++) {
    const monthData = data.filter(d => d.date.getMonth() === month);
    if (monthData.length > 0) {
      monthlyAverages.push(monthData.reduce((sum, d) => sum + d.value, 0) / monthData.length);
    }
  }

  if (monthlyAverages.length < 12) return 0;

  const overallMean = monthlyAverages.reduce((a, b) => a + b, 0) / monthlyAverages.length;
  const variance = monthlyAverages.reduce((sum, avg) => sum + Math.pow(avg - overallMean, 2), 0) / monthlyAverages.length;
  
  return overallMean > 0 ? Math.sqrt(variance) / overallMean : 0;
}

function findSeasonalPeriod(data: DataPoint[]): number {
  return 12; // Assuming monthly data, period is 12 months
}

function calculateSeasonalAmplitude(data: DataPoint[], period: number): number {
  const monthlyAverages: number[] = [];
  for (let month = 0; month < period; month++) {
    const monthData = data.filter(d => d.date.getMonth() === month);
    if (monthData.length > 0) {
      monthlyAverages.push(monthData.reduce((sum, d) => sum + d.value, 0) / monthData.length);
    }
  }

  return monthlyAverages.length > 0 ? Math.max(...monthlyAverages) - Math.min(...monthlyAverages) : 0;
}

function detectCycles(data: DataPoint[]): number {
  if (data.length < 8) return 0;

  const values = data.map(d => d.value);
  const peaks = findPeaks(values);
  const troughs = findTroughs(values);

  if (peaks.length < 2 || troughs.length < 2) return 0;

  const peakIntervals = [];
  for (let i = 1; i < peaks.length; i++) {
    peakIntervals.push(peaks[i] - peaks[i-1]);
  }

  const avgInterval = peakIntervals.reduce((a, b) => a + b, 0) / peakIntervals.length;
  const intervalVariance = peakIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / peakIntervals.length;
  
  return Math.max(0, 1 - (Math.sqrt(intervalVariance) / avgInterval));
}

function findPeaks(values: number[]): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i-1] && values[i] > values[i+1]) {
      peaks.push(i);
    }
  }
  return peaks;
}

function findTroughs(values: number[]): number[] {
  const troughs: number[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] < values[i-1] && values[i] < values[i+1]) {
      troughs.push(i);
    }
  }
  return troughs;
}

function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - meanX;
    const yDiff = y[i] - meanY;
    numerator += xDiff * yDiff;
    sumXSquared += xDiff * xDiff;
    sumYSquared += yDiff * yDiff;
  }

  const denominator = Math.sqrt(sumXSquared * sumYSquared);
  return denominator !== 0 ? numerator / denominator : 0;
}

function calculateBaseline(data: DataPoint[]): DataPoint[] {
  const windowSize = Math.min(7, Math.floor(data.length / 4));
  const baseline: DataPoint[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(data.length, i + windowSize + 1);
    const window = data.slice(start, end);
    const avgValue = window.reduce((sum, d) => sum + d.value, 0) / window.length;
    
    baseline.push({
      date: data[i].date,
      value: avgValue
    });
  }

  return baseline;
}

function calculateAnomalyStatistics(anomalies: Anomaly[], data: DataPoint[]): AnomalyStatistics {
  const totalAnomalies = anomalies.length;
  const positiveAnomalies = anomalies.filter(a => a.value > a.expectedValue).length;
  const negativeAnomalies = totalAnomalies - positiveAnomalies;
  
  const deviations = anomalies.map(a => Math.abs(a.value - a.expectedValue));
  const averageDeviation = deviations.length > 0 ? deviations.reduce((a, b) => a + b, 0) / deviations.length : 0;
  const maxDeviation = deviations.length > 0 ? Math.max(...deviations) : 0;
  const anomalyRate = data.length > 0 ? totalAnomalies / data.length : 0;

  return {
    totalAnomalies,
    positiveAnomalies,
    negativeAnomalies,
    averageDeviation,
    maxDeviation,
    anomalyRate
  };
}

function generateAnomalyAlerts(anomalies: Anomaly[], metric: string): AnomalyAlert[] {
  return anomalies.map(anomaly => {
    const deviation = Math.abs(anomaly.value - anomaly.expectedValue);
    const percentDeviation = anomaly.expectedValue > 0 ? (deviation / anomaly.expectedValue) * 100 : 0;
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (percentDeviation > 100) severity = 'critical';
    else if (percentDeviation > 50) severity = 'high';
    else if (percentDeviation > 25) severity = 'medium';
    else severity = 'low';

    return {
      date: anomaly.date,
      severity,
      message: `${metric} anomaly: ${anomaly.value.toFixed(2)} vs expected ${anomaly.expectedValue.toFixed(2)}`,
      impact: `${percentDeviation.toFixed(1)}% deviation from expected value`,
      recommendations: generateAnomalyRecommendations(anomaly, severity)
    };
  });
}

function generateAnomalyRecommendations(anomaly: Anomaly, severity: string): string[] {
  const recommendations: string[] = [];
  
  if (severity === 'critical' || severity === 'high') {
    recommendations.push('Investigate immediately to identify root cause');
    recommendations.push('Review all related processes and systems');
  }
  
  if (anomaly.value > anomaly.expectedValue) {
    recommendations.push('Analyze factors that contributed to exceptional performance');
    recommendations.push('Consider scaling successful strategies');
  } else {
    recommendations.push('Identify and address performance issues');
    recommendations.push('Review recent changes that might have impacted results');
  }
  
  return recommendations;
}

function generateAnomalyCauses(value: number, expected: number, date: Date): string[] {
  const causes: string[] = [];
  
  if (value > expected * 1.5) {
    causes.push('Exceptional performance or external boost');
    causes.push('Successful campaign or promotional activity');
    causes.push('Seasonal peak or market opportunity');
  } else if (value < expected * 0.5) {
    causes.push('System outage or operational issue');
    causes.push('Market downturn or competitive pressure');
    causes.push('Process change or resource constraint');
  }
  
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    causes.push('Weekend effect on business metrics');
  }
  
  return causes;
}

function calculateChangePercent(data: DataPoint[]): number {
  if (data.length < 2) return 0;
  
  const first = data[0].value;
  const last = data[data.length - 1].value;
  
  return first !== 0 ? ((last - first) / first) * 100 : 0;
}

async function saveTrendAnalysis(analysis: TrendAnalysis): Promise<void> {
  await db.exec`
    INSERT INTO trend_analysis (id, metric, period, trend_type, slope, correlation,
                                seasonal_factors, anomalies, forecast)
    VALUES (${analysis.id}, ${analysis.metric}, ${analysis.period}, ${analysis.trendType},
            ${analysis.slope}, ${analysis.correlation}, ${JSON.stringify(analysis.seasonalFactors)},
            ${JSON.stringify(analysis.anomalies)}, ${JSON.stringify(analysis.forecast)})
  `;
}

async function getRecentTrendAnalyses(period: string, limit: number): Promise<TrendAnalysis[]> {
  const rows = await db.exec`
    SELECT * FROM trend_analysis 
    WHERE created_at >= NOW() - INTERVAL '1 ${period}'
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `;

  return rows.map(row => ({
    id: row.id,
    metric: row.metric,
    period: row.period,
    trendType: row.trend_type,
    slope: parseFloat(row.slope),
    correlation: parseFloat(row.correlation),
    seasonalFactors: JSON.parse(row.seasonal_factors),
    anomalies: JSON.parse(row.anomalies),
    forecast: JSON.parse(row.forecast),
    createdAt: row.created_at
  }));
}

function generateInsightsFromAnalyses(analyses: TrendAnalysis[]): TrendInsight[] {
  const insights: TrendInsight[] = [];

  const growthMetrics = analyses.filter(a => a.slope > 0.1 && a.correlation > 0.6);
  const declineMetrics = analyses.filter(a => a.slope < -0.1 && a.correlation < -0.6);
  const volatileMetrics = analyses.filter(a => a.anomalies.length > 2);

  growthMetrics.forEach(analysis => {
    insights.push({
      type: 'growth',
      metric: analysis.metric,
      message: `${analysis.metric} shows strong growth trend`,
      confidence: Math.abs(analysis.correlation),
      timeframe: 'current period',
      magnitude: analysis.slope
    });
  });

  declineMetrics.forEach(analysis => {
    insights.push({
      type: 'decline',
      metric: analysis.metric,
      message: `${analysis.metric} shows declining trend`,
      confidence: Math.abs(analysis.correlation),
      timeframe: 'current period',
      magnitude: Math.abs(analysis.slope)
    });
  });

  volatileMetrics.forEach(analysis => {
    insights.push({
      type: 'volatility',
      metric: analysis.metric,
      message: `${analysis.metric} shows high volatility`,
      confidence: 0.8,
      timeframe: 'current period',
      magnitude: analysis.anomalies.length
    });
  });

  return insights;
}

function extractTopPatterns(analyses: TrendAnalysis[]): DetectedPattern[] {
  const allPatterns: DetectedPattern[] = [];

  analyses.forEach(analysis => {
    if (analysis.trendType === 'seasonal') {
      allPatterns.push({
        type: 'seasonal',
        description: `${analysis.metric} shows seasonal pattern`,
        strength: Math.abs(analysis.correlation),
        confidence: Math.abs(analysis.correlation)
      });
    }
  });

  return allPatterns
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);
}

async function getCriticalAnomalies(period: string): Promise<Anomaly[]> {
  const analyses = await getRecentTrendAnalyses(period, 50);
  const criticalAnomalies: Anomaly[] = [];

  analyses.forEach(analysis => {
    const critical = analysis.anomalies.filter(a => a.severity === 'high');
    criticalAnomalies.push(...critical);
  });

  return criticalAnomalies
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
}

function generateRecommendedActions(
  insights: TrendInsight[], 
  patterns: DetectedPattern[], 
  anomalies: Anomaly[]
): string[] {
  const actions: string[] = [];

  const growthInsights = insights.filter(i => i.type === 'growth');
  if (growthInsights.length > 0) {
    actions.push('Capitalize on positive growth trends by scaling successful strategies');
  }

  const declineInsights = insights.filter(i => i.type === 'decline');
  if (declineInsights.length > 0) {
    actions.push('Address declining metrics with immediate corrective actions');
  }

  const seasonalPatterns = patterns.filter(p => p.type === 'seasonal' && p.strength > 0.6);
  if (seasonalPatterns.length > 0) {
    actions.push('Prepare for seasonal variations in performance metrics');
  }

  if (anomalies.length > 0) {
    actions.push('Investigate and resolve root causes of performance anomalies');
  }

  return actions;
}

function generateComparisonInsights(comparisons: TrendComparison[], rankings: EntityRanking[]): ComparisonInsight[] {
  const insights: ComparisonInsight[] = [];

  const topPerformer = rankings[0];
  const bottomPerformer = rankings[rankings.length - 1];
  
  if (topPerformer && bottomPerformer && topPerformer.overallScore > bottomPerformer.overallScore * 1.5) {
    insights.push({
      type: 'performance_gap',
      message: `Significant performance gap between top and bottom performers`,
      affectedEntities: [bottomPerformer.entityId],
      recommendations: [
        'Analyze top performer strategies for replication',
        'Provide additional support to underperforming entities'
      ]
    });
  }

  const improvingEntities = comparisons.filter(c => c.trendDirection === 'up' && c.changePercent > 10);
  if (improvingEntities.length > 0) {
    insights.push({
      type: 'opportunity',
      message: `${improvingEntities.length} entities showing strong improvement`,
      affectedEntities: improvingEntities.map(e => e.entityId),
      recommendations: [
        'Document and share successful improvement strategies',
        'Consider additional resource allocation to maintain momentum'
      ]
    });
  }

  return insights;
}