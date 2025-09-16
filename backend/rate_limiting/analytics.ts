import { api } from "encore.dev/api";
import { rateLimitAnalytics } from "../shared/rate-limit-analytics";

export interface AnalyticsRequest {
  startDate: string;
  endDate: string;
  endpoint?: string;
  tier?: string;
}

export interface UsageStatsRequest {
  timeWindowMinutes?: number;
}

export interface UserQuotaRequest {
  userId?: string;
}

// Get rate limiting analytics for date range
export const getAnalytics = api(
  { method: "GET", path: "/rate-limiting/analytics", expose: true },
  async ({ startDate, endDate, endpoint, tier }: AnalyticsRequest) => {
    return await rateLimitAnalytics.getAnalytics(startDate, endDate, endpoint, tier);
  }
);

// Get real-time usage statistics
export const getRealTimeUsage = api(
  { method: "GET", path: "/rate-limiting/usage/realtime", expose: true },
  async ({ timeWindowMinutes = 5 }: UsageStatsRequest) => {
    return await rateLimitAnalytics.getRealTimeUsage(timeWindowMinutes);
  }
);

// Get user quota usage
export const getUserQuotaUsage = api(
  { method: "GET", path: "/rate-limiting/usage/quotas", expose: true },
  async ({ userId }: UserQuotaRequest) => {
    return await rateLimitAnalytics.getUserQuotaUsage(userId);
  }
);

// Get top violators
export const getTopViolators = api(
  { method: "GET", path: "/rate-limiting/violators", expose: true },
  async ({ limit = 10 }: { limit?: number }) => {
    return await rateLimitAnalytics.getTopViolators(limit);
  }
);

// Get rate limiting health score
export const getHealthScore = api(
  { method: "GET", path: "/rate-limiting/health", expose: true },
  async () => {
    return await rateLimitAnalytics.getHealthScore();
  }
);

// Trigger manual analytics generation
export const generateAnalytics = api(
  { method: "POST", path: "/rate-limiting/analytics/generate", expose: true },
  async ({ date }: { date?: string }) => {
    return await rateLimitAnalytics.generateDailyAnalytics(date);
  }
);

// Check current alert conditions
export const checkAlerts = api(
  { method: "GET", path: "/rate-limiting/alerts/check", expose: true },
  async () => {
    return await rateLimitAnalytics.checkAlertConditions();
  }
);

// Get rate limit statistics for specific identifier
export const getIdentifierStats = api(
  { method: "GET", path: "/rate-limiting/stats/:identifier", expose: true },
  async ({ identifier, endpoint }: { identifier: string; endpoint?: string }) => {
    const advancedRateLimiter = await import("../shared/advanced-rate-limiting");
    return await advancedRateLimiter.advancedRateLimiter.getRateLimitStats(identifier, endpoint);
  }
);