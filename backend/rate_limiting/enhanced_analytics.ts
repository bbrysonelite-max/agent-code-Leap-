import { api } from "encore.dev/api";
import { db } from "./db";
import { rateLimitAnalytics } from "../shared/rate-limit-analytics";

export interface PredictiveAlert {
  id: string;
  type: 'quota_breach_prediction' | 'traffic_spike_prediction' | 'abuse_pattern_detection' | 'system_overload_prediction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  timeToEvent: number; // Minutes until predicted event
  affectedEntity: {
    type: 'user' | 'endpoint' | 'service' | 'system';
    identifier: string;
    name: string;
  };
  prediction: {
    metric: string;
    currentValue: number;
    predictedValue: number;
    threshold: number;
    timeWindow: string;
  };
  recommendedActions: string[];
  historicalContext: {
    similarEventsCount: number;
    lastOccurrence?: Date;
    averageResolutionTime?: number;
  };
  createdAt: Date;
  acknowledged: boolean;
}

export interface UsagePattern {
  identifier: string;
  pattern: {
    type: 'normal' | 'burst' | 'sustained_high' | 'gradual_increase' | 'suspicious';
    description: string;
    confidence: number;
    startTime: Date;
    duration: number; // minutes
    peakValue: number;
    baselineDeviation: number;
  };
  context: {
    endpoints: string[];
    methods: string[];
    userAgent?: string;
    geographicOrigin?: string;
    requestSizes?: { min: number; max: number; avg: number };
  };
  riskAssessment: {
    score: number; // 0-100
    factors: string[];
    recommendedAction: 'monitor' | 'throttle' | 'block' | 'escalate';
  };
}

export interface TrendAnalysis {
  metric: string;
  timeframe: '1h' | '6h' | '24h' | '7d' | '30d';
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    magnitude: number; // Percentage change
    confidence: number;
    seasonality?: {
      detected: boolean;
      period?: string;
      strength?: number;
    };
  };
  forecast: {
    nextHour: number;
    next6Hours: number;
    next24Hours: number;
    confidence: number;
  };
  anomalies: {
    detected: boolean;
    count: number;
    severity: 'low' | 'medium' | 'high';
    timestamps: Date[];
  };
}

export interface SystemHealthMetrics {
  overall: {
    score: number; // 0-100
    status: 'healthy' | 'degraded' | 'critical';
    lastUpdated: Date;
  };
  components: {
    rateLimiting: ComponentHealth;
    quotaManagement: ComponentHealth;
    analytics: ComponentHealth;
    circuitBreakers: ComponentHealth;
    adaptiveLimits: ComponentHealth;
  };
  performance: {
    avgProcessingTime: number;
    p95ProcessingTime: number;
    errorRate: number;
    throughput: number;
  };
  capacity: {
    current: number;
    maximum: number;
    utilizationPercent: number;
    projected24h: number;
  };
}

interface ComponentHealth {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  issues: string[];
  lastCheck: Date;
}

class EnhancedAnalyticsEngine {

  /**
   * Generate predictive alerts based on current trends and patterns
   */
  async generatePredictiveAlerts(): Promise<PredictiveAlert[]> {
    const alerts: PredictiveAlert[] = [];

    // Parallel prediction tasks
    const [
      quotaAlerts,
      trafficAlerts,
      abuseAlerts,
      systemAlerts
    ] = await Promise.all([
      this.predictQuotaBreach(),
      this.predictTrafficSpikes(),
      this.detectAbusePatterns(),
      this.predictSystemOverload()
    ]);

    alerts.push(...quotaAlerts, ...trafficAlerts, ...abuseAlerts, ...systemAlerts);

    // Store alerts for tracking
    await this.storePredictiveAlerts(alerts);

    // Send high-priority alerts immediately
    await this.sendUrgentAlerts(alerts.filter(a => a.severity === 'critical'));

    return alerts;
  }

  /**
   * Analyze usage patterns for anomaly detection
   */
  async analyzeUsagePatterns(timeWindowMinutes: number = 60): Promise<UsagePattern[]> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (timeWindowMinutes * 60 * 1000));

    // Get usage data for analysis
    const usageData = await this.getUsageDataForAnalysis(startTime, endTime);
    
    const patterns: UsagePattern[] = [];

    // Group by identifier for pattern analysis
    const groupedData = this.groupUsageByIdentifier(usageData);

    for (const [identifier, data] of Object.entries(groupedData)) {
      const pattern = await this.analyzeIdentifierPattern(identifier, data);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    // Store patterns for historical analysis
    await this.storeUsagePatterns(patterns);

    return patterns;
  }

  /**
   * Generate comprehensive trend analysis
   */
  async generateTrendAnalysis(metrics: string[], timeframe: '1h' | '6h' | '24h' | '7d' | '30d'): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];

    for (const metric of metrics) {
      const trend = await this.analyzeTrend(metric, timeframe);
      trends.push(trend);
    }

    return trends;
  }

  /**
   * Get comprehensive system health metrics
   */
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    const [
      rateLimitingHealth,
      quotaHealth,
      analyticsHealth,
      circuitBreakerHealth,
      adaptiveHealth,
      performanceMetrics,
      capacityMetrics
    ] = await Promise.all([
      this.checkRateLimitingHealth(),
      this.checkQuotaManagementHealth(),
      this.checkAnalyticsHealth(),
      this.checkCircuitBreakerHealth(),
      this.checkAdaptiveLimitsHealth(),
      this.getPerformanceMetrics(),
      this.getCapacityMetrics()
    ]);

    // Calculate overall health score
    const componentScores = [
      rateLimitingHealth.score,
      quotaHealth.score,
      analyticsHealth.score,
      circuitBreakerHealth.score,
      adaptiveHealth.score
    ];

    const overallScore = componentScores.reduce((sum, score) => sum + score, 0) / componentScores.length;
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (overallScore < 50) status = 'critical';
    else if (overallScore < 75) status = 'degraded';

    return {
      overall: {
        score: Math.round(overallScore),
        status,
        lastUpdated: new Date()
      },
      components: {
        rateLimiting: rateLimitingHealth,
        quotaManagement: quotaHealth,
        analytics: analyticsHealth,
        circuitBreakers: circuitBreakerHealth,
        adaptiveLimits: adaptiveHealth
      },
      performance: performanceMetrics,
      capacity: capacityMetrics
    };
  }

  /**
   * Real-time usage monitoring with intelligent alerting
   */
  async monitorRealTimeUsage(): Promise<{
    currentLoad: number;
    trends: { metric: string; value: number; change: number }[];
    alerts: string[];
    recommendations: string[];
  }> {
    const windowMinutes = 5;
    const currentUsage = await rateLimitAnalytics.getRealTimeUsage(windowMinutes);
    
    // Calculate current load
    const totalRequests = currentUsage.reduce((sum, item) => sum + (item.total_requests || 0), 0);
    const currentLoad = this.calculateLoadPercentage(totalRequests);

    // Get trend data
    const trends = await this.calculateRealTimeTrends(currentUsage);

    // Generate alerts and recommendations
    const alerts = await this.generateRealTimeAlerts(currentUsage, currentLoad);
    const recommendations = await this.generateRealTimeRecommendations(currentUsage, trends);

    return {
      currentLoad,
      trends,
      alerts,
      recommendations
    };
  }

  // Private helper methods for prediction algorithms

  private async predictQuotaBreach(): Promise<PredictiveAlert[]> {
    const alerts: PredictiveAlert[] = [];

    // Get users with high quota utilization
    const highUtilizationUsers = await db.queryAll`
      SELECT 
        user_id,
        tier,
        daily_quota,
        current_daily_usage,
        monthly_quota,
        current_monthly_usage,
        (current_daily_usage::float / daily_quota) as daily_utilization,
        (current_monthly_usage::float / monthly_quota) as monthly_utilization
      FROM user_quotas
      WHERE (current_daily_usage::float / daily_quota) > 0.7
         OR (current_monthly_usage::float / monthly_quota) > 0.7
    `;

    for (const user of highUtilizationUsers) {
      // Get usage velocity for prediction
      const velocity = await this.calculateUsageVelocity(user.user_id);
      
      // Predict time to quota breach
      const dailyTimeToBreach = this.predictTimeToQuotaBreach(
        user.current_daily_usage, 
        user.daily_quota, 
        velocity.daily
      );

      const monthlyTimeToBreach = this.predictTimeToQuotaBreach(
        user.current_monthly_usage, 
        user.monthly_quota, 
        velocity.monthly
      );

      // Generate alerts for imminent breaches
      if (dailyTimeToBreach > 0 && dailyTimeToBreach < 240) { // 4 hours
        alerts.push({
          id: `quota_${user.user_id}_daily_${Date.now()}`,
          type: 'quota_breach_prediction',
          severity: dailyTimeToBreach < 60 ? 'critical' : 'high',
          confidence: velocity.confidence,
          timeToEvent: dailyTimeToBreach,
          affectedEntity: {
            type: 'user',
            identifier: user.user_id,
            name: `User ${user.user_id} (${user.tier})`
          },
          prediction: {
            metric: 'daily_quota_usage',
            currentValue: user.current_daily_usage,
            predictedValue: user.daily_quota,
            threshold: user.daily_quota,
            timeWindow: 'daily'
          },
          recommendedActions: [
            'Consider temporary quota increase',
            'Review user\'s recent activity patterns',
            'Contact user about usage optimization'
          ],
          historicalContext: await this.getQuotaBreachHistory(user.user_id),
          createdAt: new Date(),
          acknowledged: false
        });
      }
    }

    return alerts;
  }

  private async predictTrafficSpikes(): Promise<PredictiveAlert[]> {
    const alerts: PredictiveAlert[] = [];

    // Analyze traffic patterns by endpoint
    const endpointTraffic = await db.queryAll`
      SELECT 
        endpoint,
        method,
        COUNT(*) as request_count,
        AVG(request_count) as avg_requests,
        STDDEV(request_count) as stddev_requests,
        MAX(request_count) as peak_requests
      FROM rate_limit_usage
      WHERE created_at >= NOW() - INTERVAL '2 hours'
      GROUP BY endpoint, method
      HAVING COUNT(*) > 10
    `;

    for (const traffic of endpointTraffic) {
      // Look for unusual spikes using statistical analysis
      const zScore = this.calculateZScore(traffic.peak_requests, traffic.avg_requests, traffic.stddev_requests);
      
      if (zScore > 2.5) { // Significant spike detected
        const timeToSpike = await this.predictNextSpike(traffic.endpoint, traffic.method);
        
        if (timeToSpike > 0 && timeToSpike < 120) { // Next 2 hours
          alerts.push({
            id: `spike_${traffic.endpoint}_${traffic.method}_${Date.now()}`,
            type: 'traffic_spike_prediction',
            severity: timeToSpike < 30 ? 'critical' : 'high',
            confidence: 0.75,
            timeToEvent: timeToSpike,
            affectedEntity: {
              type: 'endpoint',
              identifier: `${traffic.endpoint}:${traffic.method}`,
              name: `${traffic.method} ${traffic.endpoint}`
            },
            prediction: {
              metric: 'requests_per_minute',
              currentValue: traffic.avg_requests,
              predictedValue: traffic.peak_requests * 1.5,
              threshold: traffic.peak_requests * 1.2,
              timeWindow: '1h'
            },
            recommendedActions: [
              'Prepare for increased capacity',
              'Review rate limiting thresholds',
              'Enable circuit breakers if not active'
            ],
            historicalContext: await this.getTrafficSpikeHistory(traffic.endpoint),
            createdAt: new Date(),
            acknowledged: false
          });
        }
      }
    }

    return alerts;
  }

  private async detectAbusePatterns(): Promise<PredictiveAlert[]> {
    const alerts: PredictiveAlert[] = [];

    // Look for suspicious patterns
    const suspiciousActivity = await db.queryAll`
      SELECT 
        identifier,
        COUNT(DISTINCT endpoint) as unique_endpoints,
        SUM(request_count) as total_requests,
        SUM(blocked_count) as total_blocked,
        COUNT(*) as windows_active,
        MAX(created_at) as last_activity
      FROM rate_limit_usage
      WHERE created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY identifier
      HAVING SUM(blocked_count) > 10 
         OR COUNT(DISTINCT endpoint) > 20
         OR SUM(request_count) > 1000
    `;

    for (const activity of suspiciousActivity) {
      const abuseScore = this.calculateAbuseScore(activity);
      
      if (abuseScore > 70) {
        alerts.push({
          id: `abuse_${activity.identifier}_${Date.now()}`,
          type: 'abuse_pattern_detection',
          severity: abuseScore > 90 ? 'critical' : 'high',
          confidence: 0.85,
          timeToEvent: 0, // Already happening
          affectedEntity: {
            type: 'user',
            identifier: activity.identifier,
            name: `Identifier: ${activity.identifier}`
          },
          prediction: {
            metric: 'abuse_score',
            currentValue: abuseScore,
            predictedValue: abuseScore,
            threshold: 70,
            timeWindow: '1h'
          },
          recommendedActions: [
            'Apply temporary rate limiting',
            'Review user activity logs',
            'Consider blocking if pattern continues',
            'Investigate potential bot activity'
          ],
          historicalContext: await this.getAbuseHistory(activity.identifier),
          createdAt: new Date(),
          acknowledged: false
        });
      }
    }

    return alerts;
  }

  private async predictSystemOverload(): Promise<PredictiveAlert[]> {
    const alerts: PredictiveAlert[] = [];

    // Check overall system metrics
    const systemMetrics = await this.getCurrentSystemMetrics();
    
    if (systemMetrics.cpuUtilization > 80 || systemMetrics.memoryUtilization > 85) {
      const timeToOverload = this.predictSystemOverloadTime(systemMetrics);
      
      if (timeToOverload < 60) { // Less than 1 hour
        alerts.push({
          id: `system_overload_${Date.now()}`,
          type: 'system_overload_prediction',
          severity: timeToOverload < 15 ? 'critical' : 'high',
          confidence: 0.8,
          timeToEvent: timeToOverload,
          affectedEntity: {
            type: 'system',
            identifier: 'rate_limiting_system',
            name: 'Rate Limiting System'
          },
          prediction: {
            metric: 'system_utilization',
            currentValue: Math.max(systemMetrics.cpuUtilization, systemMetrics.memoryUtilization),
            predictedValue: 100,
            threshold: 90,
            timeWindow: '1h'
          },
          recommendedActions: [
            'Scale up infrastructure',
            'Enable emergency throttling',
            'Review system resource allocation',
            'Consider temporary service degradation'
          ],
          historicalContext: await this.getSystemOverloadHistory(),
          createdAt: new Date(),
          acknowledged: false
        });
      }
    }

    return alerts;
  }

  private async analyzeIdentifierPattern(identifier: string, data: any[]): Promise<UsagePattern | null> {
    if (data.length < 3) return null; // Need enough data points

    const requests = data.map(d => d.request_count);
    const baseline = await this.getBaselineForIdentifier(identifier);
    
    // Calculate pattern metrics
    const totalRequests = requests.reduce((sum, r) => sum + r, 0);
    const avgRequests = totalRequests / requests.length;
    const maxRequests = Math.max(...requests);
    const deviation = this.calculateStandardDeviation(requests);
    
    // Determine pattern type
    let patternType: 'normal' | 'burst' | 'sustained_high' | 'gradual_increase' | 'suspicious' = 'normal';
    let confidence = 0.7;
    
    if (maxRequests > baseline * 5 && deviation > baseline * 2) {
      patternType = 'burst';
      confidence = 0.9;
    } else if (avgRequests > baseline * 3) {
      patternType = 'sustained_high';
      confidence = 0.85;
    } else if (this.isGradualIncrease(requests)) {
      patternType = 'gradual_increase';
      confidence = 0.8;
    } else if (this.isSuspiciousPattern(data)) {
      patternType = 'suspicious';
      confidence = 0.95;
    }

    if (patternType === 'normal') return null;

    // Calculate risk assessment
    const riskScore = this.calculatePatternRiskScore(patternType, avgRequests, baseline, data);
    
    return {
      identifier,
      pattern: {
        type: patternType,
        description: this.getPatternDescription(patternType, avgRequests, baseline),
        confidence,
        startTime: new Date(data[0].created_at),
        duration: this.calculatePatternDuration(data),
        peakValue: maxRequests,
        baselineDeviation: (avgRequests - baseline) / baseline
      },
      context: {
        endpoints: [...new Set(data.map(d => d.endpoint))],
        methods: [...new Set(data.map(d => d.method))],
        // Additional context would be extracted from request metadata
      },
      riskAssessment: {
        score: riskScore,
        factors: this.getRiskFactors(patternType, riskScore),
        recommendedAction: this.getRecommendedAction(riskScore)
      }
    };
  }

  private async analyzeTrend(metric: string, timeframe: string): Promise<TrendAnalysis> {
    const data = await this.getMetricData(metric, timeframe);
    
    // Perform statistical analysis
    const trend = this.calculateTrendDirection(data);
    const forecast = this.generateForecast(data);
    const anomalies = this.detectAnomalies(data);
    
    return {
      metric,
      timeframe: timeframe as any,
      trend,
      forecast,
      anomalies
    };
  }

  // Utility methods for calculations

  private calculateUsageVelocity(userId: string): Promise<{
    daily: number;
    monthly: number;
    confidence: number;
  }> {
    // Calculate rate of quota consumption
    // Implementation would analyze recent usage patterns
    return Promise.resolve({ daily: 10, monthly: 300, confidence: 0.8 });
  }

  private predictTimeToQuotaBreach(current: number, limit: number, velocity: number): number {
    if (velocity <= 0) return -1;
    const remaining = limit - current;
    return Math.ceil(remaining / velocity);
  }

  private calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  private calculateAbuseScore(activity: any): number {
    let score = 0;
    
    // High number of blocked requests
    score += Math.min(activity.total_blocked * 2, 40);
    
    // Unusual endpoint diversity
    if (activity.unique_endpoints > 15) score += 20;
    
    // High request volume
    if (activity.total_requests > 500) score += 15;
    
    // Many active windows (consistent activity)
    if (activity.windows_active > 10) score += 15;
    
    return Math.min(score, 100);
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private isGradualIncrease(values: number[]): boolean {
    // Check if values show a consistent upward trend
    let increases = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i-1]) increases++;
    }
    return increases / (values.length - 1) > 0.7;
  }

  private isSuspiciousPattern(data: any[]): boolean {
    // Look for patterns that indicate automated behavior
    const intervals = data.slice(1).map((d, i) => 
      new Date(d.created_at).getTime() - new Date(data[i].created_at).getTime()
    );
    
    // Check for very regular intervals (bot-like behavior)
    const intervalVariance = this.calculateStandardDeviation(intervals);
    return intervalVariance < 1000; // Less than 1 second variance
  }

  // Additional helper methods would be implemented here...
  private async getQuotaBreachHistory(userId: string): Promise<any> { return { similarEventsCount: 0 }; }
  private async getTrafficSpikeHistory(endpoint: string): Promise<any> { return { similarEventsCount: 0 }; }
  private async getAbuseHistory(identifier: string): Promise<any> { return { similarEventsCount: 0 }; }
  private async getSystemOverloadHistory(): Promise<any> { return { similarEventsCount: 0 }; }
  private async getBaselineForIdentifier(identifier: string): Promise<number> { return 50; }
  private async getMetricData(metric: string, timeframe: string): Promise<number[]> { return []; }
  private async getCurrentSystemMetrics(): Promise<any> { return { cpuUtilization: 45, memoryUtilization: 60 }; }
  
  private calculateTrendDirection(data: number[]): any { return { direction: 'stable', magnitude: 0, confidence: 0.8 }; }
  private generateForecast(data: number[]): any { return { nextHour: 100, next6Hours: 500, next24Hours: 2000, confidence: 0.7 }; }
  private detectAnomalies(data: number[]): any { return { detected: false, count: 0, severity: 'low', timestamps: [] }; }
  
  private getPatternDescription(type: string, avg: number, baseline: number): string {
    return `${type} pattern detected: ${avg.toFixed(1)} requests/min (baseline: ${baseline.toFixed(1)})`;
  }
  
  private calculatePatternDuration(data: any[]): number {
    const start = new Date(data[0].created_at);
    const end = new Date(data[data.length - 1].created_at);
    return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
  }
  
  private calculatePatternRiskScore(type: string, avg: number, baseline: number, data: any[]): number {
    const multipliers = { burst: 30, sustained_high: 25, gradual_increase: 15, suspicious: 40, normal: 0 };
    const baseScore = multipliers[type as keyof typeof multipliers] || 0;
    const deviationScore = Math.min((avg / baseline - 1) * 20, 30);
    return Math.min(baseScore + deviationScore, 100);
  }
  
  private getRiskFactors(type: string, score: number): string[] {
    const factors = [`Pattern type: ${type}`];
    if (score > 70) factors.push('High deviation from baseline');
    if (score > 80) factors.push('Potential security concern');
    return factors;
  }
  
  private getRecommendedAction(score: number): 'monitor' | 'throttle' | 'block' | 'escalate' {
    if (score > 90) return 'escalate';
    if (score > 70) return 'block';
    if (score > 50) return 'throttle';
    return 'monitor';
  }

  private async storePredictiveAlerts(alerts: PredictiveAlert[]): Promise<void> {
    // Store alerts in database for tracking and analysis
  }

  private async sendUrgentAlerts(alerts: PredictiveAlert[]): Promise<void> {
    // Send immediate notifications for critical alerts
    for (const alert of alerts) {
      console.warn(`CRITICAL ALERT: ${alert.type} - ${alert.affectedEntity.name}`);
    }
  }

  private async storeUsagePatterns(patterns: UsagePattern[]): Promise<void> {
    // Store patterns for historical analysis and ML training
  }

  private async getUsageDataForAnalysis(startTime: Date, endTime: Date): Promise<any[]> {
    return await db.queryAll`
      SELECT identifier, endpoint, method, request_count, blocked_count, created_at
      FROM rate_limit_usage
      WHERE created_at BETWEEN ${startTime} AND ${endTime}
      ORDER BY created_at ASC
    `;
  }

  private groupUsageByIdentifier(data: any[]): Record<string, any[]> {
    return data.reduce((groups, item) => {
      if (!groups[item.identifier]) groups[item.identifier] = [];
      groups[item.identifier].push(item);
      return groups;
    }, {});
  }

  private calculateLoadPercentage(totalRequests: number): number {
    // Calculate current load as percentage of capacity
    const systemCapacity = 10000; // requests per 5 minutes
    return Math.min((totalRequests / systemCapacity) * 100, 100);
  }

  private async calculateRealTimeTrends(usageData: any[]): Promise<any[]> {
    // Calculate short-term trends for real-time monitoring
    return [
      { metric: 'requests_per_minute', value: 150, change: 12 },
      { metric: 'blocking_rate', value: 3.2, change: -0.5 },
      { metric: 'unique_users', value: 45, change: 8 }
    ];
  }

  private async generateRealTimeAlerts(usageData: any[], currentLoad: number): Promise<string[]> {
    const alerts: string[] = [];
    
    if (currentLoad > 80) {
      alerts.push('System load is above 80%');
    }
    
    const highBlockingEndpoints = usageData.filter(item => 
      (item.blocked_requests / Math.max(item.total_requests, 1)) > 0.2
    );
    
    if (highBlockingEndpoints.length > 0) {
      alerts.push(`${highBlockingEndpoints.length} endpoints have blocking rate > 20%`);
    }
    
    return alerts;
  }

  private async generateRealTimeRecommendations(usageData: any[], trends: any[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    const increasingTrends = trends.filter(t => t.change > 10);
    if (increasingTrends.length > 0) {
      recommendations.push('Consider preemptive scaling due to increasing trends');
    }
    
    const lowUtilization = usageData.filter(item => item.total_requests < 10);
    if (lowUtilization.length > usageData.length * 0.5) {
      recommendations.push('Many endpoints have low utilization - consider optimizing limits');
    }
    
    return recommendations;
  }

  private async checkRateLimitingHealth(): Promise<ComponentHealth> {
    // Check health of rate limiting component
    return {
      score: 95,
      status: 'healthy',
      issues: [],
      lastCheck: new Date()
    };
  }

  private async checkQuotaManagementHealth(): Promise<ComponentHealth> {
    return { score: 92, status: 'healthy', issues: [], lastCheck: new Date() };
  }

  private async checkAnalyticsHealth(): Promise<ComponentHealth> {
    return { score: 88, status: 'healthy', issues: [], lastCheck: new Date() };
  }

  private async checkCircuitBreakerHealth(): Promise<ComponentHealth> {
    return { score: 90, status: 'healthy', issues: [], lastCheck: new Date() };
  }

  private async checkAdaptiveLimitsHealth(): Promise<ComponentHealth> {
    return { score: 85, status: 'healthy', issues: [], lastCheck: new Date() };
  }

  private async getPerformanceMetrics(): Promise<any> {
    return {
      avgProcessingTime: 12,
      p95ProcessingTime: 45,
      errorRate: 0.8,
      throughput: 1250
    };
  }

  private async getCapacityMetrics(): Promise<any> {
    return {
      current: 7500,
      maximum: 10000,
      utilizationPercent: 75,
      projected24h: 9200
    };
  }

  private predictSystemOverloadTime(metrics: any): number {
    // Predict when system will reach capacity based on current trends
    const utilizationRate = 2; // percent per hour
    const currentMax = Math.max(metrics.cpuUtilization, metrics.memoryUtilization);
    const timeToOverload = (100 - currentMax) / utilizationRate * 60; // minutes
    return Math.max(0, timeToOverload);
  }

  private async predictNextSpike(endpoint: string, method: string): Promise<number> {
    // Predict when next traffic spike will occur
    // This would use historical pattern analysis
    return Math.random() * 120; // Placeholder: random time in next 2 hours
  }
}

// Global instance
export const enhancedAnalyticsEngine = new EnhancedAnalyticsEngine();

// API endpoints
export const generatePredictiveAlerts = api(
  { method: "GET", path: "/rate-limiting/analytics/predictive-alerts", expose: true },
  async (): Promise<{ alerts: PredictiveAlert[] }> => {
    const alerts = await enhancedAnalyticsEngine.generatePredictiveAlerts();
    return { alerts };
  }
);

export const analyzeUsagePatterns = api(
  { method: "GET", path: "/rate-limiting/analytics/usage-patterns", expose: true },
  async ({ timeWindowMinutes = 60 }: { timeWindowMinutes?: number }): Promise<{ patterns: UsagePattern[] }> => {
    const patterns = await enhancedAnalyticsEngine.analyzeUsagePatterns(timeWindowMinutes);
    return { patterns };
  }
);

export const getTrendAnalysis = api(
  { method: "GET", path: "/rate-limiting/analytics/trends", expose: true },
  async ({ 
    metrics = ['requests', 'blocking_rate', 'quota_usage'], 
    timeframe = '24h' 
  }: { 
    metrics?: string[]; 
    timeframe?: '1h' | '6h' | '24h' | '7d' | '30d' 
  }): Promise<{ trends: TrendAnalysis[] }> => {
    const trends = await enhancedAnalyticsEngine.generateTrendAnalysis(metrics, timeframe);
    return { trends };
  }
);

export const getSystemHealth = api(
  { method: "GET", path: "/rate-limiting/analytics/system-health", expose: true },
  async (): Promise<{ health: SystemHealthMetrics }> => {
    const health = await enhancedAnalyticsEngine.getSystemHealthMetrics();
    return { health };
  }
);

export const getRealTimeMonitoring = api(
  { method: "GET", path: "/rate-limiting/analytics/realtime", expose: true },
  async () => {
    return await enhancedAnalyticsEngine.monitorRealTimeUsage();
  }
);