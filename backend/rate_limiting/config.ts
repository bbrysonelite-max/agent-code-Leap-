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
  { method: "GET", path: "/rate-limiting/rules/:endpoint", expose: true },
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

    return result[0];
  }
);

// Update rate limit rule
export const updateRule = api(
  { method: "PUT", path: "/rate-limiting/rules/:id", expose: true },
  async ({ id, ...updates }: UpdateRateLimitRuleRequest): Promise<RateLimitRule> => {
    if (!id) {
      throw new ValidationError("Rule ID is required", "validation");
    }

    const setParts = [];
    const values: any[] = [];

    if (updates.windowSeconds !== undefined) {
      if (updates.windowSeconds <= 0) {
        throw new ValidationError("Window seconds must be positive", "validation");
      }
      setParts.push(`window_seconds = $${setParts.length + 1}`);
      values.push(updates.windowSeconds);
    }

    if (updates.maxRequests !== undefined) {
      if (updates.maxRequests <= 0) {
        throw new ValidationError("Max requests must be positive", "validation");
      }
      setParts.push(`max_requests = $${setParts.length + 1}`);
      values.push(updates.maxRequests);
    }

    if (updates.burstLimit !== undefined) {
      setParts.push(`burst_limit = $${setParts.length + 1}`);
      values.push(updates.burstLimit);
    }

    if (updates.enabled !== undefined) {
      setParts.push(`enabled = $${setParts.length + 1}`);
      values.push(updates.enabled);
    }

    if (setParts.length === 0) {
      throw new ValidationError("No updates provided", "validation");
    }

    setParts.push(`updated_at = NOW()`);
    values.push(id);

    const setClause = setParts.join(', ');
    
    const result = await db.queryAll`
      UPDATE rate_limit_rules 
      SET ${setClause}
      WHERE id = $${values.length}
      RETURNING id, endpoint, method, tier,
                window_seconds as "windowSeconds",
                max_requests as "maxRequests", 
                burst_limit as "burstLimit",
                enabled
    `;

    if (result.length === 0) {
      throw new ValidationError("Rate limit rule not found", "not_found");
    }

    return result[0];
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

    return result[0];
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

    return result[0];
  }
);

// Update user quota
export const updateUserQuota = api(
  { method: "PUT", path: "/rate-limiting/quotas/:userId", expose: true },
  async ({ userId, ...updates }: UpdateUserQuotaRequest): Promise<UserQuotaConfig> => {
    if (!userId) {
      throw new ValidationError("User ID is required", "validation");
    }

    const setParts = [];
    const values: any[] = [];

    if (updates.tier !== undefined) {
      setParts.push(`tier = $${setParts.length + 1}`);
      values.push(updates.tier);
    }

    if (updates.dailyQuota !== undefined) {
      if (updates.dailyQuota <= 0) {
        throw new ValidationError("Daily quota must be positive", "validation");
      }
      setParts.push(`daily_quota = $${setParts.length + 1}`);
      values.push(updates.dailyQuota);
    }

    if (updates.monthlyQuota !== undefined) {
      if (updates.monthlyQuota <= 0) {
        throw new ValidationError("Monthly quota must be positive", "validation");
      }
      setParts.push(`monthly_quota = $${setParts.length + 1}`);
      values.push(updates.monthlyQuota);
    }

    if (setParts.length === 0) {
      throw new ValidationError("No updates provided", "validation");
    }

    setParts.push(`updated_at = NOW()`);
    values.push(userId);

    const setClause = setParts.join(', ');
    
    const result = await db.queryAll`
      UPDATE user_quotas 
      SET ${setClause}
      WHERE user_id = $${values.length}
      RETURNING id, user_id as "userId", tier,
                daily_quota as "dailyQuota",
                monthly_quota as "monthlyQuota"
    `;

    if (result.length === 0) {
      throw new ValidationError("User quota not found", "not_found");
    }

    return result[0];
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

    const setParts = [];
    const values: any[] = [];

    if (dailyQuota !== undefined) {
      if (dailyQuota <= 0) {
        throw new ValidationError("Daily quota must be positive", "validation");
      }
      setParts.push(`daily_quota = $${setParts.length + 1}`);
      values.push(dailyQuota);
    }

    if (monthlyQuota !== undefined) {
      if (monthlyQuota <= 0) {
        throw new ValidationError("Monthly quota must be positive", "validation");
      }
      setParts.push(`monthly_quota = $${setParts.length + 1}`);
      values.push(monthlyQuota);
    }

    if (setParts.length === 0) {
      throw new ValidationError("No updates provided", "validation");
    }

    setParts.push(`updated_at = NOW()`);
    values.push(tier);

    const setClause = setParts.join(', ');
    
    const result = await db.queryAll`
      UPDATE user_quotas 
      SET ${setClause}
      WHERE tier = $${values.length}
    `;

    return { updated: result.length };
  }
);