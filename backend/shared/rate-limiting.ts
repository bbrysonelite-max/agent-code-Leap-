import { ValidationError } from "./errors";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  checkLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const key = identifier;
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetTime) {
      // New window or expired entry
      this.store.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return { allowed: true };
    }

    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment counter
    entry.count++;
    return { allowed: true };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Global rate limiters for different endpoints
export const emailRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10 // Max 10 emails per minute per agent
});

export const prospectCreationRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50 // Max 50 prospects per minute per agent
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100 // Max 100 API calls per minute per IP
});

export function checkRateLimit(limiter: RateLimiter, identifier: string): void {
  const result = limiter.checkLimit(identifier);
  if (!result.allowed) {
    throw new ValidationError(
      `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
      "rate_limit",
      { retryAfter: result.retryAfter }
    );
  }
}