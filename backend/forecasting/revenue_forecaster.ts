import { api } from "encore.dev/api";
import { db } from "./db";
import { RevenueForecast, ForecastFactor, TrendAnalysis, DataPoint, SeasonalFactor, Anomaly } from "./types";

export interface GenerateRevenueForecastRequest {
  period: 'monthly' | 'quarterly' | 'yearly';
  clientId?: string;
  agentId?: string;
  startDate: Date;
  endDate: Date;
  includeSeasonality?: boolean;
}

export interface RevenueForecastResponse {
  forecast: RevenueForecast;
  trendAnalysis: TrendAnalysis;
  seasonalFactors: SeasonalFactor[];
  riskFactors: string[];
}

export interface RevenueAnalyticsRequest {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  groupBy?: 'agent' | 'client' | 'campaign';
}

export interface RevenueAnalyticsResponse {
  historicalData: DataPoint[];
  trends: TrendAnalysis[];
  anomalies: Anomaly[];
  projections: DataPoint[];
  growthRate: number;
  volatility: number;
}

export const generateRevenueForecast = api(
  { method: "POST", path: "/forecasting/revenue/forecast", expose: true },
  async (req: GenerateRevenueForecastRequest): Promise<RevenueForecastResponse> => {
    const historicalData = await getHistoricalRevenueData(req);
    const trendAnalysis = await analyzeTrends(historicalData, req.period);
    const seasonalFactors = req.includeSeasonality ? await analyzeSeasonality(historicalData) : [];
    
    const forecast = await generateForecast(historicalData, trendAnalysis, seasonalFactors, req);
    await saveForecast(forecast);
    
    const riskFactors = identifyRiskFactors(trendAnalysis, historicalData);

    return {
      forecast,
      trendAnalysis,
      seasonalFactors,
      riskFactors
    };
  }
);

export const getRevenueAnalytics = api(
  { method: "POST", path: "/forecasting/revenue/analytics", expose: true },
  async (req: RevenueAnalyticsRequest): Promise<RevenueAnalyticsResponse> => {
    const historicalData = await getRevenueAnalyticsData(req);
    const trends = await analyzeTrendsByPeriod(historicalData, req.period);
    const anomalies = detectAnomalies(historicalData);
    const projections = generateProjections(historicalData, trends[0]);
    
    const growthRate = calculateGrowthRate(historicalData);
    const volatility = calculateVolatility(historicalData);

    return {
      historicalData,
      trends,
      anomalies,
      projections,
      growthRate,
      volatility
    };
  }
);

export const getRevenueForecasts = api(
  { method: "GET", path: "/forecasting/revenue/forecasts", expose: true },
  async (): Promise<{ forecasts: RevenueForecast[] }> => {
    const rows = await db.exec`
      SELECT * FROM revenue_forecasts 
      ORDER BY created_at DESC 
      LIMIT 50
    `;

    return {
      forecasts: rows.map(row => ({
        id: row.id,
        clientId: row.client_id,
        agentId: row.agent_id,
        period: row.period,
        startDate: row.start_date,
        endDate: row.end_date,
        predictedRevenue: parseFloat(row.predicted_revenue),
        confidence: parseFloat(row.confidence),
        trendDirection: row.trend_direction,
        factors: JSON.parse(row.factors),
        createdAt: row.created_at
      }))
    };
  }
);

export const compareForecasts = api(
  { method: "POST", path: "/forecasting/revenue/compare", expose: true },
  async (req: { forecastIds: string[] }): Promise<{
    forecasts: RevenueForecast[];
    comparison: {
      averageRevenue: number;
      revenueRange: { min: number; max: number };
      confidenceRange: { min: number; max: number };
      consensusTrend: string;
    };
  }> => {
    const forecasts = await Promise.all(
      req.forecastIds.map(async (id) => {
        const rows = await db.exec`SELECT * FROM revenue_forecasts WHERE id = ${id}`;
        if (rows.length === 0) throw new Error(`Forecast ${id} not found`);
        
        const row = rows[0];
        return {
          id: row.id,
          clientId: row.client_id,
          agentId: row.agent_id,
          period: row.period,
          startDate: row.start_date,
          endDate: row.end_date,
          predictedRevenue: parseFloat(row.predicted_revenue),
          confidence: parseFloat(row.confidence),
          trendDirection: row.trend_direction,
          factors: JSON.parse(row.factors),
          createdAt: row.created_at
        };
      })
    );

    const revenues = forecasts.map(f => f.predictedRevenue);
    const confidences = forecasts.map(f => f.confidence);
    const trends = forecasts.map(f => f.trendDirection);

    const averageRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const revenueRange = { min: Math.min(...revenues), max: Math.max(...revenues) };
    const confidenceRange = { min: Math.min(...confidences), max: Math.max(...confidences) };
    
    const trendCounts = trends.reduce((acc, trend) => {
      acc[trend] = (acc[trend] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const consensusTrend = Object.entries(trendCounts)
      .sort(([,a], [,b]) => b - a)[0][0];

    return {
      forecasts,
      comparison: {
        averageRevenue,
        revenueRange,
        confidenceRange,
        consensusTrend
      }
    };
  }
);

async function getHistoricalRevenueData(req: GenerateRevenueForecastRequest): Promise<DataPoint[]> {
  const lookbackMonths = req.period === 'yearly' ? 36 : req.period === 'quarterly' ? 12 : 6;
  
  let query = `
    SELECT DATE_TRUNC('month', d.created_at) as period,
           SUM(d.amount) as revenue
    FROM deals d
    WHERE d.status = 'won' 
      AND d.created_at >= NOW() - INTERVAL '${lookbackMonths} months'
  `;

  const params: any[] = [];
  
  if (req.clientId) {
    query += ` AND d.client_id = $${params.length + 1}`;
    params.push(req.clientId);
  }
  
  if (req.agentId) {
    query += ` AND d.agent_id = $${params.length + 1}`;
    params.push(req.agentId);
  }
  
  query += ` GROUP BY DATE_TRUNC('month', d.created_at) ORDER BY period`;

  const rows = await db.exec(query, ...params);
  
  return rows.map(row => ({
    date: new Date(row.period),
    value: parseFloat(row.revenue) || 0
  }));
}

async function getRevenueAnalyticsData(req: RevenueAnalyticsRequest): Promise<DataPoint[]> {
  const truncFunction = req.period === 'daily' ? 'day' : req.period === 'weekly' ? 'week' : 'month';
  
  let query = `
    SELECT DATE_TRUNC('${truncFunction}', d.created_at) as period,
           SUM(d.amount) as revenue
    FROM deals d
    WHERE d.status = 'won' 
      AND d.created_at BETWEEN $1 AND $2
  `;

  const params: any[] = [req.startDate, req.endDate];
  
  if (req.groupBy === 'agent') {
    query += `, d.agent_id GROUP BY DATE_TRUNC('${truncFunction}', d.created_at), d.agent_id`;
  } else if (req.groupBy === 'client') {
    query += `, d.client_id GROUP BY DATE_TRUNC('${truncFunction}', d.created_at), d.client_id`;
  } else {
    query += ` GROUP BY DATE_TRUNC('${truncFunction}', d.created_at)`;
  }
  
  query += ` ORDER BY period`;

  const rows = await db.exec(query, ...params);
  
  return rows.map(row => ({
    date: new Date(row.period),
    value: parseFloat(row.revenue) || 0
  }));
}

async function analyzeTrends(data: DataPoint[], period: string): Promise<TrendAnalysis> {
  if (data.length < 3) {
    throw new Error("Insufficient data for trend analysis");
  }

  const trendType = detectTrendType(data);
  const slope = calculateSlope(data);
  const correlation = calculateCorrelation(data);
  const anomalies = detectAnomalies(data);
  const forecast = generateProjections(data, null);

  const trendAnalysis: TrendAnalysis = {
    id: crypto.randomUUID(),
    metric: 'revenue',
    period: period as any,
    trendType,
    slope,
    correlation,
    seasonalFactors: [],
    anomalies,
    forecast,
    createdAt: new Date()
  };

  await saveTrendAnalysis(trendAnalysis);
  return trendAnalysis;
}

async function analyzeTrendsByPeriod(data: DataPoint[], period: string): Promise<TrendAnalysis[]> {
  const analysis = await analyzeTrends(data, period);
  return [analysis];
}

async function analyzeSeasonality(data: DataPoint[]): Promise<SeasonalFactor[]> {
  if (data.length < 12) {
    return [];
  }

  const monthlyFactors: Record<number, number[]> = {};
  
  data.forEach(point => {
    const month = point.date.getMonth();
    if (!monthlyFactors[month]) {
      monthlyFactors[month] = [];
    }
    monthlyFactors[month].push(point.value);
  });

  const overall_average = data.reduce((sum, point) => sum + point.value, 0) / data.length;
  
  const factors: SeasonalFactor[] = [];
  
  for (let month = 0; month < 12; month++) {
    if (monthlyFactors[month] && monthlyFactors[month].length > 0) {
      const monthAverage = monthlyFactors[month].reduce((a, b) => a + b, 0) / monthlyFactors[month].length;
      const factor = overall_average > 0 ? monthAverage / overall_average : 1;
      
      factors.push({
        period: new Date(2024, month).toLocaleString('default', { month: 'long' }),
        factor,
        confidence: Math.min(monthlyFactors[month].length / 3, 1)
      });
    }
  }

  return factors;
}

async function generateForecast(
  historicalData: DataPoint[],
  trendAnalysis: TrendAnalysis,
  seasonalFactors: SeasonalFactor[],
  req: GenerateRevenueForecastRequest
): Promise<RevenueForecast> {
  const baseRevenue = calculateBaseRevenue(historicalData, req.period);
  const trendAdjustment = applyTrendAdjustment(baseRevenue, trendAnalysis, req.period);
  const seasonalAdjustment = applySeasonalAdjustment(trendAdjustment, seasonalFactors, req.startDate);
  
  const predictedRevenue = Math.max(seasonalAdjustment, 0);
  const confidence = calculateForecastConfidence(historicalData, trendAnalysis);
  const trendDirection = determineTrendDirection(trendAnalysis.slope);
  
  const factors: ForecastFactor[] = [
    {
      category: 'Historical Average',
      weight: 0.4,
      historicalAverage: baseRevenue,
      currentTrend: trendAdjustment - baseRevenue,
      seasonalAdjustment: seasonalAdjustment - trendAdjustment
    },
    {
      category: 'Market Trend',
      weight: 0.3,
      historicalAverage: 0,
      currentTrend: trendAnalysis.slope,
      seasonalAdjustment: 0
    },
    {
      category: 'Pipeline Health',
      weight: 0.3,
      historicalAverage: await getPipelineHealth(req.clientId, req.agentId),
      currentTrend: 0,
      seasonalAdjustment: 0
    }
  ];

  return {
    id: crypto.randomUUID(),
    clientId: req.clientId,
    agentId: req.agentId,
    period: req.period,
    startDate: req.startDate,
    endDate: req.endDate,
    predictedRevenue,
    confidence,
    trendDirection,
    factors,
    createdAt: new Date()
  };
}

function detectTrendType(data: DataPoint[]): 'linear' | 'exponential' | 'seasonal' | 'cyclical' {
  const values = data.map(d => d.value);
  const linearCorr = Math.abs(calculateLinearCorrelation(values));
  const exponentialCorr = Math.abs(calculateExponentialCorrelation(values));
  
  if (exponentialCorr > linearCorr && exponentialCorr > 0.7) return 'exponential';
  if (linearCorr > 0.6) return 'linear';
  if (detectSeasonality(data)) return 'seasonal';
  return 'cyclical';
}

function calculateSlope(data: DataPoint[]): number {
  const n = data.length;
  const sumX = data.reduce((sum, _, i) => sum + i, 0);
  const sumY = data.reduce((sum, point) => sum + point.value, 0);
  const sumXY = data.reduce((sum, point, i) => sum + i * point.value, 0);
  const sumXX = data.reduce((sum, _, i) => sum + i * i, 0);
  
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function calculateCorrelation(data: DataPoint[]): number {
  const values = data.map(d => d.value);
  return calculateLinearCorrelation(values);
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

function calculateExponentialCorrelation(values: number[]): number {
  const logValues = values.filter(v => v > 0).map(v => Math.log(v));
  return logValues.length > 0 ? calculateLinearCorrelation(logValues) : 0;
}

function detectSeasonality(data: DataPoint[]): boolean {
  if (data.length < 12) return false;
  
  const monthlyValues: Record<number, number[]> = {};
  data.forEach(point => {
    const month = point.date.getMonth();
    if (!monthlyValues[month]) monthlyValues[month] = [];
    monthlyValues[month].push(point.value);
  });
  
  const monthlyAverages = Object.values(monthlyValues)
    .filter(arr => arr.length > 0)
    .map(arr => arr.reduce((a, b) => a + b, 0) / arr.length);
  
  const overallAverage = monthlyAverages.reduce((a, b) => a + b, 0) / monthlyAverages.length;
  const variance = monthlyAverages.reduce((sum, avg) => sum + Math.pow(avg - overallAverage, 2), 0) / monthlyAverages.length;
  const coefficient = Math.sqrt(variance) / overallAverage;
  
  return coefficient > 0.3;
}

function detectAnomalies(data: DataPoint[]): Anomaly[] {
  if (data.length < 5) return [];
  
  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
  
  const anomalies: Anomaly[] = [];
  const threshold = 2 * stdDev;
  
  data.forEach(point => {
    const deviation = Math.abs(point.value - mean);
    if (deviation > threshold) {
      anomalies.push({
        date: point.date,
        value: point.value,
        expectedValue: mean,
        severity: deviation > 3 * stdDev ? 'high' : deviation > 2.5 * stdDev ? 'medium' : 'low',
        possibleCauses: generateAnomalyCauses(point.value, mean)
      });
    }
  });
  
  return anomalies;
}

function generateProjections(historicalData: DataPoint[], trendAnalysis: TrendAnalysis | null): DataPoint[] {
  if (historicalData.length === 0) return [];
  
  const lastPoint = historicalData[historicalData.length - 1];
  const slope = trendAnalysis?.slope || calculateSlope(historicalData);
  const projections: DataPoint[] = [];
  
  for (let i = 1; i <= 6; i++) {
    const futureDate = new Date(lastPoint.date);
    futureDate.setMonth(futureDate.getMonth() + i);
    
    const projectedValue = Math.max(lastPoint.value + slope * i, 0);
    const confidence = Math.max(0.9 - i * 0.1, 0.3);
    
    projections.push({
      date: futureDate,
      value: projectedValue,
      confidence
    });
  }
  
  return projections;
}

function calculateBaseRevenue(data: DataPoint[], period: string): number {
  if (data.length === 0) return 0;
  
  const recentData = data.slice(-3);
  const average = recentData.reduce((sum, point) => sum + point.value, 0) / recentData.length;
  
  if (period === 'quarterly') return average * 3;
  if (period === 'yearly') return average * 12;
  return average;
}

function applyTrendAdjustment(baseRevenue: number, trendAnalysis: TrendAnalysis, period: string): number {
  const periods = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 12;
  const trendAdjustment = trendAnalysis.slope * periods;
  
  return baseRevenue + trendAdjustment;
}

function applySeasonalAdjustment(revenue: number, seasonalFactors: SeasonalFactor[], startDate: Date): number {
  if (seasonalFactors.length === 0) return revenue;
  
  const month = startDate.getMonth();
  const monthName = startDate.toLocaleString('default', { month: 'long' });
  const factor = seasonalFactors.find(f => f.period === monthName);
  
  return factor ? revenue * factor.factor : revenue;
}

function calculateForecastConfidence(data: DataPoint[], trendAnalysis: TrendAnalysis): number {
  const dataQuality = Math.min(data.length / 12, 1);
  const trendStrength = Math.abs(trendAnalysis.correlation);
  const volatility = calculateVolatility(data);
  const stabilityFactor = Math.max(0, 1 - volatility);
  
  return (dataQuality * 0.3 + trendStrength * 0.4 + stabilityFactor * 0.3);
}

function determineTrendDirection(slope: number): 'up' | 'down' | 'stable' {
  if (slope > 0.1) return 'up';
  if (slope < -0.1) return 'down';
  return 'stable';
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

async function getPipelineHealth(clientId?: string, agentId?: string): Promise<number> {
  let query = `
    SELECT COUNT(*) as total_prospects,
           COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
           COUNT(CASE WHEN status = 'proposal' THEN 1 END) as in_proposal,
           AVG(EXTRACT(DAYS FROM NOW() - created_at)) as avg_age
    FROM prospects
    WHERE 1=1
  `;

  const params: any[] = [];
  
  if (clientId) {
    query += ` AND client_id = $${params.length + 1}`;
    params.push(clientId);
  }
  
  if (agentId) {
    query += ` AND agent_id = $${params.length + 1}`;
    params.push(agentId);
  }

  const rows = await db.exec(query, ...params);
  
  if (rows.length === 0) return 0.5;
  
  const row = rows[0];
  const qualificationRate = parseInt(row.total_prospects) > 0 ? parseInt(row.qualified) / parseInt(row.total_prospects) : 0;
  const proposalRate = parseInt(row.total_prospects) > 0 ? parseInt(row.in_proposal) / parseInt(row.total_prospects) : 0;
  const ageFactor = Math.max(0, 1 - (parseFloat(row.avg_age) || 0) / 90);
  
  return (qualificationRate * 0.4 + proposalRate * 0.4 + ageFactor * 0.2);
}

function identifyRiskFactors(trendAnalysis: TrendAnalysis, data: DataPoint[]): string[] {
  const risks: string[] = [];
  
  if (trendAnalysis.slope < -0.2) {
    risks.push("Declining revenue trend detected");
  }
  
  if (Math.abs(trendAnalysis.correlation) < 0.4) {
    risks.push("High volatility in revenue patterns");
  }
  
  if (trendAnalysis.anomalies.length > data.length * 0.2) {
    risks.push("Frequent anomalies indicate unpredictable performance");
  }
  
  const recentData = data.slice(-3);
  const recentAverage = recentData.reduce((sum, point) => sum + point.value, 0) / recentData.length;
  const overallAverage = data.reduce((sum, point) => sum + point.value, 0) / data.length;
  
  if (recentAverage < overallAverage * 0.8) {
    risks.push("Recent performance below historical average");
  }
  
  return risks;
}

function generateAnomalyCauses(value: number, expected: number): string[] {
  const causes: string[] = [];
  
  if (value > expected * 1.5) {
    causes.push("Exceptional sales performance or large deal closure");
    causes.push("Seasonal surge or promotional campaign success");
  } else if (value < expected * 0.5) {
    causes.push("Market downturn or competitive pressure");
    causes.push("Operational issues or resource constraints");
  }
  
  return causes;
}

async function saveForecast(forecast: RevenueForecast): Promise<void> {
  await db.exec`
    INSERT INTO revenue_forecasts (id, client_id, agent_id, period, start_date, end_date, 
                                   predicted_revenue, confidence, trend_direction, factors)
    VALUES (${forecast.id}, ${forecast.clientId}, ${forecast.agentId}, ${forecast.period},
            ${forecast.startDate}, ${forecast.endDate}, ${forecast.predictedRevenue},
            ${forecast.confidence}, ${forecast.trendDirection}, ${JSON.stringify(forecast.factors)})
  `;
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