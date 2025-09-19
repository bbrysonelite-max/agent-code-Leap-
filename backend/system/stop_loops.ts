import { api } from "encore.dev/api";
import { stopCleanup } from "../realtime/websocket";
import { 
  emailRateLimiter, 
  prospectCreationRateLimiter, 
  apiRateLimiter 
} from "../shared/rate-limiting";
import {
  fastCache,
  mediumCache,
  slowCache,
  analyticsCache
} from "../shared/query-cache";

export const stopAllLoops = api(
  { expose: true, method: "POST", path: "/system/stop-loops" },
  async (): Promise<{ message: string }> => {
    // Stop realtime cleanup
    stopCleanup();
    
    // Stop rate limiter cleanups
    emailRateLimiter.destroy();
    prospectCreationRateLimiter.destroy();
    apiRateLimiter.destroy();
    
    // Stop cache cleanups
    fastCache.destroy();
    mediumCache.destroy();
    slowCache.destroy();
    analyticsCache.destroy();
    
    return { message: "All background loops stopped" };
  }
);