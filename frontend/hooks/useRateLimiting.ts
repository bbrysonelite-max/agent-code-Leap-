import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

interface RateLimitMetrics {
  currentUsage: number;
  limit: number;
  remaining: number;
  resetTime: Date;
  tier: string;
  blocked: boolean;
  retryAfter?: number;
}

interface QuotaStatus {
  userId: string;
  tier: string;
  dailyUsage: {
    total: number;
    remaining: number;
    resetTime: string;
  };
  monthlyUsage: {
    total: number;
    remaining: number;
    resetTime: string;
  };
  quotaHealth: {
    score: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface EndpointStats {
  endpoint: string;
  method: string;
  requestCount: number;
  blockedCount: number;
  avgResponseTime: number;
  lastUsed: Date;
}

interface PredictiveAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timeToEvent: number;
  confidence: number;
  message: string;
  recommendedActions: string[];
}

export function useRateLimiting(userId?: string) {
  const [metrics, setMetrics] = useState<RateLimitMetrics | null>(null);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [endpointStats, setEndpointStats] = useState<EndpointStats[]>([]);
  const [predictiveAlerts, setPredictiveAlerts] = useState<PredictiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch current rate limit metrics
  const fetchMetrics = useCallback(async () => {
    if (!userId) return;
    
    try {
      // This would be implemented as an endpoint that returns current rate limit status
      // For now, we'll simulate the data structure
      const mockMetrics: RateLimitMetrics = {
        currentUsage: 150,
        limit: 1000,
        remaining: 850,
        resetTime: new Date(Date.now() + 3600000), // 1 hour from now
        tier: 'premium',
        blocked: false
      };
      
      setMetrics(mockMetrics);
    } catch (err) {
      console.error('Failed to fetch rate limit metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    }
  }, [userId]);

  // Fetch quota status
  const fetchQuotaStatus = useCallback(async () => {
    if (!userId) return;
    
    try {
      const quota = await backend.rate_limiting.quota_manager.getQuotaBreakdown({ userId });
      setQuotaStatus(quota);
    } catch (err) {
      console.error('Failed to fetch quota status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch quota status');
    }
  }, [userId]);

  // Fetch endpoint statistics
  const fetchEndpointStats = useCallback(async () => {
    try {
      const realTimeUsage = await backend.rate_limiting.analytics.getRealTimeUsage({ timeWindowMinutes: 60 });
      
      const stats: EndpointStats[] = realTimeUsage.map((item: any) => ({
        endpoint: item.endpoint,
        method: item.method,
        requestCount: item.total_requests || 0,
        blockedCount: item.total_blocked || 0,
        avgResponseTime: item.avg_requests_per_window || 0,
        lastUsed: new Date()
      }));
      
      setEndpointStats(stats);
    } catch (err) {
      console.error('Failed to fetch endpoint stats:', err);
    }
  }, []);

  // Fetch predictive alerts
  const fetchPredictiveAlerts = useCallback(async () => {
    try {
      const alerts = await backend.rate_limiting.enhanced_analytics.generatePredictiveAlerts();
      
      const formattedAlerts: PredictiveAlert[] = alerts
        .filter((alert: any) => !userId || alert.affectedEntity.identifier === userId)
        .map((alert: any) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          timeToEvent: alert.timeToEvent,
          confidence: alert.confidence,
          message: `${alert.title}: ${alert.message}`,
          recommendedActions: alert.actions?.map((action: any) => action.description) || []
        }));
      
      setPredictiveAlerts(formattedAlerts);
    } catch (err) {
      console.error('Failed to fetch predictive alerts:', err);
    }
  }, [userId]);

  // Request quota adjustment
  const requestQuotaAdjustment = useCallback(async (
    adjustmentType: 'temporary_increase' | 'permanent_change' | 'emergency_boost',
    dailyQuotaChange?: number,
    monthlyQuotaChange?: number,
    reason?: string
  ) => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User ID is required for quota adjustments",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await backend.rate_limiting.quota_manager.requestQuotaAdjustment({
        userId,
        adjustmentType,
        dailyQuotaChange,
        monthlyQuotaChange,
        reason: reason || 'User requested adjustment',
        autoApprove: adjustmentType === 'emergency_boost'
      });

      toast({
        title: "Quota Adjustment Request",
        description: `Request ${result.status}. ${result.reason || ''}`,
        variant: result.status === 'approved' ? 'default' : 'secondary'
      });

      // Refresh quota status
      await fetchQuotaStatus();

      return result;
    } catch (err) {
      toast({
        title: "Request Failed",
        description: err instanceof Error ? err.message : 'Failed to request quota adjustment',
        variant: "destructive"
      });
      throw err;
    }
  }, [userId, toast, fetchQuotaStatus]);

  // Get usage forecast
  const getUsageForecast = useCallback(async (period: 'daily' | 'weekly' | 'monthly' = 'daily') => {
    if (!userId) return null;

    try {
      const forecast = await backend.rate_limiting.quota_manager.getUsageForecast({
        userId,
        period
      });
      
      return forecast;
    } catch (err) {
      console.error('Failed to get usage forecast:', err);
      return null;
    }
  }, [userId]);

  // Check if rate limited
  const isRateLimited = useCallback((endpoint?: string, method?: string): boolean => {
    if (!metrics) return false;
    
    // Check global rate limit
    if (metrics.blocked) return true;
    
    // Check endpoint-specific limits
    if (endpoint && method) {
      const endpointStat = endpointStats.find(
        stat => stat.endpoint === endpoint && stat.method === method
      );
      return endpointStat ? endpointStat.blockedCount > 0 : false;
    }
    
    return false;
  }, [metrics, endpointStats]);

  // Get rate limit headers for display
  const getRateLimitInfo = useCallback(() => {
    if (!metrics) return null;
    
    return {
      limit: metrics.limit,
      remaining: metrics.remaining,
      resetTime: metrics.resetTime,
      tier: metrics.tier,
      utilizationPercent: ((metrics.currentUsage / metrics.limit) * 100).toFixed(1),
      timeUntilReset: Math.max(0, metrics.resetTime.getTime() - Date.now()),
      retryAfter: metrics.retryAfter
    };
  }, [metrics]);

  // Monitor for quota warnings
  useEffect(() => {
    if (quotaStatus?.quotaHealth.riskLevel === 'critical') {
      toast({
        title: "Quota Warning",
        description: "You're approaching your quota limits. Consider upgrading or optimizing usage.",
        variant: "destructive"
      });
    } else if (quotaStatus?.quotaHealth.riskLevel === 'high') {
      toast({
        title: "High Usage Detected",
        description: "Your quota usage is higher than usual. Monitor your API calls.",
        variant: "default"
      });
    }
  }, [quotaStatus?.quotaHealth.riskLevel, toast]);

  // Monitor predictive alerts
  useEffect(() => {
    const criticalAlerts = predictiveAlerts.filter(alert => 
      alert.severity === 'critical' && alert.timeToEvent < 60 // Less than 1 hour
    );
    
    criticalAlerts.forEach(alert => {
      toast({
        title: "Predictive Alert",
        description: alert.message,
        variant: "destructive"
      });
    });
  }, [predictiveAlerts, toast]);

  // Initial data fetch
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        await Promise.all([
          fetchMetrics(),
          fetchQuotaStatus(),
          fetchEndpointStats(),
          fetchPredictiveAlerts()
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [fetchMetrics, fetchQuotaStatus, fetchEndpointStats, fetchPredictiveAlerts]);

  // Auto-refresh data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMetrics();
      fetchEndpointStats();
      fetchPredictiveAlerts();
    }, 30000); // Refresh every 30 seconds

    const quotaInterval = setInterval(() => {
      fetchQuotaStatus();
    }, 300000); // Refresh quota every 5 minutes

    return () => {
      clearInterval(interval);
      clearInterval(quotaInterval);
    };
  }, [fetchMetrics, fetchQuotaStatus, fetchEndpointStats, fetchPredictiveAlerts]);

  return {
    // Data
    metrics,
    quotaStatus,
    endpointStats,
    predictiveAlerts,
    
    // State
    loading,
    error,
    
    // Actions
    requestQuotaAdjustment,
    getUsageForecast,
    
    // Utilities
    isRateLimited,
    getRateLimitInfo,
    
    // Refresh functions
    refreshMetrics: fetchMetrics,
    refreshQuotaStatus: fetchQuotaStatus,
    refreshEndpointStats: fetchEndpointStats,
    refreshPredictiveAlerts: fetchPredictiveAlerts
  };
}

// Hook for monitoring specific endpoint rate limits
export function useEndpointRateLimit(endpoint: string, method: string, userTier: string = 'basic') {
  const [limits, setLimits] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const effectiveLimits = await backend.rate_limiting.endpoint_config.getEffectiveRateLimits({
          endpoint: encodeURIComponent(endpoint),
          method,
          tier: userTier
        });
        
        setLimits(effectiveLimits);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch endpoint limits');
      } finally {
        setLoading(false);
      }
    };

    fetchLimits();
  }, [endpoint, method, userTier]);

  return {
    limits,
    loading,
    error,
    isLimited: limits ? limits.maxRequests === 0 : false,
    windowSeconds: limits?.windowSeconds || 60,
    maxRequests: limits?.maxRequests || 0,
    burstLimit: limits?.burstLimit || 0,
    specialLimitsApplied: limits?.specialLimitsApplied || [],
    circuitBreakerState: limits?.circuitBreakerState || 'closed'
  };
}

// Hook for real-time rate limiting monitoring
export function useRealTimeRateLimiting() {
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const fetchRealTimeData = async () => {
      try {
        const [monitoring, alertData] = await Promise.all([
          backend.rate_limiting.enhanced_analytics.getRealTimeMonitoring(),
          backend.rate_limiting.enhanced_analytics.generatePredictiveAlerts()
        ]);
        
        setRealTimeData(monitoring);
        setAlerts(alertData);
      } catch (err) {
        console.error('Failed to fetch real-time data:', err);
      }
    };

    // Initial fetch
    fetchRealTimeData();

    // Set up real-time updates
    const interval = setInterval(fetchRealTimeData, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    currentLoad: realTimeData?.currentLoad || 0,
    trends: realTimeData?.trends || [],
    alerts: realTimeData?.alerts || [],
    recommendations: realTimeData?.recommendations || [],
    predictiveAlerts: alerts
  };
}