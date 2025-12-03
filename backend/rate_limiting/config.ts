import { api } from "encore.dev/api";
import { db } from "./db";
import { ValidationError } from "../shared/errors";

export interface RateLimitRule {
  id?: number;
  endpoint: string;
  method: string;
  tier: string;
  windowSeconds: number;
  maxRequests: number;
  burstLimit: number;
  enabled: boolean;
}

export interface CreateRateLimitRuleRequest {
  endpoint: string;
  method: string;
  tier: string;
  windowSeconds: number;
  maxRequests: number;
  burstLimit?: number;
  enabled?: boolean;
}

export interface UpdateRateLimitRuleRequest {
  id: number;
  windowSeconds?: number;
  maxRequests?: number;
  burstLimit?: number;
  enabled?: boolean;
}

export interface UserQuotaConfig {
  id?: number;
  userId: string;
  tier: string;
  dailyQuota: number;
  monthlyQuota: number;
}

export interface CreateUserQuotaRequest {
  userId: string;
  tier: string;
  dailyQuota: number;
  monthlyQuota: number;
}

export interface UpdateUserQuotaRequest {
  userId: string;
  tier?: string;
  dailyQuota?: number;
  monthlyQuota?: number;
}

// Get all rate limit rules
export const getRules = api(
  { method: "GET", path: "/rate-limiting/rules", expose: true },
  async () => {
    const result = await db.queryAll`
      SELECT 
        id, endpoint, method, tier,
        window_seconds as "windowSeconds",
        max_requests as "maxRequests", 
        burst_limit as "burstLimit",
        enabled
      FROM rate_limit_rules
      ORDER BY endpoint, method, tier
    `;

    return result;
  }
);

// Get rate limit rules for specific endpoint
export const getRulesByEndpoint = api(
  { method: "GET", path: "/rate-limiting/rules/by-endpoint/:endpoint", expose: true },
  async ({ endpoint }: { endpoint: string }) => {
    const result = await db.queryAll`
      SELECT 
        id, endpoint, method, tier,
        window_seconds as "windowSeconds",
        max_requests as "maxRequests",
        burst_limit as "burstLimit", 
        enabled
      FROM rate_limit_rules
      WHERE endpoint = ${endpoint}
      ORDER BY method, tier
    `;

    return result;
  }
);

// Create new rate limit rule
export const createRule = api(
  { method: "POST", path: "/rate-limiting/rules", expose: true },
  async (req: CreateRateLimitRuleRequest): Promise<RateLimitRule> => {
    if (!req.endpoint || !req.method || !req.tier) {
      throw new ValidationError("Endpoint, method, and tier are required", "validation");
    }

    if (req.windowSeconds <= 0 || req.maxRequests <= 0) {
      throw new ValidationError("Window seconds and max requests must be positive", "validation");
    }

    const burstLimit = req.burstLimit || 0;
    const enabled = req.enabled !== false;

    const result = await db.queryAll`
      INSERT INTO rate_limit_rules (
        endpoint, method, tier, window_seconds, max_requests, burst_limit, enabled
      ) VALUES (
        ${req.endpoint}, ${req.method}, ${req.tier}, ${req.windowSeconds}, 
        ${req.maxRequests}, ${burstLimit}, ${enabled}
      )
      RETURNING id, endpoint, method, tier,
                window_seconds as "windowSeconds",
                max_requests as "maxRequests",
                burst_limit as "burstLimit",
                enabled
    `;

    return result[0] as RateLimitRule;
  }
);

// Update rate limit rule
export const updateRule = api(
  { method: "PUT", path: "/rate-limiting/rules/:id", expose: true },
  async ({ id, ...updates }: UpdateRateLimitRuleRequest): Promise<RateLimitRule> => {
    if (!id) {
      throw new ValidationError("Rule ID is required", "validation");
    }

    // Fetch current rule
    const currentResults = await db.queryAll`
      SELECT * FROM rate_limit_rules WHERE id = ${id}
    `;
    
    if (currentResults.length === 0) {
      throw new ValidationError("Rate limit rule not found", "not_found");
    }
    
    const current = currentResults[0] as any;

    // Validate and merge updates
    const windowSeconds = updates.windowSeconds !== undefined ? updates.windowSeconds : current.window_seconds;
    const maxRequests = updates.maxRequests !== undefined ? updates.maxRequests : current.max_requests;
    const burstLimit = updates.burstLimit !== undefined ? updates.burstLimit : current.burst_limit;
    const enabled = updates.enabled !== undefined ? updates.enabled : current.enabled;

    if (updates.windowSeconds !== undefined && updates.windowSeconds <= 0) {
      throw new ValidationError("Window seconds must be positive", "validation");
    }

    if (updates.maxRequests !== undefined && updates.maxRequests <= 0) {
      throw new ValidationError("Max requests must be positive", "validation");
    }
    
    const result = await db.queryAll`
      UPDATE rate_limit_rules 
      SET window_seconds = ${windowSeconds},
          max_requests = ${maxRequests},
          burst_limit = ${burstLimit},
          enabled = ${enabled},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, endpoint, method, tier,
                window_seconds as "windowSeconds",
                max_requests as "maxRequests", 
                burst_limit as "burstLimit",
                enabled
    `;

    if (result.length === 0) {
      throw new ValidationError("Rate limit rule not found", "not_found");
    }

    return result[0] as RateLimitRule;
  }
);

// Delete rate limit rule
export const deleteRule = api(
  { method: "DELETE", path: "/rate-limiting/rules/:id", expose: true },
  async ({ id }: { id: number }): Promise<{ success: boolean }> => {
    const result = await db.queryAll`
      DELETE FROM rate_limit_rules WHERE id = ${id}
    `;

    return { success: true };
  }
);

// Get user quotas
export const getUserQuotas = api(
  { method: "GET", path: "/rate-limiting/quotas", expose: true },
  async () => {
    const result = await db.queryAll`
      SELECT 
        id, user_id as "userId", tier,
        daily_quota as "dailyQuota",
        monthly_quota as "monthlyQuota"
      FROM user_quotas
      ORDER BY tier, user_id
    `;

    return result;
  }
);

// Get user quota by user ID
export const getUserQuota = api(
  { method: "GET", path: "/rate-limiting/quotas/:userId", expose: true },
  async ({ userId }: { userId: string }): Promise<UserQuotaConfig> => {
    const result = await db.queryAll`
      SELECT 
        id, user_id as "userId", tier,
        daily_quota as "dailyQuota",
        monthly_quota as "monthlyQuota"
      FROM user_quotas
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (result.length === 0) {
      throw new ValidationError("User quota not found", "not_found");
    }

    return result[0] as any;
  }
);

// Create user quota
export const createUserQuota = api(
  { method: "POST", path: "/rate-limiting/quotas", expose: true },
  async (req: CreateUserQuotaRequest): Promise<UserQuotaConfig> => {
    if (!req.userId || !req.tier) {
      throw new ValidationError("User ID and tier are required", "validation");
    }

    if (req.dailyQuota <= 0 || req.monthlyQuota <= 0) {
      throw new ValidationError("Quotas must be positive", "validation");
    }

    const result = await db.queryAll`
      INSERT INTO user_quotas (user_id, tier, daily_quota, monthly_quota)
      VALUES (${req.userId}, ${req.tier}, ${req.dailyQuota}, ${req.monthlyQuota})
      RETURNING id, user_id as "userId", tier,
                daily_quota as "dailyQuota",
                monthly_quota as "monthlyQuota"
    `;

    return result[0] as any;
  }
);

// Update user quota
export const updateUserQuota = api(
  { method: "PUT", path: "/rate-limiting/quotas/:userId", expose: true },
  async ({ userId, ...updates }: UpdateUserQuotaRequest): Promise<UserQuotaConfig> => {
    if (!userId) {
      throw new ValidationError("User ID is required", "validation");
    }

    // Fetch current quota
    const currentResults = await db.queryAll`
      SELECT * FROM user_quotas WHERE user_id = ${userId}
    `;
    
    if (currentResults.length === 0) {
      throw new ValidationError("User quota not found", "not_found");
    }
    
    const current = currentResults[0] as any;

    // Validate and merge
    const tier = updates.tier !== undefined ? updates.tier : current.tier;
    const dailyQuota = updates.dailyQuota !== undefined ? updates.dailyQuota : current.daily_quota;
    const monthlyQuota = updates.monthlyQuota !== undefined ? updates.monthlyQuota : current.monthly_quota;

    if (updates.dailyQuota !== undefined && updates.dailyQuota <= 0) {
      throw new ValidationError("Daily quota must be positive", "validation");
    }

    if (updates.monthlyQuota !== undefined && updates.monthlyQuota <= 0) {
      throw new ValidationError("Monthly quota must be positive", "validation");
    }
    
    const result = await db.queryAll`
      UPDATE user_quotas 
      SET tier = ${tier},
          daily_quota = ${dailyQuota},
          monthly_quota = ${monthlyQuota},
          updated_at = NOW()
      WHERE user_id = ${userId}
      RETURNING id, user_id as "userId", tier,
                daily_quota as "dailyQuota",
                monthly_quota as "monthlyQuota"
    `;

    if (result.length === 0) {
      throw new ValidationError("User quota not found", "not_found");
    }

    return result[0] as any;
  }
);

// Delete user quota
export const deleteUserQuota = api(
  { method: "DELETE", path: "/rate-limiting/quotas/:userId", expose: true },
  async ({ userId }: { userId: string }): Promise<{ success: boolean }> => {
    const result = await db.queryAll`
      DELETE FROM user_quotas WHERE user_id = ${userId}
    `;

    return { success: true };
  }
);

// Bulk update quotas by tier
export const bulkUpdateQuotasByTier = api(
  { method: "PUT", path: "/rate-limiting/quotas/bulk/:tier", expose: true },
  async ({ 
    tier, 
    dailyQuota, 
    monthlyQuota 
  }: { 
    tier: string; 
    dailyQuota?: number; 
    monthlyQuota?: number; 
  }): Promise<{ updated: number }> => {
    if (!tier) {
      throw new ValidationError("Tier is required", "validation");
    }

    if (dailyQuota !== undefined && dailyQuota <= 0) {
      throw new ValidationError("Daily quota must be positive", "validation");
    }

    if (monthlyQuota !== undefined && monthlyQuota <= 0) {
      throw new ValidationError("Monthly quota must be positive", "validation");
    }

    if (dailyQuota === undefined && monthlyQuota === undefined) {
      throw new ValidationError("No updates provided", "validation");
    }
    
    // Handle different update combinations with static SQL
    let result: any[];
    if (dailyQuota !== undefined && monthlyQuota !== undefined) {
      result = await db.queryAll`
        UPDATE user_quotas 
        SET daily_quota = ${dailyQuota},
            monthly_quota = ${monthlyQuota},
            updated_at = NOW()
        WHERE tier = ${tier}
      `;
    } else if (dailyQuota !== undefined) {
      result = await db.queryAll`
        UPDATE user_quotas 
        SET daily_quota = ${dailyQuota},
            updated_at = NOW()
        WHERE tier = ${tier}
      `;
    } else {
      result = await db.queryAll`
        UPDATE user_quotas 
        SET monthly_quota = ${monthlyQuota},
            updated_at = NOW()
        WHERE tier = ${tier}
      `;
    }

    return { updated: result.length };
  }
);