import { api } from "encore.dev/api";
import { db } from "./db";
import { CohortAnalysis, CohortDropoff, DataPoint } from "./types";

export interface CreateCohortRequest {
  cohortName: string;
  startDate: Date;
  endDate: Date;
  segmentBy?: 'source' | 'industry' | 'agent' | 'campaign';
  segmentValue?: string;
}

export interface CohortAnalysisResponse {
  cohort: CohortAnalysis;
  conversionFunnel: FunnelStage[];
  retentionCurve: DataPoint[];
  comparison: CohortComparison;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  avgTimeToNext: number;
  dropoffRate: number;
}

export interface CohortComparison {
  previousPeriod?: CohortAnalysis;
  industryBenchmark?: CohortMetrics;
  percentageChange: {
    conversionRate: number;
    revenue: number;
    timeToConvert: number;
  };
}

export interface CohortMetrics {
  conversionRate: number;
  averageRevenue: number;
  averageTimeToConvert: number;
  retentionRate: number;
}

export interface CohortTrendRequest {
  cohortNames?: string[];
  metric: 'conversion_rate' | 'revenue' | 'retention' | 'time_to_convert';
  period: 'monthly' | 'quarterly';
  startDate: Date;
  endDate: Date;
}

export interface CohortTrendResponse {
  trends: CohortTrendData[];
  aggregatedTrend: DataPoint[];
  insights: string[];
}

export interface CohortTrendData {
  cohortName: string;
  trendData: DataPoint[];
  growthRate: number;
  volatility: number;
}

export const createCohortAnalysis = api(
  { method: "POST", path: "/forecasting/cohort/create", expose: true },
  async (req: CreateCohortRequest): Promise<CohortAnalysisResponse> => {
    const cohortData = await generateCohortData(req);
    const cohort = await analyzeCohort(cohortData, req);
    
    await saveCohortAnalysis(cohort);
    
    const conversionFunnel = await buildConversionFunnel(cohortData);
    const retentionCurve = await buildRetentionCurve(cohortData, req.startDate, req.endDate);
    const comparison = await buildCohortComparison(cohort, req);

    return {
      cohort,
      conversionFunnel,
      retentionCurve,
      comparison
    };
  }
);

export const getCohortAnalyses = api(
  { method: "GET", path: "/forecasting/cohort/analyses", expose: true },
  async (): Promise<{ analyses: CohortAnalysis[] }> => {
    const rows = await db.exec`
      SELECT * FROM cohort_analysis 
      ORDER BY created_at DESC 
      LIMIT 50
    `;

    return {
      analyses: rows.map(row => ({
        id: row.id,
        cohortName: row.cohort_name,
        startDate: row.start_date,
        endDate: row.end_date,
        totalProspects: parseInt(row.total_prospects),
        convertedProspects: parseInt(row.converted_prospects),
        conversionRate: parseFloat(row.conversion_rate),
        averageTimeToConvert: parseInt(row.average_time_to_convert),
        totalRevenue: parseFloat(row.total_revenue),
        averageRevenuePerProspect: parseFloat(row.average_revenue_per_prospect),
        retentionRate: parseFloat(row.retention_rate),
        dropoffStages: JSON.parse(row.dropoff_stages),
        createdAt: row.created_at
      }))
    };
  }
);

export const getCohortTrends = api(
  { method: "POST", path: "/forecasting/cohort/trends", expose: true },
  async (req: CohortTrendRequest): Promise<CohortTrendResponse> => {
    const cohortNames = req.cohortNames || await getRecentCohortNames(10);
    const trends: CohortTrendData[] = [];
    
    for (const cohortName of cohortNames) {
      const trendData = await getCohortMetricTrend(cohortName, req.metric, req.period, req.startDate, req.endDate);
      const growthRate = calculateGrowthRate(trendData);
      const volatility = calculateVolatility(trendData);
      
      trends.push({
        cohortName,
        trendData,
        growthRate,
        volatility
      });
    }

    const aggregatedTrend = aggregateCohortTrends(trends);
    const insights = generateCohortInsights(trends, req.metric);

    return {
      trends,
      aggregatedTrend,
      insights
    };
  }
);

export const compareCohorts = api(
  { method: "POST", path: "/forecasting/cohort/compare", expose: true },
  async (req: { cohortIds: string[] }): Promise<{
    cohorts: CohortAnalysis[];
    comparison: {
      bestPerforming: string;
      metrics: Record<string, CohortMetrics>;
      insights: string[];
    };
  }> => {
    const cohorts = await Promise.all(
      req.cohortIds.map(async (id) => {
        const rows = await db.exec`SELECT * FROM cohort_analysis WHERE id = ${id}`;
        if (rows.length === 0) throw new Error(`Cohort ${id} not found`);
        
        const row = rows[0];
        return {
          id: row.id,
          cohortName: row.cohort_name,
          startDate: row.start_date,
          endDate: row.end_date,
          totalProspects: parseInt(row.total_prospects),
          convertedProspects: parseInt(row.converted_prospects),
          conversionRate: parseFloat(row.conversion_rate),
          averageTimeToConvert: parseInt(row.average_time_to_convert),
          totalRevenue: parseFloat(row.total_revenue),
          averageRevenuePerProspect: parseFloat(row.average_revenue_per_prospect),
          retentionRate: parseFloat(row.retention_rate),
          dropoffStages: JSON.parse(row.dropoff_stages),
          createdAt: row.created_at
        };
      })
    );

    const metrics: Record<string, CohortMetrics> = {};
    for (const cohort of cohorts) {
      metrics[cohort.cohortName] = {
        conversionRate: cohort.conversionRate,
        averageRevenue: cohort.averageRevenuePerProspect,
        averageTimeToConvert: cohort.averageTimeToConvert,
        retentionRate: cohort.retentionRate
      };
    }

    const bestPerforming = cohorts.reduce((best, current) => 
      current.conversionRate > best.conversionRate ? current : best
    ).cohortName;

    const insights = generateComparisonInsights(cohorts);

    return {
      cohorts,
      comparison: {
        bestPerforming,
        metrics,
        insights
      }
    };
  }
);

export const predictCohortPerformance = api(
  { method: "POST", path: "/forecasting/cohort/predict", expose: true },
  async (req: {
    cohortName: string;
    forecastPeriods: number;
    baselineMetrics?: CohortMetrics;
  }): Promise<{
    predictions: DataPoint[];
    confidence: number;
    factors: string[];
  }> => {
    const historicalData = await getCohortHistoricalData(req.cohortName);
    const predictions = generateCohortPredictions(historicalData, req.forecastPeriods);
    const confidence = calculatePredictionConfidence(historicalData);
    const factors = identifyPredictionFactors(historicalData, req.baselineMetrics);

    return {
      predictions,
      confidence,
      factors
    };
  }
);

async function generateCohortData(req: CreateCohortRequest): Promise<any[]> {
  let query = `
    SELECT p.*, 
           d.amount as deal_amount,
           d.status as deal_status,
           d.created_at as deal_date,
           EXTRACT(DAYS FROM COALESCE(d.created_at, NOW()) - p.created_at) as time_to_convert
    FROM prospects p
    LEFT JOIN deals d ON p.id = d.prospect_id
    WHERE p.created_at BETWEEN $1 AND $2
  `;

  const params: any[] = [req.startDate, req.endDate];

  if (req.segmentBy && req.segmentValue) {
    query += ` AND p.${req.segmentBy} = $${params.length + 1}`;
    params.push(req.segmentValue);
  }

  query += ` ORDER BY p.created_at`;

  return await db.exec(query, ...params);
}

async function analyzeCohort(cohortData: any[], req: CreateCohortRequest): Promise<CohortAnalysis> {
  const totalProspects = cohortData.length;
  const convertedProspects = cohortData.filter(p => p.deal_status === 'won').length;
  const conversionRate = totalProspects > 0 ? convertedProspects / totalProspects : 0;

  const convertedData = cohortData.filter(p => p.deal_status === 'won');
  const averageTimeToConvert = convertedData.length > 0 
    ? Math.round(convertedData.reduce((sum, p) => sum + (parseFloat(p.time_to_convert) || 0), 0) / convertedData.length)
    : 0;

  const totalRevenue = convertedData.reduce((sum, p) => sum + (parseFloat(p.deal_amount) || 0), 0);
  const averageRevenuePerProspect = totalProspects > 0 ? totalRevenue / totalProspects : 0;

  const retentionRate = calculateRetentionRate(cohortData, req.startDate, req.endDate);
  const dropoffStages = calculateDropoffStages(cohortData);

  return {
    id: crypto.randomUUID(),
    cohortName: req.cohortName,
    startDate: req.startDate,
    endDate: req.endDate,
    totalProspects,
    convertedProspects,
    conversionRate,
    averageTimeToConvert,
    totalRevenue,
    averageRevenuePerProspect,
    retentionRate,
    dropoffStages,
    createdAt: new Date()
  };
}

async function buildConversionFunnel(cohortData: any[]): Promise<FunnelStage[]> {
  const stages = [
    { name: 'Initial Contact', filter: (p: any) => true },
    { name: 'Qualified', filter: (p: any) => p.status === 'qualified' || p.deal_status },
    { name: 'Proposal', filter: (p: any) => p.status === 'proposal' || p.deal_status },
    { name: 'Negotiation', filter: (p: any) => p.status === 'negotiation' || p.deal_status === 'won' },
    { name: 'Converted', filter: (p: any) => p.deal_status === 'won' }
  ];

  const funnel: FunnelStage[] = [];
  let previousCount = cohortData.length;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const stageData = cohortData.filter(stage.filter);
    const count = stageData.length;
    const percentage = cohortData.length > 0 ? (count / cohortData.length) * 100 : 0;
    const dropoffRate = i > 0 ? ((previousCount - count) / previousCount) * 100 : 0;

    const avgTimeToNext = i < stages.length - 1 
      ? calculateAverageTimeToNextStage(stageData, stages[i + 1])
      : 0;

    funnel.push({
      stage: stage.name,
      count,
      percentage,
      avgTimeToNext,
      dropoffRate
    });

    previousCount = count;
  }

  return funnel;
}

async function buildRetentionCurve(cohortData: any[], startDate: Date, endDate: Date): Promise<DataPoint[]> {
  const retentionCurve: DataPoint[] = [];
  const totalProspects = cohortData.length;
  
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const intervals = Math.min(12, Math.max(4, Math.ceil(periodDays / 30)));

  for (let i = 0; i <= intervals; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + (i * periodDays / intervals));

    const activeProspects = cohortData.filter(p => {
      const prospectStart = new Date(p.created_at);
      const lastActivity = p.last_activity ? new Date(p.last_activity) : prospectStart;
      return prospectStart <= checkDate && (lastActivity >= checkDate || p.deal_status === 'won');
    }).length;

    const retentionRate = totalProspects > 0 ? activeProspects / totalProspects : 0;

    retentionCurve.push({
      date: new Date(checkDate),
      value: retentionRate
    });
  }

  return retentionCurve;
}

async function buildCohortComparison(cohort: CohortAnalysis, req: CreateCohortRequest): Promise<CohortComparison> {
  const previousPeriod = await getPreviousPeriodCohort(req);
  const industryBenchmark = await getIndustryBenchmark(req.segmentBy, req.segmentValue);

  const percentageChange = {
    conversionRate: previousPeriod 
      ? ((cohort.conversionRate - previousPeriod.conversionRate) / previousPeriod.conversionRate) * 100
      : 0,
    revenue: previousPeriod
      ? ((cohort.averageRevenuePerProspect - previousPeriod.averageRevenuePerProspect) / previousPeriod.averageRevenuePerProspect) * 100
      : 0,
    timeToConvert: previousPeriod
      ? ((cohort.averageTimeToConvert - previousPeriod.averageTimeToConvert) / previousPeriod.averageTimeToConvert) * 100
      : 0
  };

  return {
    previousPeriod,
    industryBenchmark,
    percentageChange
  };
}

function calculateRetentionRate(cohortData: any[], startDate: Date, endDate: Date): number {
  const totalProspects = cohortData.length;
  if (totalProspects === 0) return 0;

  const midPoint = new Date((startDate.getTime() + endDate.getTime()) / 2);
  
  const retainedProspects = cohortData.filter(p => {
    const lastActivity = p.last_activity ? new Date(p.last_activity) : new Date(p.created_at);
    return lastActivity >= midPoint || p.deal_status === 'won';
  }).length;

  return retainedProspects / totalProspects;
}

function calculateDropoffStages(cohortData: any[]): CohortDropoff[] {
  const totalProspects = cohortData.length;
  if (totalProspects === 0) return [];

  const stages = [
    { name: 'Initial Contact', prospects: cohortData.filter(p => true) },
    { name: 'First Response', prospects: cohortData.filter(p => p.first_response_date) },
    { name: 'Qualified', prospects: cohortData.filter(p => p.status === 'qualified' || p.deal_status) },
    { name: 'Proposal', prospects: cohortData.filter(p => p.status === 'proposal' || p.deal_status) },
    { name: 'Converted', prospects: cohortData.filter(p => p.deal_status === 'won') }
  ];

  const dropoffs: CohortDropoff[] = [];

  for (let i = 0; i < stages.length - 1; i++) {
    const currentStage = stages[i];
    const nextStage = stages[i + 1];
    
    const dropoffCount = currentStage.prospects.length - nextStage.prospects.length;
    const dropoffPercentage = currentStage.prospects.length > 0 
      ? (dropoffCount / currentStage.prospects.length) * 100 
      : 0;

    dropoffs.push({
      stage: `${currentStage.name} → ${nextStage.name}`,
      count: dropoffCount,
      percentage: dropoffPercentage
    });
  }

  return dropoffs;
}

function calculateAverageTimeToNextStage(stageData: any[], nextStage: any): number {
  const transitionData = stageData.filter(nextStage.filter);
  if (transitionData.length === 0) return 0;

  const times = transitionData.map(p => {
    const start = new Date(p.created_at);
    const next = p.qualified_at || p.proposal_at || p.deal_date || new Date();
    return Math.ceil((next.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  });

  return Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
}

async function getPreviousPeriodCohort(req: CreateCohortRequest): Promise<CohortAnalysis | undefined> {
  const periodLength = req.endDate.getTime() - req.startDate.getTime();
  const previousStart = new Date(req.startDate.getTime() - periodLength);
  const previousEnd = new Date(req.endDate.getTime() - periodLength);

  const rows = await db.exec`
    SELECT * FROM cohort_analysis 
    WHERE start_date = ${previousStart} AND end_date = ${previousEnd}
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  if (rows.length === 0) return undefined;

  const row = rows[0];
  return {
    id: row.id,
    cohortName: row.cohort_name,
    startDate: row.start_date,
    endDate: row.end_date,
    totalProspects: parseInt(row.total_prospects),
    convertedProspects: parseInt(row.converted_prospects),
    conversionRate: parseFloat(row.conversion_rate),
    averageTimeToConvert: parseInt(row.average_time_to_convert),
    totalRevenue: parseFloat(row.total_revenue),
    averageRevenuePerProspect: parseFloat(row.average_revenue_per_prospect),
    retentionRate: parseFloat(row.retention_rate),
    dropoffStages: JSON.parse(row.dropoff_stages),
    createdAt: row.created_at
  };
}

async function getIndustryBenchmark(segmentBy?: string, segmentValue?: string): Promise<CohortMetrics | undefined> {
  if (!segmentBy || !segmentValue) return undefined;

  const rows = await db.exec`
    SELECT 
      AVG(conversion_rate) as avg_conversion_rate,
      AVG(average_revenue_per_prospect) as avg_revenue,
      AVG(average_time_to_convert) as avg_time_to_convert,
      AVG(retention_rate) as avg_retention_rate
    FROM cohort_analysis
    WHERE cohort_name LIKE ${`%${segmentValue}%`}
      AND created_at >= NOW() - INTERVAL '12 months'
  `;

  if (rows.length === 0 || !rows[0].avg_conversion_rate) return undefined;

  const row = rows[0];
  return {
    conversionRate: parseFloat(row.avg_conversion_rate),
    averageRevenue: parseFloat(row.avg_revenue),
    averageTimeToConvert: parseInt(row.avg_time_to_convert),
    retentionRate: parseFloat(row.avg_retention_rate)
  };
}

async function getRecentCohortNames(limit: number): Promise<string[]> {
  const rows = await db.exec`
    SELECT DISTINCT cohort_name 
    FROM cohort_analysis 
    ORDER BY MAX(created_at) DESC 
    LIMIT ${limit}
  `;

  return rows.map(row => row.cohort_name);
}

async function getCohortMetricTrend(
  cohortName: string, 
  metric: string, 
  period: string, 
  startDate: Date, 
  endDate: Date
): Promise<DataPoint[]> {
  const metricColumn = metric === 'conversion_rate' ? 'conversion_rate'
    : metric === 'revenue' ? 'average_revenue_per_prospect'
    : metric === 'retention' ? 'retention_rate'
    : 'average_time_to_convert';

  const rows = await db.exec`
    SELECT 
      start_date,
      ${metricColumn} as metric_value
    FROM cohort_analysis
    WHERE cohort_name = ${cohortName}
      AND start_date BETWEEN ${startDate} AND ${endDate}
    ORDER BY start_date
  `;

  return rows.map(row => ({
    date: new Date(row.start_date),
    value: parseFloat(row.metric_value) || 0
  }));
}

function calculateGrowthRate(data: DataPoint[]): number {
  if (data.length < 2) return 0;
  
  const first = data[0].value;
  const last = data[data.length - 1].value;
  
  return first > 0 ? ((last - first) / first) * 100 : 0;
}

function calculateVolatility(data: DataPoint[]): number {
  if (data.length < 2) return 0;
  
  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return mean > 0 ? Math.sqrt(variance) / mean : 0;
}

function aggregateCohortTrends(trends: CohortTrendData[]): DataPoint[] {
  if (trends.length === 0) return [];

  const dateValueMap: Map<string, number[]> = new Map();

  trends.forEach(trend => {
    trend.trendData.forEach(point => {
      const dateKey = point.date.toISOString().slice(0, 10);
      if (!dateValueMap.has(dateKey)) {
        dateValueMap.set(dateKey, []);
      }
      dateValueMap.get(dateKey)!.push(point.value);
    });
  });

  const aggregated: DataPoint[] = [];
  for (const [dateKey, values] of dateValueMap) {
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    aggregated.push({
      date: new Date(dateKey),
      value: avgValue
    });
  }

  return aggregated.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function generateCohortInsights(trends: CohortTrendData[], metric: string): string[] {
  const insights: string[] = [];

  const bestTrend = trends.reduce((best, current) => 
    current.growthRate > best.growthRate ? current : best
  );

  const worstTrend = trends.reduce((worst, current) => 
    current.growthRate < worst.growthRate ? current : worst
  );

  if (bestTrend.growthRate > 10) {
    insights.push(`${bestTrend.cohortName} shows exceptional ${metric} growth at ${bestTrend.growthRate.toFixed(1)}%`);
  }

  if (worstTrend.growthRate < -10) {
    insights.push(`${worstTrend.cohortName} shows concerning ${metric} decline at ${worstTrend.growthRate.toFixed(1)}%`);
  }

  const avgGrowthRate = trends.reduce((sum, trend) => sum + trend.growthRate, 0) / trends.length;
  if (avgGrowthRate > 5) {
    insights.push(`Overall positive trend in ${metric} with ${avgGrowthRate.toFixed(1)}% average growth`);
  } else if (avgGrowthRate < -5) {
    insights.push(`Overall declining trend in ${metric} with ${avgGrowthRate.toFixed(1)}% average decline`);
  }

  const highVolatilityCohorts = trends.filter(t => t.volatility > 0.3);
  if (highVolatilityCohorts.length > 0) {
    insights.push(`High volatility detected in ${highVolatilityCohorts.map(c => c.cohortName).join(', ')}`);
  }

  return insights;
}

function generateComparisonInsights(cohorts: CohortAnalysis[]): string[] {
  const insights: string[] = [];

  const conversionRates = cohorts.map(c => c.conversionRate);
  const revenues = cohorts.map(c => c.averageRevenuePerProspect);
  const times = cohorts.map(c => c.averageTimeToConvert);

  const maxConversion = Math.max(...conversionRates);
  const minConversion = Math.min(...conversionRates);
  const conversionVariance = maxConversion - minConversion;

  if (conversionVariance > 0.2) {
    insights.push(`Significant conversion rate variance: ${(conversionVariance * 100).toFixed(1)}% difference between best and worst performing cohorts`);
  }

  const maxRevenue = Math.max(...revenues);
  const minRevenue = Math.min(...revenues);
  const revenueVariance = maxRevenue - minRevenue;

  if (revenueVariance > maxRevenue * 0.3) {
    insights.push(`High revenue variance: $${revenueVariance.toFixed(2)} difference in average revenue per prospect`);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  if (avgTime > 60) {
    insights.push(`Extended conversion cycles detected: ${avgTime.toFixed(0)} days average time to convert`);
  }

  return insights;
}

async function getCohortHistoricalData(cohortName: string): Promise<DataPoint[]> {
  const rows = await db.exec`
    SELECT start_date, conversion_rate
    FROM cohort_analysis
    WHERE cohort_name = ${cohortName}
    ORDER BY start_date
    LIMIT 24
  `;

  return rows.map(row => ({
    date: new Date(row.start_date),
    value: parseFloat(row.conversion_rate)
  }));
}

function generateCohortPredictions(historicalData: DataPoint[], periods: number): DataPoint[] {
  if (historicalData.length < 3) return [];

  const predictions: DataPoint[] = [];
  const lastPoint = historicalData[historicalData.length - 1];
  
  const values = historicalData.map(d => d.value);
  const trend = calculateLinearTrend(values);
  const seasonality = detectSeasonality(historicalData);

  for (let i = 1; i <= periods; i++) {
    const futureDate = new Date(lastPoint.date);
    futureDate.setMonth(futureDate.getMonth() + i);
    
    let predictedValue = lastPoint.value + trend * i;
    
    if (seasonality) {
      const seasonalFactor = getSeasonalFactor(futureDate, historicalData);
      predictedValue *= seasonalFactor;
    }
    
    predictions.push({
      date: futureDate,
      value: Math.max(predictedValue, 0),
      confidence: Math.max(0.9 - i * 0.1, 0.3)
    });
  }

  return predictions;
}

function calculateLinearTrend(values: number[]): number {
  const n = values.length;
  const x = Array.from({length: n}, (_, i) => i);
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function detectSeasonality(data: DataPoint[]): boolean {
  return data.length >= 12;
}

function getSeasonalFactor(date: Date, historicalData: DataPoint[]): number {
  const month = date.getMonth();
  const sameMonthData = historicalData.filter(d => d.date.getMonth() === month);
  
  if (sameMonthData.length === 0) return 1;
  
  const monthAvg = sameMonthData.reduce((sum, d) => sum + d.value, 0) / sameMonthData.length;
  const overallAvg = historicalData.reduce((sum, d) => sum + d.value, 0) / historicalData.length;
  
  return overallAvg > 0 ? monthAvg / overallAvg : 1;
}

function calculatePredictionConfidence(historicalData: DataPoint[]): number {
  if (historicalData.length < 3) return 0.3;
  
  const dataQuality = Math.min(historicalData.length / 12, 1);
  const volatility = calculateVolatility(historicalData);
  const stability = Math.max(0, 1 - volatility);
  
  return dataQuality * 0.5 + stability * 0.5;
}

function identifyPredictionFactors(historicalData: DataPoint[], baseline?: CohortMetrics): string[] {
  const factors: string[] = [];
  
  if (historicalData.length >= 6) {
    factors.push("Sufficient historical data for reliable predictions");
  } else {
    factors.push("Limited historical data - predictions have higher uncertainty");
  }
  
  const trend = calculateLinearTrend(historicalData.map(d => d.value));
  if (trend > 0.01) {
    factors.push("Positive growth trend detected");
  } else if (trend < -0.01) {
    factors.push("Declining trend detected");
  }
  
  const volatility = calculateVolatility(historicalData);
  if (volatility > 0.3) {
    factors.push("High volatility may affect prediction accuracy");
  }
  
  if (baseline) {
    const avgValue = historicalData.reduce((sum, d) => sum + d.value, 0) / historicalData.length;
    if (avgValue > baseline.conversionRate * 1.1) {
      factors.push("Performance above industry benchmark");
    } else if (avgValue < baseline.conversionRate * 0.9) {
      factors.push("Performance below industry benchmark");
    }
  }
  
  return factors;
}

async function saveCohortAnalysis(cohort: CohortAnalysis): Promise<void> {
  await db.exec`
    INSERT INTO cohort_analysis (id, cohort_name, start_date, end_date, total_prospects,
                                 converted_prospects, conversion_rate, average_time_to_convert,
                                 total_revenue, average_revenue_per_prospect, retention_rate, dropoff_stages)
    VALUES (${cohort.id}, ${cohort.cohortName}, ${cohort.startDate}, ${cohort.endDate},
            ${cohort.totalProspects}, ${cohort.convertedProspects}, ${cohort.conversionRate},
            ${cohort.averageTimeToConvert}, ${cohort.totalRevenue}, ${cohort.averageRevenuePerProspect},
            ${cohort.retentionRate}, ${JSON.stringify(cohort.dropoffStages)})
  `;
}