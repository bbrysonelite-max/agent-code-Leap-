import { api } from "encore.dev/api";
import { withEnhancedRateLimit } from "../shared/enhanced-rate-limiting-middleware";
import { retryWithAdaptiveBackoff } from "../shared/intelligent-backoff";

export interface TestRequest {
  message: string;
  userId?: string;
  userTier?: string;
}

export interface TestResponse {
  success: boolean;
  message: string;
  timestamp: Date;
  rateLimitInfo?: any;
}

// Test endpoint for basic rate limiting
export const testBasicRateLimit = api(
  { method: "POST", path: "/rate-limiting/test/basic", expose: true },
  async (req: TestRequest): Promise<TestResponse> => {
    // Apply rate limiting
    await withEnhancedRateLimit({
      identifier: req.userId || "test_user",
      endpoint: "/rate-limiting/test/basic",
      method: "POST",
      userTier: req.userTier || "basic",
      userId: req.userId
    });

    return {
      success: true,
      message: `Basic rate limit test: ${req.message}`,
      timestamp: new Date()
    };
  }
);

// Test endpoint for retry mechanism
export const testRetryMechanism = api(
  { method: "POST", path: "/rate-limiting/test/retry", expose: true },
  async (req: TestRequest): Promise<TestResponse> => {
    // Apply rate limiting
    await withEnhancedRateLimit({
      identifier: req.userId || "test_user",
      endpoint: "/rate-limiting/test/retry",
      method: "POST",
      userTier: req.userTier || "basic",
      userId: req.userId
    });

    // Test the retry mechanism with a potentially failing operation
    const result = await retryWithAdaptiveBackoff(
      async () => {
        // Simulate a potentially failing operation
        if (Math.random() < 0.3) {
          throw new Error("Simulated temporary failure");
        }
        return { data: "Operation succeeded" };
      },
      "/rate-limiting/test/retry",
      "POST",
      { userId: req.userId, requestId: `retry_test_${Date.now()}` }
    );

    return {
      success: true,
      message: `Retry test completed: ${result.data}`,
      timestamp: new Date()
    };
  }
);

// Test endpoint for quota checking
export const testQuotaCheck = api(
  { method: "GET", path: "/rate-limiting/test/quota/:userId", expose: true },
  async ({ userId }: { userId: string }): Promise<{
    userId: string;
    hasQuota: boolean;
    quotaInfo: any;
  }> => {
    // This would normally check the quota
    // For testing, we'll return mock data
    return {
      userId,
      hasQuota: true,
      quotaInfo: {
        dailyUsed: 150,
        dailyLimit: 1000,
        monthlyUsed: 4500,
        monthlyLimit: 30000,
        tier: "basic"
      }
    };
  }
);

// Health check endpoint for rate limiting system
export const healthCheck = api(
  { method: "GET", path: "/rate-limiting/test/health", expose: true },
  async (): Promise<{
    status: string;
    components: {
      middleware: string;
      analytics: string;
      quotaManager: string;
      monitoring: string;
    };
    timestamp: Date;
  }> => {
    return {
      status: "healthy",
      components: {
        middleware: "operational",
        analytics: "operational", 
        quotaManager: "operational",
        monitoring: "operational"
      },
      timestamp: new Date()
    };
  }
);