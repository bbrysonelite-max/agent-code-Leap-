import { useState, useEffect } from 'react';
import backend from '~backend/client';

interface ConversionPrediction {
  id: string;
  prospectId: string;
  predictionScore: number;
  confidence: number;
  factors: ConversionFactor[];
  predictedDate?: Date;
  createdAt: Date;
}

interface ConversionFactor {
  name: string;
  weight: number;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
}

interface RevenueForecast {
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

interface ForecastFactor {
  category: string;
  weight: number;
  historicalAverage: number;
  currentTrend: number;
  seasonalAdjustment: number;
}

interface OutreachTiming {
  id: string;
  prospectId: string;
  recommendedTime: Date;
  channel: 'email' | 'call' | 'linkedin' | 'social';
  probability: number;
  reasoning: string[];
  timeZone: string;
  createdAt: Date;
}

interface CohortAnalysis {
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

interface CohortDropoff {
  stage: string;
  count: number;
  percentage: number;
}

interface PerformancePrediction {
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

interface UseConversionPredictionParams {
  prospectId?: string;
  features?: Record<string, any>;
}

interface UseRevenueForecastParams {
  period: 'monthly' | 'quarterly' | 'yearly';
  clientId?: string;
  agentId?: string;
  includeSeasonality?: boolean;
}

interface UseOptimalTimingParams {
  prospectId?: string;
  channels?: ('email' | 'call' | 'linkedin' | 'social')[];
  timeWindow?: {
    startHour: number;
    endHour: number;
  };
}

interface UseCohortAnalysisParams {
  cohortName?: string;
  segmentBy?: 'source' | 'industry' | 'agent' | 'campaign';
  segmentValue?: string;
}

interface UsePerformancePredictionParams {
  entityType?: 'agent' | 'campaign' | 'client';
  entityId?: string;
  metrics?: ('conversion_rate' | 'revenue' | 'response_rate' | 'engagement')[];
  period?: 'week' | 'month' | 'quarter';
}

export const useConversionPrediction = (params?: UseConversionPredictionParams) => {
  const [predictions, setPredictions] = useState<ConversionPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predictConversion = async (prospectId: string, features?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.predictConversion({
        prospectId,
        features
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to predict conversion');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const batchPredict = async (prospectIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.batchPredictConversion({
        prospectIds
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to batch predict');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadPredictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.getConversionPredictions();
      setPredictions(result.predictions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, []);

  return {
    predictions,
    loading,
    error,
    predictConversion,
    batchPredict,
    reload: loadPredictions
  };
};

export const useRevenueForecast = (params?: UseRevenueForecastParams) => {
  const [forecasts, setForecasts] = useState<RevenueForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateForecast = async (params: UseRevenueForecastParams & { startDate: Date; endDate: Date }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.generateRevenueForecast(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate forecast');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAnalytics = async (params: {
    period: 'daily' | 'weekly' | 'monthly';
    startDate: Date;
    endDate: Date;
    groupBy?: 'agent' | 'client' | 'campaign';
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.getRevenueAnalytics(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get analytics');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadForecasts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.getRevenueForecasts();
      setForecasts(result.forecasts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecasts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecasts();
  }, []);

  return {
    forecasts,
    loading,
    error,
    generateForecast,
    getAnalytics,
    reload: loadForecasts
  };
};

export const useOptimalTiming = (params?: UseOptimalTimingParams) => {
  const [timingRecommendations, setTimingRecommendations] = useState<OutreachTiming[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predictTiming = async (params: UseOptimalTimingParams & { prospectId: string }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.predictOptimalTiming(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to predict timing');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const bulkPredictTiming = async (params: {
    prospectIds: string[];
    channels: ('email' | 'call' | 'linkedin' | 'social')[];
    priority?: 'high' | 'medium' | 'low';
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.bulkPredictTiming(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk predict timing');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.getTimingAnalytics();
      setTimingRecommendations(result.recentRecommendations || []);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get timing analytics');
    } finally {
      setLoading(false);
    }
  };

  const provideFeedback = async (params: {
    timingId: string;
    actualEngagement: boolean;
    responseTime?: number;
    channelUsed: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.updateEngagementFeedback(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to provide feedback');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAnalytics();
  }, []);

  return {
    timingRecommendations,
    loading,
    error,
    predictTiming,
    bulkPredictTiming,
    getAnalytics,
    provideFeedback
  };
};

export const useCohortAnalysis = (params?: UseCohortAnalysisParams) => {
  const [cohorts, setCohorts] = useState<CohortAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCohort = async (params: {
    cohortName: string;
    startDate: Date;
    endDate: Date;
    segmentBy?: 'source' | 'industry' | 'agent' | 'campaign';
    segmentValue?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.createCohortAnalysis(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cohort');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTrends = async (params: {
    cohortNames?: string[];
    metric: 'conversion_rate' | 'revenue' | 'retention' | 'time_to_convert';
    period: 'monthly' | 'quarterly';
    startDate: Date;
    endDate: Date;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.getCohortTrends(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get trends');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const compareCohorts = async (cohortIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.compareCohorts({ cohortIds });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare cohorts');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const predictPerformance = async (params: {
    cohortName: string;
    forecastPeriods: number;
    baselineMetrics?: {
      conversionRate: number;
      averageRevenue: number;
      averageTimeToConvert: number;
      retentionRate: number;
    };
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.predictCohortPerformance(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to predict performance');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadCohorts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.getCohortAnalyses();
      setCohorts(result.analyses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCohorts();
  }, []);

  return {
    cohorts,
    loading,
    error,
    createCohort,
    getTrends,
    compareCohorts,
    predictPerformance,
    reload: loadCohorts
  };
};

export const usePerformancePrediction = (params?: UsePerformancePredictionParams) => {
  const [predictions, setPredictions] = useState<PerformancePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predictPerformance = async (params: {
    entityType: 'agent' | 'campaign' | 'client';
    entityId: string;
    metrics: ('conversion_rate' | 'revenue' | 'response_rate' | 'engagement')[];
    period: 'week' | 'month' | 'quarter';
    forecastPeriods?: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.predictPerformance(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to predict performance');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const bulkPredictPerformance = async (params: {
    entities: Array<{
      entityType: 'agent' | 'campaign' | 'client';
      entityId: string;
    }>;
    metric: 'conversion_rate' | 'revenue' | 'response_rate' | 'engagement';
    period: 'week' | 'month' | 'quarter';
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.bulkPredictPerformance(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk predict performance');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAnalytics = async (params: {
    entityType: 'agent' | 'campaign' | 'client';
    metric: string;
    period: 'week' | 'month' | 'quarter';
    startDate: Date;
    endDate: Date;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.getPerformanceAnalytics(params);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get analytics');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadPredictions = async (filters?: {
    entityType?: 'agent' | 'campaign' | 'client';
    entityId?: string;
    metric?: string;
    limit?: number;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await backend.forecasting.getPerformancePredictions(filters || {});
      setPredictions(result.predictions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions(params);
  }, [params?.entityType, params?.entityId, params?.metrics]);

  return {
    predictions,
    loading,
    error,
    predictPerformance,
    bulkPredictPerformance,
    getAnalytics,
    reload: loadPredictions
  };
};