import { ValidationError } from "./errors";
import { db } from "../rate_limiting/db";

export interface RateLimitRule {
  id: number;
  endpoint: string;
  method: string;
  tier: string;
  windowSeconds: number;
  maxRequests: number;
  burstLimit: number;
  enabled: boolean;
}

export interface UserQuota {
  id: number;
  userId: string;
  tier: string;
  dailyQuota: number;
  monthlyQuota: number;
  currentDailyUsage: number;
  currentMonthlyUsage: number;
  quotaResetDate: string;
  monthlyResetDate: string;
}

export interface RateLimitUsage {
  id: number;
  identifier: string;
  endpoint: string;
  method: string;
  requestCount: number;
  windowStart: Date;
  windowEnd: Date;
  blockedCount: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  quotaExceeded?: boolean;
  penaltyActive?: boolean;
  remainingQuota?: number;
  windowReset?: Date;
  penaltyUntil?: Date;
}

export interface BackoffPenalty {
  identifier: string;
  endpoint: string;
  violationCount: number;
  penaltyMultiplier: number;
  penaltyUntil: Date;
}

export class AdvancedRateLimiter {
  private cache = new Map<string, any>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired cache entries and reset quotas every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
      this.resetExpiredQuotas();
    }, 60 * 1000);
  }

  async checkRateLimit(
    identifier: string,
    endpoint: string,
    method: string,
    userTier: string = 'basic'
  ): Promise<RateLimitResult> {
    try {
      // Check if user has active penalty
      const penalty = await this.getActivePenalty(identifier, endpoint);
      if (penalty) {
        return {
          allowed: false,
          penaltyActive: true,
          penaltyUntil: penalty.penaltyUntil,
          retryAfter: Math.ceil((penalty.penaltyUntil.getTime() - Date.now()) / 1000)
        };
      }

      // Get rate limit rule for this endpoint and tier
      const rule = await this.getRateLimitRule(endpoint, method, userTier);
      if (!rule || !rule.enabled) {
        return { allowed: true };
      }

      // Check user quota first
      const quotaCheck = await this.checkUserQuota(identifier, userTier);
      if (!quotaCheck.allowed) {
        return {
          allowed: false,
          quotaExceeded: true,
          remainingQuota: quotaCheck.remainingQuota,
          retryAfter: quotaCheck.retryAfter
        };
      }

      // Check rate limit window
      const windowCheck = await this.checkRateLimitWindow(
        identifier,
        endpoint,
        method,
        rule
      );

      if (!windowCheck.allowed) {
        // Record violation and potentially apply penalty
        await this.recordViolation(identifier, endpoint);
        return windowCheck;
      }

      // Record successful request
      await this.recordRequest(identifier, endpoint, method, rule);
      await this.incrementUserQuota(identifier);

      return {
        allowed: true,
        remainingQuota: quotaCheck.remainingQuota - 1,
        windowReset: windowCheck.windowReset
      };

    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - allow request if rate limiting system fails
      return { allowed: true };
    }
  }

  private async getRateLimitRule(
    endpoint: string,
    method: string,
    tier: string
  ): Promise<RateLimitRule | null> {
    const cacheKey = `rule:${endpoint}:${method}:${tier}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = await db.query`
      SELECT id, endpoint, method, tier, window_seconds as "windowSeconds",
             max_requests as "maxRequests", burst_limit as "burstLimit", enabled
      FROM rate_limit_rules
      WHERE endpoint = ${endpoint} AND method = ${method} AND tier = ${tier}
      AND enabled = true
      LIMIT 1
    `;

    const rule = result.length > 0 ? result[0] : null;
    
    // Cache for 5 minutes
    this.cache.set(cacheKey, rule);
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

    return rule;
  }

  private async checkUserQuota(
    userId: string,
    tier: string
  ): Promise<{ allowed: boolean; remainingQuota: number; retryAfter?: number }> {
    const quota = await this.getUserQuota(userId, tier);
    
    const dailyRemaining = quota.dailyQuota - quota.currentDailyUsage;
    const monthlyRemaining = quota.monthlyQuota - quota.currentMonthlyUsage;
    
    if (dailyRemaining <= 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const retryAfter = Math.ceil((tomorrow.getTime() - Date.now()) / 1000);
      
      return { allowed: false, remainingQuota: 0, retryAfter };
    }

    if (monthlyRemaining <= 0) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      const retryAfter = Math.ceil((nextMonth.getTime() - Date.now()) / 1000);
      
      return { allowed: false, remainingQuota: 0, retryAfter };
    }

    return { 
      allowed: true, 
      remainingQuota: Math.min(dailyRemaining, monthlyRemaining) 
    };
  }

  private async getUserQuota(userId: string, tier: string): Promise<UserQuota> {
    const cacheKey = `quota:${userId}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = await db.query`
      SELECT id, user_id as "userId", tier, daily_quota as "dailyQuota",
             monthly_quota as "monthlyQuota", current_daily_usage as "currentDailyUsage",
             current_monthly_usage as "currentMonthlyUsage",
             quota_reset_date as "quotaResetDate", monthly_reset_date as "monthlyResetDate"
      FROM user_quotas
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    let quota: UserQuota;
    
    if (result.length === 0) {
      // Create new quota for user
      const defaultQuota = await this.getDefaultQuotaForTier(tier);
      await db.query`
        INSERT INTO user_quotas (user_id, tier, daily_quota, monthly_quota)
        VALUES (${userId}, ${tier}, ${defaultQuota.dailyQuota}, ${defaultQuota.monthlyQuota})
      `;
      
      quota = {
        id: 0,
        userId,
        tier,
        dailyQuota: defaultQuota.dailyQuota,
        monthlyQuota: defaultQuota.monthlyQuota,
        currentDailyUsage: 0,
        currentMonthlyUsage: 0,
        quotaResetDate: new Date().toISOString().split('T')[0],
        monthlyResetDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      };
    } else {
      quota = result[0];
    }

    // Cache for 30 seconds to balance consistency and performance
    this.cache.set(cacheKey, quota);
    setTimeout(() => this.cache.delete(cacheKey), 30 * 1000);

    return quota;
  }

  private async getDefaultQuotaForTier(tier: string): Promise<{ dailyQuota: number; monthlyQuota: number }> {
    const defaults = {
      basic: { dailyQuota: 1000, monthlyQuota: 30000 },
      premium: { dailyQuota: 5000, monthlyQuota: 150000 },
      enterprise: { dailyQuota: 20000, monthlyQuota: 600000 }
    };

    return defaults[tier as keyof typeof defaults] || defaults.basic;
  }

  private async checkRateLimitWindow(
    identifier: string,
    endpoint: string,
    method: string,
    rule: RateLimitRule
  ): Promise<{ allowed: boolean; retryAfter?: number; windowReset?: Date }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (rule.windowSeconds * 1000));
    const windowEnd = new Date(now.getTime() + (rule.windowSeconds * 1000));

    const result = await db.query`
      SELECT request_count as "requestCount", blocked_count as "blockedCount"
      FROM rate_limit_usage
      WHERE identifier = ${identifier}
        AND endpoint = ${endpoint}
        AND method = ${method}
        AND window_start <= ${now}
        AND window_end > ${now}
      ORDER BY window_start DESC
      LIMIT 1
    `;

    const currentUsage = result.length > 0 ? result[0] : null;
    const requestCount = currentUsage ? currentUsage.requestCount : 0;

    // Check against burst limit first, then regular limit
    const effectiveLimit = rule.burstLimit > 0 ? rule.burstLimit : rule.maxRequests;
    
    if (requestCount >= effectiveLimit) {
      const retryAfter = rule.windowSeconds - Math.floor((now.getTime() - windowStart.getTime()) / 1000);
      return { 
        allowed: false, 
        retryAfter: Math.max(1, retryAfter),
        windowReset: windowEnd
      };
    }

    return { allowed: true, windowReset: windowEnd };
  }

  private async recordRequest(
    identifier: string,
    endpoint: string,
    method: string,
    rule: RateLimitRule
  ): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - (rule.windowSeconds * 1000));
    const windowEnd = new Date(now.getTime() + (rule.windowSeconds * 1000));

    await db.query`
      INSERT INTO rate_limit_usage (identifier, endpoint, method, request_count, window_start, window_end)
      VALUES (${identifier}, ${endpoint}, ${method}, 1, ${windowStart}, ${windowEnd})
      ON CONFLICT (identifier, endpoint, method, window_start)
      DO UPDATE SET 
        request_count = rate_limit_usage.request_count + 1,
        updated_at = NOW()
    `;
  }

  private async incrementUserQuota(userId: string): Promise<void> {
    await db.query`
      UPDATE user_quotas
      SET current_daily_usage = current_daily_usage + 1,
          current_monthly_usage = current_monthly_usage + 1,
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    // Invalidate cache
    this.cache.delete(`quota:${userId}`);
  }

  private async recordViolation(identifier: string, endpoint: string): Promise<void> {
    const now = new Date();
    
    // Update blocked count
    await db.query`
      UPDATE rate_limit_usage
      SET blocked_count = blocked_count + 1,
          updated_at = NOW()
      WHERE identifier = ${identifier}
        AND endpoint = ${endpoint}
        AND window_start <= ${now}
        AND window_end > ${now}
    `;

    // Check for repeated violations and apply penalty
    await this.applyIntelligentBackoff(identifier, endpoint);
  }

  private async applyIntelligentBackoff(identifier: string, endpoint: string): Promise<void> {
    const result = await db.query`
      SELECT violation_count as "violationCount", penalty_multiplier as "penaltyMultiplier"
      FROM rate_limit_penalties
      WHERE identifier = ${identifier} AND endpoint = ${endpoint}
      LIMIT 1
    `;

    let violationCount = 1;
    let penaltyMultiplier = 1.0;

    if (result.length > 0) {
      violationCount = result[0].violationCount + 1;
      penaltyMultiplier = Math.min(result[0].penaltyMultiplier * 1.5, 10.0);
    }

    // Calculate penalty duration (exponential backoff)
    const basePenaltyMinutes = 5;
    const penaltyMinutes = basePenaltyMinutes * Math.pow(2, violationCount - 1) * penaltyMultiplier;
    const penaltyUntil = new Date(Date.now() + (penaltyMinutes * 60 * 1000));

    await db.query`
      INSERT INTO rate_limit_penalties (identifier, endpoint, violation_count, penalty_multiplier, penalty_until)
      VALUES (${identifier}, ${endpoint}, ${violationCount}, ${penaltyMultiplier}, ${penaltyUntil})
      ON CONFLICT (identifier, endpoint)
      DO UPDATE SET
        violation_count = ${violationCount},
        penalty_multiplier = ${penaltyMultiplier},
        penalty_until = ${penaltyUntil},
        updated_at = NOW()
    `;
  }

  private async getActivePenalty(identifier: string, endpoint: string): Promise<BackoffPenalty | null> {
    const now = new Date();
    
    const result = await db.query`
      SELECT identifier, endpoint, violation_count as "violationCount",
             penalty_multiplier as "penaltyMultiplier", penalty_until as "penaltyUntil"
      FROM rate_limit_penalties
      WHERE identifier = ${identifier}
        AND endpoint = ${endpoint}
        AND penalty_until > ${now}
      LIMIT 1
    `;

    return result.length > 0 ? result[0] : null;
  }

  private async resetExpiredQuotas(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // Reset daily quotas
    await db.query`
      UPDATE user_quotas
      SET current_daily_usage = 0,
          quota_reset_date = ${today},
          updated_at = NOW()
      WHERE quota_reset_date < ${today}
    `;

    // Reset monthly quotas
    await db.query`
      UPDATE user_quotas
      SET current_monthly_usage = 0,
          monthly_reset_date = ${firstOfMonth},
          updated_at = NOW()
      WHERE monthly_reset_date < ${firstOfMonth}
    `;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value && value.expiry && now > value.expiry) {
        this.cache.delete(key);
      }
    }
  }

  async getRateLimitStats(identifier: string, endpoint?: string): Promise<any> {
    const whereClause = endpoint 
      ? `WHERE identifier = ${identifier} AND endpoint = ${endpoint}`
      : `WHERE identifier = ${identifier}`;

    const result = await db.query`
      SELECT endpoint, method, 
             SUM(request_count) as total_requests,
             SUM(blocked_count) as total_blocked,
             COUNT(*) as total_windows
      FROM rate_limit_usage
      ${whereClause}
      AND window_start >= NOW() - INTERVAL '24 hours'
      GROUP BY endpoint, method
      ORDER BY total_requests DESC
    `;

    return result;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global instance
export const advancedRateLimiter = new AdvancedRateLimiter();

// Convenience function for middleware
export async function checkAdvancedRateLimit(
  identifier: string,
  endpoint: string,
  method: string,
  userTier: string = 'basic'
): Promise<void> {
  const result = await advancedRateLimiter.checkRateLimit(identifier, endpoint, method, userTier);
  
  if (!result.allowed) {
    let message = 'Rate limit exceeded.';
    let errorCode = 'rate_limit_exceeded';
    
    if (result.quotaExceeded) {
      message = 'Daily or monthly quota exceeded.';
      errorCode = 'quota_exceeded';
    } else if (result.penaltyActive) {
      message = 'Rate limit penalty active due to repeated violations.';
      errorCode = 'rate_limit_penalty';
    }

    throw new ValidationError(
      message,
      errorCode,
      {
        retryAfter: result.retryAfter,
        quotaExceeded: result.quotaExceeded,
        penaltyActive: result.penaltyActive,
        remainingQuota: result.remainingQuota,
        penaltyUntil: result.penaltyUntil
      }
    );
  }
}