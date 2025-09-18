import { api } from "encore.dev/api";
import { db } from "./db";
import { ValidationError } from "../shared/errors";

export interface EndpointRateLimitConfig {
  id?: number;
  endpoint: string;
  method: string;
  serviceName: string;
  category: 'critical' | 'standard' | 'background' | 'public';
  tiers: {
    [tier: string]: {
      windowSeconds: number;
      maxRequests: number;
      burstLimit: number;
      concurrentLimit?: number;
      cooldownSeconds?: number;
    };
  };
  specialRules?: {
    timeBasedLimits?: TimeBasedLimit[];
    conditionalLimits?: ConditionalLimit[];
    circuitBreaker?: CircuitBreakerConfig;
    adaptiveLimits?: AdaptiveLimitConfig;
  };
  enabled: boolean;
  priority: number;
  description?: string;
}

export interface TimeBasedLimit {
  name: string;
  schedule: {
    daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
  };
  multiplier: number; // Multiply base limits by this factor
  enabled: boolean;
}

export interface ConditionalLimit {
  name: string;
  conditions: {
    userAgent?: string[]; // Regex patterns
    ipRange?: string[]; // CIDR blocks
    headers?: Record<string, string[]>; // Header patterns
    requestSize?: { min?: number; max?: number };
    geographic?: string[]; // Country codes
  };
  action: 'restrict' | 'allow' | 'monitor';
  limitMultiplier?: number;
  customMessage?: string;
  enabled: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeSeconds: number; // Time to wait before trying again
  successThreshold: number; // Number of successes to close circuit
  monitorWindowSeconds: number; // Window to count failures
  enabled: boolean;
}

export interface AdaptiveLimitConfig {
  enabled: boolean;
  baslineWindowMinutes: number; // Time window to establish baseline
  adjustmentFactor: number; // How much to adjust (0.1 = 10%)
  maxAdjustmentPercent: number; // Maximum adjustment percentage
  metrics: AdaptiveMetric[];
}

export interface AdaptiveMetric {
  name: string;
  threshold: number;
  action: 'increase' | 'decrease';
  weight: number;
}

export interface EndpointDiscoveryResult {
  endpoint: string;
  method: string;
  serviceName: string;
  estimatedCategory: 'critical' | 'standard' | 'background' | 'public';
  suggestedLimits: {
    [tier: string]: {
      windowSeconds: number;
      maxRequests: number;
      burstLimit: number;
    };
  };
  confidence: number;
  reasoning: string[];
}

export interface BulkConfigUpdate {
  filter: {
    serviceName?: string;
    category?: string;
    endpoint?: string;
  };
  updates: Partial<EndpointRateLimitConfig>;
  reason: string;
}

class EndpointConfigManager {
  
  /**
   * Auto-discover endpoints and suggest rate limiting configurations
   */
  async discoverEndpoints(): Promise<EndpointDiscoveryResult[]> {
    // Get all unique endpoints from usage data
    const endpoints = await db.queryAll`
      SELECT DISTINCT 
        endpoint, 
        method,
        COUNT(*) as usage_count,
        AVG(request_count) as avg_requests_per_window,
        MAX(request_count) as peak_requests,
        COUNT(DISTINCT identifier) as unique_users
      FROM rate_limit_usage
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY endpoint, method
      ORDER BY usage_count DESC
    `;

    const discoveries: EndpointDiscoveryResult[] = [];

    for (const endpoint of endpoints) {
      const analysis = await this.analyzeEndpoint(endpoint);
      discoveries.push({
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        serviceName: this.extractServiceName(endpoint.endpoint),
        estimatedCategory: analysis.category,
        suggestedLimits: analysis.suggestedLimits,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning
      });
    }

    return discoveries;
  }

  /**
   * Create comprehensive rate limiting configuration for an endpoint
   */
  async createEndpointConfig(config: EndpointRateLimitConfig): Promise<EndpointRateLimitConfig> {
    // Validate configuration
    await this.validateEndpointConfig(config);

    // Store main configuration
    const result = await db.queryAll`
      INSERT INTO endpoint_rate_limits (
        endpoint, method, service_name, category, enabled, priority, description
      ) VALUES (
        ${config.endpoint}, ${config.method}, ${config.serviceName}, 
        ${config.category}, ${config.enabled}, ${config.priority}, ${config.description}
      )
      RETURNING id
    `;

    const configId = result[0].id;

    // Store tier-specific limits
    await this.storeTierLimits(configId, config.tiers);

    // Store special rules if provided
    if (config.specialRules) {
      await this.storeSpecialRules(configId, config.specialRules);
    }

    return { ...config, id: configId };
  }

  /**
   * Get effective rate limits for an endpoint considering all rules
   */
  async getEffectiveRateLimits(
    endpoint: string, 
    method: string, 
    tier: string,
    context?: {
      userAgent?: string;
      ipAddress?: string;
      headers?: Record<string, string>;
      requestSize?: number;
      timestamp?: Date;
    }
  ): Promise<{
    windowSeconds: number;
    maxRequests: number;
    burstLimit: number;
    concurrentLimit?: number;
    specialLimitsApplied: string[];
    circuitBreakerState?: 'closed' | 'open' | 'half-open';
  }> {
    // Get base configuration
    const baseConfig = await this.getEndpointConfig(endpoint, method);
    if (!baseConfig || !baseConfig.enabled) {
      return this.getDefaultLimits(tier);
    }

    // Start with tier-specific limits
    const baseLimits = baseConfig.tiers[tier] || baseConfig.tiers['basic'];
    let effectiveLimits = { ...baseLimits };
    const appliedRules: string[] = [];

    // Apply time-based limits
    if (baseConfig.specialRules?.timeBasedLimits) {
      const timeAdjustment = await this.getTimeBasedAdjustment(
        baseConfig.specialRules.timeBasedLimits, 
        context?.timestamp || new Date()
      );
      if (timeAdjustment.multiplier !== 1) {
        effectiveLimits.maxRequests = Math.floor(effectiveLimits.maxRequests * timeAdjustment.multiplier);
        effectiveLimits.burstLimit = Math.floor(effectiveLimits.burstLimit * timeAdjustment.multiplier);
        appliedRules.push(`Time-based: ${timeAdjustment.ruleName}`);
      }
    }

    // Apply conditional limits
    if (baseConfig.specialRules?.conditionalLimits && context) {
      const conditionalAdjustment = await this.getConditionalAdjustment(
        baseConfig.specialRules.conditionalLimits,
        context
      );
      if (conditionalAdjustment.multiplier !== 1) {
        effectiveLimits.maxRequests = Math.floor(effectiveLimits.maxRequests * conditionalAdjustment.multiplier);
        effectiveLimits.burstLimit = Math.floor(effectiveLimits.burstLimit * conditionalAdjustment.multiplier);
        appliedRules.push(`Conditional: ${conditionalAdjustment.ruleName}`);
      }
    }

    // Check circuit breaker state
    let circuitBreakerState: 'closed' | 'open' | 'half-open' | undefined;
    if (baseConfig.specialRules?.circuitBreaker?.enabled) {
      circuitBreakerState = await this.getCircuitBreakerState(endpoint, method);
      if (circuitBreakerState === 'open') {
        effectiveLimits.maxRequests = 0;
        appliedRules.push('Circuit breaker: OPEN');
      } else if (circuitBreakerState === 'half-open') {
        effectiveLimits.maxRequests = Math.min(effectiveLimits.maxRequests, 5);
        appliedRules.push('Circuit breaker: HALF-OPEN');
      }
    }

    // Apply adaptive limits
    if (baseConfig.specialRules?.adaptiveLimits?.enabled) {
      const adaptiveAdjustment = await this.getAdaptiveAdjustment(
        endpoint, 
        method, 
        baseConfig.specialRules.adaptiveLimits
      );
      if (adaptiveAdjustment.multiplier !== 1) {
        effectiveLimits.maxRequests = Math.floor(effectiveLimits.maxRequests * adaptiveAdjustment.multiplier);
        effectiveLimits.burstLimit = Math.floor(effectiveLimits.burstLimit * adaptiveAdjustment.multiplier);
        appliedRules.push(`Adaptive: ${adaptiveAdjustment.reason}`);
      }
    }

    return {
      ...effectiveLimits,
      specialLimitsApplied: appliedRules,
      circuitBreakerState
    };
  }

  /**
   * Bulk update endpoint configurations
   */
  async bulkUpdateConfigs(update: BulkConfigUpdate): Promise<{ updated: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];

    if (update.filter.serviceName) {
      whereClause += ` AND service_name = $${values.length + 1}`;
      values.push(update.filter.serviceName);
    }

    if (update.filter.category) {
      whereClause += ` AND category = $${values.length + 1}`;
      values.push(update.filter.category);
    }

    if (update.filter.endpoint) {
      whereClause += ` AND endpoint LIKE $${values.length + 1}`;
      values.push(`%${update.filter.endpoint}%`);
    }

    // Build update clause
    const updateParts: string[] = [];
    if (update.updates.enabled !== undefined) {
      updateParts.push(`enabled = $${values.length + 1}`);
      values.push(update.updates.enabled);
    }

    if (update.updates.priority !== undefined) {
      updateParts.push(`priority = $${values.length + 1}`);
      values.push(update.updates.priority);
    }

    if (update.updates.category !== undefined) {
      updateParts.push(`category = $${values.length + 1}`);
      values.push(update.updates.category);
    }

    updateParts.push(`updated_at = NOW()`);
    
    const updateClause = updateParts.join(', ');

    const result = await db.queryAll`
      UPDATE endpoint_rate_limits 
      SET ${updateClause}
      ${whereClause}
    `;

    // Log the bulk update
    await this.logBulkUpdate(update, result.length);

    return { updated: result.length };
  }

  /**
   * Get endpoint performance metrics and recommendations
   */
  async getEndpointMetrics(endpoint: string, method: string, days: number = 7): Promise<{
    metrics: {
      totalRequests: number;
      blockedRequests: number;
      uniqueUsers: number;
      avgRequestsPerUser: number;
      peakRequestsPerMinute: number;
      errorRate: number;
      p95ResponseTime: number;
    };
    recommendations: string[];
    configHealth: 'healthy' | 'needs_attention' | 'critical';
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get usage metrics
    const usageResult = await db.queryAll`
      SELECT 
        SUM(request_count) as total_requests,
        SUM(blocked_count) as blocked_requests,
        COUNT(DISTINCT identifier) as unique_users,
        AVG(request_count) as avg_requests_per_user,
        MAX(request_count) as peak_requests_per_minute
      FROM rate_limit_usage
      WHERE endpoint = ${endpoint} 
        AND method = ${method}
        AND created_at >= ${startDate}
    `;

    const metrics = usageResult[0] || {};
    
    // Calculate additional metrics (error rate, response times would come from APM)
    const errorRate = await this.getErrorRate(endpoint, method, days);
    const p95ResponseTime = await this.getP95ResponseTime(endpoint, method, days);

    const fullMetrics = {
      totalRequests: metrics.total_requests || 0,
      blockedRequests: metrics.blocked_requests || 0,
      uniqueUsers: metrics.unique_users || 0,
      avgRequestsPerUser: metrics.avg_requests_per_user || 0,
      peakRequestsPerMinute: metrics.peak_requests_per_minute || 0,
      errorRate,
      p95ResponseTime
    };

    // Generate recommendations
    const recommendations = await this.generateRecommendations(endpoint, method, fullMetrics);
    
    // Assess config health
    const configHealth = this.assessConfigHealth(fullMetrics);

    return {
      metrics: fullMetrics,
      recommendations,
      configHealth
    };
  }

  // Private helper methods

  private async analyzeEndpoint(endpoint: any): Promise<{
    category: 'critical' | 'standard' | 'background' | 'public';
    suggestedLimits: any;
    confidence: number;
    reasoning: string[];
  }> {
    const reasoning: string[] = [];
    let category: 'critical' | 'standard' | 'background' | 'public' = 'standard';
    let confidence = 0.7;

    // Analyze usage patterns
    const avgRequests = endpoint.avg_requests_per_window;
    const peakRequests = endpoint.peak_requests;
    const uniqueUsers = endpoint.unique_users;

    // Categorize based on patterns
    if (endpoint.endpoint.includes('/auth/') || endpoint.endpoint.includes('/login')) {
      category = 'critical';
      reasoning.push('Authentication endpoint detected');
      confidence += 0.2;
    } else if (endpoint.endpoint.includes('/public/') || endpoint.endpoint.includes('/health')) {
      category = 'public';
      reasoning.push('Public endpoint detected');
      confidence += 0.2;
    } else if (avgRequests > 100) {
      category = 'critical';
      reasoning.push('High average usage indicates critical endpoint');
      confidence += 0.1;
    } else if (avgRequests < 10) {
      category = 'background';
      reasoning.push('Low usage suggests background process');
    }

    // Generate suggested limits based on analysis
    const suggestedLimits = this.generateSuggestedLimits(category, avgRequests, peakRequests);

    return {
      category,
      suggestedLimits,
      confidence: Math.min(confidence, 1.0),
      reasoning
    };
  }

  private extractServiceName(endpoint: string): string {
    // Extract service name from endpoint path
    const parts = endpoint.split('/').filter(p => p);
    return parts[0] || 'unknown';
  }

  private async validateEndpointConfig(config: EndpointRateLimitConfig): Promise<void> {
    if (!config.endpoint || !config.method || !config.serviceName) {
      throw new ValidationError("Endpoint, method, and service name are required", "validation");
    }

    if (!config.tiers || Object.keys(config.tiers).length === 0) {
      throw new ValidationError("At least one tier configuration is required", "validation");
    }

    // Validate each tier configuration
    for (const [tier, limits] of Object.entries(config.tiers)) {
      if (limits.windowSeconds <= 0 || limits.maxRequests <= 0) {
        throw new ValidationError(`Invalid limits for tier ${tier}`, "validation");
      }
    }
  }

  private async storeTierLimits(configId: number, tiers: any): Promise<void> {
    for (const [tier, limits] of Object.entries(tiers)) {
      await db.queryAll`
        INSERT INTO endpoint_tier_limits (
          config_id, tier, window_seconds, max_requests, burst_limit, 
          concurrent_limit, cooldown_seconds
        ) VALUES (
          ${configId}, ${tier}, ${limits.windowSeconds}, ${limits.maxRequests},
          ${limits.burstLimit}, ${limits.concurrentLimit || null}, 
          ${limits.cooldownSeconds || null}
        )
      `;
    }
  }

  private async storeSpecialRules(configId: number, rules: any): Promise<void> {
    // Store time-based limits
    if (rules.timeBasedLimits) {
      for (const rule of rules.timeBasedLimits) {
        await db.queryAll`
          INSERT INTO endpoint_time_limits (
            config_id, name, days_of_week, start_time, end_time, 
            timezone, multiplier, enabled
          ) VALUES (
            ${configId}, ${rule.name}, ${rule.schedule.daysOfWeek}, 
            ${rule.schedule.startTime}, ${rule.schedule.endTime},
            ${rule.schedule.timezone}, ${rule.multiplier}, ${rule.enabled}
          )
        `;
      }
    }

    // Store conditional limits
    if (rules.conditionalLimits) {
      for (const rule of rules.conditionalLimits) {
        await db.queryAll`
          INSERT INTO endpoint_conditional_limits (
            config_id, name, conditions, action, limit_multiplier, 
            custom_message, enabled
          ) VALUES (
            ${configId}, ${rule.name}, ${JSON.stringify(rule.conditions)}, 
            ${rule.action}, ${rule.limitMultiplier || null},
            ${rule.customMessage || null}, ${rule.enabled}
          )
        `;
      }
    }

    // Store circuit breaker config
    if (rules.circuitBreaker?.enabled) {
      await db.queryAll`
        INSERT INTO endpoint_circuit_breakers (
          config_id, failure_threshold, recovery_time_seconds, 
          success_threshold, monitor_window_seconds, enabled
        ) VALUES (
          ${configId}, ${rules.circuitBreaker.failureThreshold}, 
          ${rules.circuitBreaker.recoveryTimeSeconds}, 
          ${rules.circuitBreaker.successThreshold},
          ${rules.circuitBreaker.monitorWindowSeconds}, ${rules.circuitBreaker.enabled}
        )
      `;
    }
  }

  private async getEndpointConfig(endpoint: string, method: string): Promise<EndpointRateLimitConfig | null> {
    const result = await db.queryAll`
      SELECT id, endpoint, method, service_name as "serviceName", category, 
             enabled, priority, description
      FROM endpoint_rate_limits
      WHERE endpoint = ${endpoint} AND method = ${method} AND enabled = true
      LIMIT 1
    `;

    if (result.length === 0) return null;

    const config = result[0];
    
    // Load tier limits
    const tierLimits = await db.queryAll`
      SELECT tier, window_seconds as "windowSeconds", max_requests as "maxRequests",
             burst_limit as "burstLimit", concurrent_limit as "concurrentLimit",
             cooldown_seconds as "cooldownSeconds"
      FROM endpoint_tier_limits
      WHERE config_id = ${config.id}
    `;

    config.tiers = {};
    for (const limit of tierLimits) {
      config.tiers[limit.tier] = {
        windowSeconds: limit.windowSeconds,
        maxRequests: limit.maxRequests,
        burstLimit: limit.burstLimit,
        concurrentLimit: limit.concurrentLimit,
        cooldownSeconds: limit.cooldownSeconds
      };
    }

    return config;
  }

  private getDefaultLimits(tier: string): any {
    const defaults = {
      enterprise: { windowSeconds: 60, maxRequests: 1000, burstLimit: 1500 },
      premium: { windowSeconds: 60, maxRequests: 500, burstLimit: 750 },
      basic: { windowSeconds: 60, maxRequests: 100, burstLimit: 150 },
      free: { windowSeconds: 60, maxRequests: 50, burstLimit: 75 }
    };

    return {
      ...defaults[tier as keyof typeof defaults] || defaults.free,
      specialLimitsApplied: []
    };
  }

  private async getTimeBasedAdjustment(
    rules: TimeBasedLimit[], 
    timestamp: Date
  ): Promise<{ multiplier: number; ruleName: string }> {
    const day = timestamp.getDay();
    const timeStr = timestamp.toTimeString().slice(0, 5); // HH:MM format

    for (const rule of rules) {
      if (!rule.enabled) continue;
      
      if (rule.schedule.daysOfWeek.includes(day)) {
        if (timeStr >= rule.schedule.startTime && timeStr <= rule.schedule.endTime) {
          return { multiplier: rule.multiplier, ruleName: rule.name };
        }
      }
    }

    return { multiplier: 1, ruleName: 'none' };
  }

  private async getConditionalAdjustment(
    rules: ConditionalLimit[],
    context: any
  ): Promise<{ multiplier: number; ruleName: string }> {
    for (const rule of rules) {
      if (!rule.enabled) continue;

      let matches = true;

      // Check user agent patterns
      if (rule.conditions.userAgent && context.userAgent) {
        const agentMatches = rule.conditions.userAgent.some(pattern => 
          new RegExp(pattern, 'i').test(context.userAgent)
        );
        if (!agentMatches) matches = false;
      }

      // Add other condition checks...

      if (matches) {
        const multiplier = rule.action === 'restrict' ? (rule.limitMultiplier || 0.5) : 
                          rule.action === 'allow' ? (rule.limitMultiplier || 2.0) : 1;
        return { multiplier, ruleName: rule.name };
      }
    }

    return { multiplier: 1, ruleName: 'none' };
  }

  private async getCircuitBreakerState(endpoint: string, method: string): Promise<'closed' | 'open' | 'half-open'> {
    // Implementation would check circuit breaker state from database
    return 'closed';
  }

  private async getAdaptiveAdjustment(
    endpoint: string, 
    method: string, 
    config: AdaptiveLimitConfig
  ): Promise<{ multiplier: number; reason: string }> {
    // Get recent metrics for adaptive adjustment
    const metrics = await this.getRecentMetrics(endpoint, method, config.baslineWindowMinutes);
    
    let adjustment = 0;
    const reasons: string[] = [];

    for (const metric of config.metrics) {
      const currentValue = metrics[metric.name] || 0;
      
      if (metric.action === 'decrease' && currentValue > metric.threshold) {
        adjustment -= config.adjustmentFactor * metric.weight;
        reasons.push(`${metric.name} above threshold`);
      } else if (metric.action === 'increase' && currentValue < metric.threshold) {
        adjustment += config.adjustmentFactor * metric.weight;
        reasons.push(`${metric.name} below threshold`);
      }
    }

    // Cap adjustment to maximum allowed
    adjustment = Math.max(-config.maxAdjustmentPercent / 100, 
                         Math.min(config.maxAdjustmentPercent / 100, adjustment));

    return {
      multiplier: 1 + adjustment,
      reason: reasons.join(', ') || 'no adjustment needed'
    };
  }

  private generateSuggestedLimits(category: string, avgRequests: number, peakRequests: number): any {
    const baseMultipliers = {
      critical: { basic: 0.5, premium: 2, enterprise: 5 },
      standard: { basic: 1, premium: 3, enterprise: 8 },
      background: { basic: 0.2, premium: 1, enterprise: 3 },
      public: { basic: 2, premium: 5, enterprise: 10 }
    };

    const multipliers = baseMultipliers[category as keyof typeof baseMultipliers];
    const baseLine = Math.max(peakRequests * 1.2, avgRequests * 2);

    const suggestions: any = {};
    for (const [tier, mult] of Object.entries(multipliers)) {
      const maxRequests = Math.ceil(baseLine * mult);
      suggestions[tier] = {
        windowSeconds: 60,
        maxRequests,
        burstLimit: Math.ceil(maxRequests * 1.5)
      };
    }

    return suggestions;
  }

  private async getErrorRate(endpoint: string, method: string, days: number): Promise<number> {
    // This would integrate with your error tracking system
    return 2.5; // Placeholder
  }

  private async getP95ResponseTime(endpoint: string, method: string, days: number): Promise<number> {
    // This would integrate with your APM system
    return 150; // Placeholder
  }

  private async generateRecommendations(endpoint: string, method: string, metrics: any): Promise<string[]> {
    const recommendations: string[] = [];

    if (metrics.blockedRequests / metrics.totalRequests > 0.1) {
      recommendations.push('High blocking rate detected. Consider increasing rate limits.');
    }

    if (metrics.errorRate > 5) {
      recommendations.push('High error rate detected. Check for system issues.');
    }

    if (metrics.p95ResponseTime > 1000) {
      recommendations.push('Slow response times detected. Consider implementing circuit breaker.');
    }

    return recommendations;
  }

  private assessConfigHealth(metrics: any): 'healthy' | 'needs_attention' | 'critical' {
    const blockingRate = metrics.blockedRequests / Math.max(metrics.totalRequests, 1);
    
    if (blockingRate > 0.2 || metrics.errorRate > 10) {
      return 'critical';
    } else if (blockingRate > 0.1 || metrics.errorRate > 5) {
      return 'needs_attention';
    }
    
    return 'healthy';
  }

  private async logBulkUpdate(update: BulkConfigUpdate, affectedCount: number): Promise<void> {
    console.log(`Bulk update applied: ${update.reason}, affected ${affectedCount} configurations`);
  }

  private async getRecentMetrics(endpoint: string, method: string, windowMinutes: number): Promise<any> {
    // Get recent metrics for adaptive calculations
    return {
      errorRate: 2.5,
      responseTime: 150,
      requestRate: 45
    };
  }
}

// Global instance
export const endpointConfigManager = new EndpointConfigManager();

// API endpoints
export const discoverEndpoints = api(
  { method: "GET", path: "/rate-limiting/endpoints/discover", expose: true },
  async (): Promise<{ endpoints: EndpointDiscoveryResult[] }> => {
    const endpoints = await endpointConfigManager.discoverEndpoints();
    return { endpoints };
  }
);

export const createEndpointConfig = api(
  { method: "POST", path: "/rate-limiting/endpoints/config", expose: true },
  async (config: EndpointRateLimitConfig): Promise<{ config: EndpointRateLimitConfig }> => {
    const result = await endpointConfigManager.createEndpointConfig(config);
    return { config: result };
  }
);

export const getEffectiveRateLimits = api(
  { method: "GET", path: "/rate-limiting/endpoints/:endpoint/:method/limits", expose: true },
  async ({ endpoint, method, tier = 'basic' }: { endpoint: string; method: string; tier?: string }) => {
    return await endpointConfigManager.getEffectiveRateLimits(
      decodeURIComponent(endpoint), 
      method.toUpperCase(), 
      tier
    );
  }
);

export const bulkUpdateConfigs = api(
  { method: "PUT", path: "/rate-limiting/endpoints/bulk", expose: true },
  async (update: BulkConfigUpdate) => {
    return await endpointConfigManager.bulkUpdateConfigs(update);
  }
);

export const getEndpointMetrics = api(
  { method: "GET", path: "/rate-limiting/endpoints/:endpoint/:method/metrics", expose: true },
  async ({ endpoint, method, days = 7 }: { endpoint: string; method: string; days?: number }) => {
    return await endpointConfigManager.getEndpointMetrics(
      decodeURIComponent(endpoint), 
      method.toUpperCase(), 
      days
    );
  }
);