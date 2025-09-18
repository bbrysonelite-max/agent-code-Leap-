import { Header } from "encore.dev/api";
import { ValidationError } from "./errors";
import { advancedRateLimiter } from "./advanced-rate-limiting";
import { rateLimitAnalytics } from "./rate-limit-analytics";

export interface RateLimitContext {
  identifier: string;
  endpoint: string;
  method: string;
  userTier: string;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-Retry-After'?: string;
  'X-RateLimit-Global-Remaining'?: string;
  'X-RateLimit-Tier': string;
}

export interface EnhancedRateLimitResult {
  allowed: boolean;
  headers: RateLimitHeaders;
  errorDetails?: {
    code: string;
    message: string;
    retryAfter?: number;
    quotaExceeded?: boolean;
    penaltyActive?: boolean;
    penaltyUntil?: Date;
  };
}

class EnhancedRateLimitingMiddleware {
  private readonly tierPriority = {
    enterprise: 1,
    premium: 2,
    basic: 3,
    free: 4
  };

  /**
   * Main rate limiting check with comprehensive context
   */
  async checkRateLimit(context: RateLimitContext): Promise<EnhancedRateLimitResult> {
    try {
      // Multi-level rate limiting checks
      const checks = await Promise.all([
        this.checkPrimaryRateLimit(context),
        this.checkGlobalQuotaLimits(context),
        this.checkAbuseDetection(context),
        this.checkServiceHealthThrottling(context)
      ]);

      // If any check fails, return the most restrictive result
      const failedCheck = checks.find(check => !check.allowed);
      if (failedCheck) {
        await this.recordViolation(context, failedCheck.errorDetails?.code || 'rate_limit');
        return failedCheck;
      }

      // All checks passed - record successful request
      await this.recordSuccessfulRequest(context);
      
      // Return success with remaining quota info
      return checks[0]; // Primary check has the most relevant headers

    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      
      // Fail open with warning headers
      return {
        allowed: true,
        headers: this.createHeaders({
          limit: '∞',
          remaining: '∞',
          reset: new Date(Date.now() + 60000).toISOString(),
          tier: context.userTier
        })
      };
    }
  }

  /**
   * Primary rate limit check using existing advanced rate limiter
   */
  private async checkPrimaryRateLimit(context: RateLimitContext): Promise<EnhancedRateLimitResult> {
    const result = await advancedRateLimiter.checkRateLimit(
      context.identifier,
      context.endpoint,
      context.method,
      context.userTier
    );

    const headers = this.createHeaders({
      limit: await this.getRuleLimit(context),
      remaining: result.remainingQuota?.toString() || '0',
      reset: result.windowReset?.toISOString() || new Date(Date.now() + 60000).toISOString(),
      tier: context.userTier,
      retryAfter: result.retryAfter?.toString()
    });

    if (!result.allowed) {
      return {
        allowed: false,
        headers,
        errorDetails: {
          code: result.quotaExceeded ? 'quota_exceeded' : 
                result.penaltyActive ? 'rate_limit_penalty' : 'rate_limit_exceeded',
          message: this.getErrorMessage(result),
          retryAfter: result.retryAfter,
          quotaExceeded: result.quotaExceeded,
          penaltyActive: result.penaltyActive,
          penaltyUntil: result.penaltyUntil
        }
      };
    }

    return { allowed: true, headers };
  }

  /**
   * Global quota limits across all endpoints
   */
  private async checkGlobalQuotaLimits(context: RateLimitContext): Promise<EnhancedRateLimitResult> {
    if (!context.userId) {
      return { 
        allowed: true, 
        headers: this.createHeaders({ limit: '∞', remaining: '∞', reset: '', tier: context.userTier }) 
      };
    }

    const globalUsage = await this.getGlobalUserUsage(context.userId);
    const tierLimits = this.getTierGlobalLimits(context.userTier);

    const dailyRemaining = tierLimits.dailyGlobal - globalUsage.dailyTotal;
    const hourlyRemaining = tierLimits.hourlyGlobal - globalUsage.hourlyTotal;

    const headers = this.createHeaders({
      limit: tierLimits.dailyGlobal.toString(),
      remaining: Math.min(dailyRemaining, hourlyRemaining).toString(),
      reset: this.getNextResetTime().toISOString(),
      tier: context.userTier,
      globalRemaining: dailyRemaining.toString()
    });

    if (dailyRemaining <= 0 || hourlyRemaining <= 0) {
      return {
        allowed: false,
        headers,
        errorDetails: {
          code: 'global_quota_exceeded',
          message: 'Global daily or hourly quota exceeded across all endpoints',
          retryAfter: this.getRetryAfterSeconds(dailyRemaining <= 0 ? 'daily' : 'hourly')
        }
      };
    }

    return { allowed: true, headers };
  }

  /**
   * Abuse detection based on patterns
   */
  private async checkAbuseDetection(context: RateLimitContext): Promise<EnhancedRateLimitResult> {
    const abuseScore = await this.calculateAbuseScore(context);
    
    const headers = this.createHeaders({
      limit: '100', // Base limit
      remaining: Math.max(0, 100 - abuseScore).toString(),
      reset: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      tier: context.userTier
    });

    // High abuse score triggers temporary throttling
    if (abuseScore > 80) {
      return {
        allowed: false,
        headers,
        errorDetails: {
          code: 'abuse_detected',
          message: 'Suspicious activity detected. Temporary throttling applied.',
          retryAfter: Math.min(3600, Math.pow(2, Math.floor(abuseScore / 20))) // Exponential backoff
        }
      };
    }

    return { allowed: true, headers };
  }

  /**
   * Service health-based throttling
   */
  private async checkServiceHealthThrottling(context: RateLimitContext): Promise<EnhancedRateLimitResult> {
    const healthScore = await this.getServiceHealthScore(context.endpoint);
    
    // Apply throttling based on service health
    let allowedPercentage = 100;
    if (healthScore < 50) {
      allowedPercentage = 20; // Severe throttling
    } else if (healthScore < 70) {
      allowedPercentage = 50; // Moderate throttling
    } else if (healthScore < 90) {
      allowedPercentage = 80; // Light throttling
    }

    const headers = this.createHeaders({
      limit: allowedPercentage.toString(),
      remaining: allowedPercentage.toString(),
      reset: new Date(Date.now() + 300000).toISOString(), // 5 minutes
      tier: context.userTier
    });

    // Random throttling based on health score
    if (Math.random() * 100 > allowedPercentage) {
      return {
        allowed: false,
        headers,
        errorDetails: {
          code: 'service_throttling',
          message: `Service experiencing high load. ${100 - allowedPercentage}% of requests being throttled.`,
          retryAfter: Math.floor(Math.random() * 60) + 30 // Random 30-90 seconds
        }
      };
    }

    return { allowed: true, headers };
  }

  /**
   * Calculate abuse score based on various factors
   */
  private async calculateAbuseScore(context: RateLimitContext): Promise<number> {
    let score = 0;

    // Check request frequency patterns
    const recentActivity = await this.getRecentActivity(context.identifier);
    
    // Rapid consecutive requests
    if (recentActivity.requestsLast5Minutes > 100) {
      score += 30;
    }
    
    // Multiple endpoints hit rapidly
    if (recentActivity.uniqueEndpointsLast5Minutes > 10) {
      score += 20;
    }

    // Repeated violations
    const violationHistory = await this.getViolationHistory(context.identifier);
    score += Math.min(violationHistory.last24Hours * 5, 30);

    // User agent patterns (bot detection)
    if (this.detectBotUserAgent(context.userAgent)) {
      score += 15;
    }

    // Time-based patterns (off-hours traffic spikes)
    if (this.isOffHoursActivity()) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Get service health score for specific endpoint
   */
  private async getServiceHealthScore(endpoint: string): Promise<number> {
    try {
      // This would integrate with your monitoring system
      // For now, simulate based on recent error rates and response times
      const healthMetrics = await rateLimitAnalytics.getHealthScore();
      
      // Adjust score based on endpoint-specific metrics
      const endpointMetrics = await this.getEndpointHealthMetrics(endpoint);
      
      let adjustedScore = healthMetrics.score;
      if (endpointMetrics.errorRate > 5) adjustedScore -= 20;
      if (endpointMetrics.avgResponseTime > 2000) adjustedScore -= 15;
      if (endpointMetrics.p95ResponseTime > 5000) adjustedScore -= 25;

      return Math.max(0, Math.min(100, adjustedScore));
    } catch (error) {
      console.error('Error getting service health score:', error);
      return 95; // Assume healthy if can't determine
    }
  }

  /**
   * Record successful request for analytics
   */
  private async recordSuccessfulRequest(context: RateLimitContext): Promise<void> {
    // This would be handled by the advanced rate limiter
    // Additional custom tracking can be added here
  }

  /**
   * Record rate limit violation
   */
  private async recordViolation(context: RateLimitContext, violationType: string): Promise<void> {
    try {
      // Log violation for analysis
      console.warn(`Rate limit violation: ${violationType}`, {
        identifier: context.identifier,
        endpoint: context.endpoint,
        method: context.method,
        tier: context.userTier,
        timestamp: new Date().toISOString()
      });

      // Update analytics
      await rateLimitAnalytics.checkAlertConditions();
    } catch (error) {
      console.error('Error recording violation:', error);
    }
  }

  /**
   * Helper methods
   */
  private createHeaders(params: {
    limit: string;
    remaining: string;
    reset: string;
    tier: string;
    retryAfter?: string;
    globalRemaining?: string;
  }): RateLimitHeaders {
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': params.limit,
      'X-RateLimit-Remaining': params.remaining,
      'X-RateLimit-Reset': params.reset,
      'X-RateLimit-Tier': params.tier
    };

    if (params.retryAfter) {
      headers['X-RateLimit-Retry-After'] = params.retryAfter;
    }

    if (params.globalRemaining) {
      headers['X-RateLimit-Global-Remaining'] = params.globalRemaining;
    }

    return headers;
  }

  private async getRuleLimit(context: RateLimitContext): Promise<string> {
    // This would query the rate limit rules table
    return '100'; // Default fallback
  }

  private getErrorMessage(result: any): string {
    if (result.quotaExceeded) {
      return 'Daily or monthly quota exceeded. Please upgrade your plan or wait for quota reset.';
    }
    if (result.penaltyActive) {
      return 'Rate limit penalty active due to repeated violations. Please reduce request frequency.';
    }
    return 'Rate limit exceeded. Please wait before making more requests.';
  }

  private async getGlobalUserUsage(userId: string): Promise<{
    dailyTotal: number;
    hourlyTotal: number;
  }> {
    // This would query the usage tables
    return { dailyTotal: 0, hourlyTotal: 0 };
  }

  private getTierGlobalLimits(tier: string): {
    dailyGlobal: number;
    hourlyGlobal: number;
  } {
    const limits = {
      enterprise: { dailyGlobal: 50000, hourlyGlobal: 5000 },
      premium: { dailyGlobal: 15000, hourlyGlobal: 2000 },
      basic: { dailyGlobal: 5000, hourlyGlobal: 500 },
      free: { dailyGlobal: 1000, hourlyGlobal: 100 }
    };

    return limits[tier as keyof typeof limits] || limits.free;
  }

  private getNextResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private getRetryAfterSeconds(period: 'hourly' | 'daily'): number {
    if (period === 'hourly') {
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      return Math.ceil((nextHour.getTime() - Date.now()) / 1000);
    } else {
      const tomorrow = this.getNextResetTime();
      return Math.ceil((tomorrow.getTime() - Date.now()) / 1000);
    }
  }

  private async getRecentActivity(identifier: string): Promise<{
    requestsLast5Minutes: number;
    uniqueEndpointsLast5Minutes: number;
  }> {
    // This would query recent activity from the usage tables
    return { requestsLast5Minutes: 0, uniqueEndpointsLast5Minutes: 0 };
  }

  private async getViolationHistory(identifier: string): Promise<{
    last24Hours: number;
    lastWeek: number;
  }> {
    // Query violation history from penalties table
    return { last24Hours: 0, lastWeek: 0 };
  }

  private detectBotUserAgent(userAgent?: string): boolean {
    if (!userAgent) return false;
    
    const botPatterns = [
      /bot/i, /crawl/i, /spider/i, /scrape/i,
      /curl/i, /wget/i, /python/i, /java/i,
      /postman/i, /insomnia/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  private isOffHoursActivity(): boolean {
    const hour = new Date().getHours();
    // Consider 11 PM to 6 AM as off-hours (in UTC)
    return hour >= 23 || hour <= 6;
  }

  private async getEndpointHealthMetrics(endpoint: string): Promise<{
    errorRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
  }> {
    // This would integrate with your monitoring/APM system
    return {
      errorRate: 1, // Percentage
      avgResponseTime: 150, // Milliseconds
      p95ResponseTime: 500 // Milliseconds
    };
  }
}

// Global instance
export const enhancedRateLimitingMiddleware = new EnhancedRateLimitingMiddleware();

/**
 * Convenience middleware function for Encore.ts APIs
 */
export async function withEnhancedRateLimit(
  context: Partial<RateLimitContext>,
  userAgent?: Header<"user-agent">,
  forwardedFor?: Header<"x-forwarded-for">
): Promise<void> {
  const fullContext: RateLimitContext = {
    identifier: context.identifier || context.userId || context.ipAddress || 'anonymous',
    endpoint: context.endpoint || '',
    method: context.method || 'GET',
    userTier: context.userTier || 'basic',
    userAgent: userAgent || undefined,
    ipAddress: forwardedFor || undefined,
    userId: context.userId
  };

  const result = await enhancedRateLimitingMiddleware.checkRateLimit(fullContext);

  if (!result.allowed && result.errorDetails) {
    throw new ValidationError(
      result.errorDetails.message,
      result.errorDetails.code,
      {
        retryAfter: result.errorDetails.retryAfter,
        quotaExceeded: result.errorDetails.quotaExceeded,
        penaltyActive: result.errorDetails.penaltyActive,
        penaltyUntil: result.errorDetails.penaltyUntil,
        headers: result.headers
      }
    );
  }

  // Set response headers (this would be handled by the framework)
  // In a real implementation, you'd set these on the HTTP response
}

/**
 * Create rate limiting decorator for endpoints
 */
export function rateLimited(config?: {
  tier?: string;
  identifier?: (req: any) => string;
  skipCondition?: (req: any) => boolean;
}) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const req = args[0]; // Assume first argument is request
      
      // Skip rate limiting if condition is met
      if (config?.skipCondition && config.skipCondition(req)) {
        return originalMethod.apply(this, args);
      }

      // Extract context from request
      const context: RateLimitContext = {
        identifier: config?.identifier ? config.identifier(req) : 'anonymous',
        endpoint: `${target.constructor.name}.${propertyKey}`,
        method: 'POST', // Default to POST for API calls
        userTier: config?.tier || 'basic',
        userId: req.userId || req.user?.id
      };

      // Check rate limit
      await withEnhancedRateLimit(context);

      // Proceed with original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}