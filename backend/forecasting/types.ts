export interface ConversionPrediction {
  id: string;
  prospectId: string;
  predictionScore: number;
  confidence: number;
  factors: ConversionFactor[];
  predictedDate?: Date;
  createdAt: Date;
}

export interface ConversionFactor {
  name: string;
  weight: number;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface RevenueForecast {
  id: string;
  clientId?: string;
  agentId?: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  predictedRevenue: number;
  confidence: number;
  trendDirection: 'up' | 'down' | 'stable';
  factors: ForecastFactor[];
  createdAt: Date;
}

export interface ForecastFactor {
  category: string;
  weight: number;
  historicalAverage: number;
  currentTrend: number;
  seasonalAdjustment: number;
}

export interface OutreachTiming {
  id: string;
  prospectId: string;
  recommendedTime: Date;
  channel: 'email' | 'call' | 'linkedin' | 'social';
  probability: number;
  reasoning: string[];
  timeZone: string;
  createdAt: Date;
}

export interface CohortAnalysis {
  id: string;
  cohortName: string;
  startDate: Date;
  endDate: Date;
  totalProspects: number;
  convertedProspects: number;
  conversionRate: number;
  averageTimeToConvert: number;
  totalRevenue: number;
  averageRevenuePerProspect: number;
  retentionRate: number;
  dropoffStages: CohortDropoff[];
  createdAt: Date;
}

export interface CohortDropoff {
  stage: string;
  count: number;
  percentage: number;
}

export interface PerformancePrediction {
  id: string;
  entityType: 'agent' | 'campaign' | 'client';
  entityId: string;
  metric: 'conversion_rate' | 'revenue' | 'response_rate' | 'engagement';
  period: 'week' | 'month' | 'quarter';
  currentValue: number;
  predictedValue: number;
  confidence: number;
  trend: 'improving' | 'declining' | 'stable';
  recommendations: string[];
  createdAt: Date;
}

export interface MLModel {
  id: string;
  name: string;
  type: 'conversion' | 'revenue' | 'timing' | 'performance';
  version: string;
  accuracy: number;
  features: string[];
  trainingData: {
    startDate: Date;
    endDate: Date;
    sampleSize: number;
  };
  isActive: boolean;
  lastTrained: Date;
  createdAt: Date;
}

export interface TrendAnalysis {
  id: string;
  metric: string;
  period: 'daily' | 'weekly' | 'monthly';
  trendType: 'linear' | 'exponential' | 'seasonal' | 'cyclical';
  slope: number;
  correlation: number;
  seasonalFactors: SeasonalFactor[];
  anomalies: Anomaly[];
  forecast: DataPoint[];
  createdAt: Date;
}

export interface SeasonalFactor {
  period: string;
  factor: number;
  confidence: number;
}

export interface Anomaly {
  date: Date;
  value: number;
  expectedValue: number;
  severity: 'low' | 'medium' | 'high';
  possibleCauses: string[];
}

export interface DataPoint {
  date: Date;
  value: number;
  confidence?: number;
}

export interface ModelPerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  mse: number;
  mae: number;
  r2Score: number;
}