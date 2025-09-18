import { ValidationError } from "./errors";

export interface BackoffStrategy {
  type: 'exponential' | 'linear' | 'fibonacci' | 'decorrelated' | 'adaptive';
  baseDelayMs: number;
  maxDelayMs: number;
  maxRetries: number;
  jitterPercent: number; // 0-100
  backoffMultiplier: number;
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  elapsedTimeMs: number;
  lastError?: Error;
  lastDelayMs?: number;
  endpoint: string;
  method: string;
  userId?: string;
  requestId: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  totalAttempts: number;
  totalTimeMs: number;
  strategy: string;
  finalDelayMs?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeMs: number;
  successThreshold: number;
  monitorWindowMs: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
  windowStartTime: Date;
}

class IntelligentBackoffManager {
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private adaptiveMetrics = new Map<string, AdaptiveMetrics>();
  private retryStatistics = new Map<string, RetryStats>();

  /**
   * Execute operation with intelligent retry and backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    strategy: BackoffStrategy,
    context: Partial<RetryContext>
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const fullContext: RetryContext = {
      attempt: 0,
      totalAttempts: strategy.maxRetries + 1,
      elapsedTimeMs: 0,
      endpoint: context.endpoint || 'unknown',
      method: context.method || 'unknown',
      userId: context.userId,
      requestId: context.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const circuitBreakerKey = `${fullContext.endpoint}:${fullContext.method}`;
    
    // Check circuit breaker before attempting
    if (await this.isCircuitOpen(circuitBreakerKey)) {
      const circuitState = this.circuitBreakers.get(circuitBreakerKey);
      return {
        success: false,
        error: new ValidationError(
          'Circuit breaker is open. Service temporarily unavailable.',
          'circuit_breaker_open',
          { 
            nextRetryTime: circuitState?.nextRetryTime,
            state: circuitState?.state 
          }
        ),
        totalAttempts: 0,
        totalTimeMs: 0,
        strategy: strategy.type
      };
    }

    let lastError: Error | undefined;
    let lastDelayMs = 0;

    // Adaptive strategy adjustment based on historical data
    const adaptiveStrategy = await this.adaptStrategy(strategy, fullContext);

    for (let attempt = 0; attempt < adaptiveStrategy.maxRetries + 1; attempt++) {
      fullContext.attempt = attempt;
      fullContext.elapsedTimeMs = Date.now() - startTime;

      try {
        // Mark circuit breaker as half-open if it was open
        if (attempt === 0) {
          await this.transitionCircuitToHalfOpen(circuitBreakerKey);
        }

        const result = await operation();
        
        // Success - record metrics and close circuit breaker
        await this.recordSuccess(circuitBreakerKey, fullContext);
        await this.updateAdaptiveMetrics(fullContext, true, attempt);
        
        return {
          success: true,
          result,
          totalAttempts: attempt + 1,
          totalTimeMs: Date.now() - startTime,
          strategy: adaptiveStrategy.type
        };

      } catch (error) {
        lastError = error as Error;
        fullContext.lastError = lastError;
        
        // Record failure and update circuit breaker
        await this.recordFailure(circuitBreakerKey, fullContext);
        
        // Check if we should continue retrying
        if (!this.shouldRetry(error as Error, attempt, adaptiveStrategy.maxRetries)) {
          break;
        }

        // Calculate next delay if not the last attempt
        if (attempt < adaptiveStrategy.maxRetries) {
          const delay = this.calculateDelay(adaptiveStrategy, attempt, fullContext);
          lastDelayMs = delay;
          fullContext.lastDelayMs = delay;
          
          // Log retry attempt
          console.warn(`Retry attempt ${attempt + 1}/${adaptiveStrategy.maxRetries + 1} for ${fullContext.endpoint} after ${delay}ms delay`, {
            error: lastError.message,
            requestId: fullContext.requestId
          });

          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    await this.updateAdaptiveMetrics(fullContext, false, fullContext.attempt);
    
    return {
      success: false,
      error: lastError,
      totalAttempts: fullContext.attempt + 1,
      totalTimeMs: Date.now() - startTime,
      strategy: adaptiveStrategy.type,
      finalDelayMs: lastDelayMs
    };
  }

  /**
   * Get recommended strategy for an endpoint based on historical data
   */
  async getRecommendedStrategy(endpoint: string, method: string): Promise<BackoffStrategy> {
    const metrics = this.adaptiveMetrics.get(`${endpoint}:${method}`);
    const stats = this.retryStatistics.get(`${endpoint}:${method}`);

    if (!metrics || !stats || stats.totalAttempts < 10) {
      // Return default strategy for new endpoints
      return this.getDefaultStrategy();
    }

    // Analyze historical performance to recommend optimal strategy
    const avgRetryCount = stats.totalRetries / stats.totalAttempts;
    const successRate = stats.successfulRetries / Math.max(stats.totalRetries, 1);
    const avgResponseTime = metrics.avgResponseTime;

    // Choose strategy based on patterns
    if (avgRetryCount > 3 && successRate < 0.5) {
      // High retry count with low success - use more aggressive backoff
      return {
        type: 'exponential',
        baseDelayMs: 2000,
        maxDelayMs: 30000,
        maxRetries: 5,
        jitterPercent: 25,
        backoffMultiplier: 2.5
      };
    } else if (avgResponseTime > 5000) {
      // Slow service - use longer delays
      return {
        type: 'decorrelated',
        baseDelayMs: 3000,
        maxDelayMs: 45000,
        maxRetries: 4,
        jitterPercent: 30,
        backoffMultiplier: 2.0
      };
    } else if (successRate > 0.8) {
      // Generally reliable - use more aggressive retries
      return {
        type: 'fibonacci',
        baseDelayMs: 500,
        maxDelayMs: 10000,
        maxRetries: 6,
        jitterPercent: 15,
        backoffMultiplier: 1.6
      };
    }

    // Default adaptive strategy
    return {
      type: 'adaptive',
      baseDelayMs: 1000,
      maxDelayMs: 20000,
      maxRetries: 5,
      jitterPercent: 20,
      backoffMultiplier: 2.0
    };
  }

  /**
   * Circuit breaker management
   */
  async updateCircuitBreaker(
    endpoint: string, 
    method: string, 
    config: CircuitBreakerConfig
  ): Promise<void> {
    const key = `${endpoint}:${method}`;
    
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        windowStartTime: new Date()
      });
    }

    // Circuit breaker logic would be enhanced here
    // This is a simplified implementation
  }

  /**
   * Get retry statistics for analysis
   */
  getRetryStatistics(endpoint?: string, method?: string): Map<string, RetryStats> {
    if (endpoint && method) {
      const key = `${endpoint}:${method}`;
      const stats = this.retryStatistics.get(key);
      return stats ? new Map([[key, stats]]) : new Map();
    }
    
    return new Map(this.retryStatistics);
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(endpoint: string, method: string): void {
    const key = `${endpoint}:${method}`;
    const state = this.circuitBreakers.get(key);
    
    if (state) {
      state.state = 'closed';
      state.failureCount = 0;
      state.successCount = 0;
      state.windowStartTime = new Date();
      delete state.lastFailureTime;
      delete state.nextRetryTime;
    }
  }

  // Private helper methods

  private async adaptStrategy(
    baseStrategy: BackoffStrategy, 
    context: RetryContext
  ): Promise<BackoffStrategy> {
    const key = `${context.endpoint}:${context.method}`;
    const metrics = this.adaptiveMetrics.get(key);

    if (!metrics || baseStrategy.type !== 'adaptive') {
      return baseStrategy;
    }

    // Adapt strategy based on recent performance
    const adaptedStrategy = { ...baseStrategy };

    // Adjust base delay based on recent response times
    if (metrics.avgResponseTime > 2000) {
      adaptedStrategy.baseDelayMs = Math.min(adaptedStrategy.baseDelayMs * 1.5, 5000);
    } else if (metrics.avgResponseTime < 500) {
      adaptedStrategy.baseDelayMs = Math.max(adaptedStrategy.baseDelayMs * 0.8, 200);
    }

    // Adjust max retries based on success rate
    if (metrics.recentSuccessRate < 0.3) {
      adaptedStrategy.maxRetries = Math.min(adaptedStrategy.maxRetries + 2, 8);
    } else if (metrics.recentSuccessRate > 0.9) {
      adaptedStrategy.maxRetries = Math.max(adaptedStrategy.maxRetries - 1, 2);
    }

    return adaptedStrategy;
  }

  private calculateDelay(
    strategy: BackoffStrategy, 
    attempt: number, 
    context: RetryContext
  ): number {
    let delay: number;

    switch (strategy.type) {
      case 'exponential':
        delay = strategy.baseDelayMs * Math.pow(strategy.backoffMultiplier, attempt);
        break;
        
      case 'linear':
        delay = strategy.baseDelayMs + (strategy.baseDelayMs * attempt);
        break;
        
      case 'fibonacci':
        delay = strategy.baseDelayMs * this.fibonacci(attempt + 1);
        break;
        
      case 'decorrelated':
        // Decorrelated jitter - prevents thundering herd
        const prevDelay = context.lastDelayMs || strategy.baseDelayMs;
        delay = Math.random() * Math.min(strategy.maxDelayMs, prevDelay * 3);
        break;
        
      case 'adaptive':
        // Adaptive delay based on recent performance
        const baseDelay = strategy.baseDelayMs * Math.pow(strategy.backoffMultiplier, attempt);
        const performanceMultiplier = this.getPerformanceMultiplier(context);
        delay = baseDelay * performanceMultiplier;
        break;
        
      default:
        delay = strategy.baseDelayMs * Math.pow(2, attempt);
    }

    // Apply jitter to prevent thundering herd
    if (strategy.jitterPercent > 0) {
      const jitterRange = delay * (strategy.jitterPercent / 100);
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(delay + jitter, 0);
    }

    // Ensure delay doesn't exceed maximum
    return Math.min(delay, strategy.maxDelayMs);
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  private getPerformanceMultiplier(context: RetryContext): number {
    const key = `${context.endpoint}:${context.method}`;
    const metrics = this.adaptiveMetrics.get(key);
    
    if (!metrics) return 1.0;

    // Increase delay if error rate is high
    let multiplier = 1.0;
    
    if (metrics.recentErrorRate > 0.5) {
      multiplier *= 2.0;
    } else if (metrics.recentErrorRate > 0.2) {
      multiplier *= 1.5;
    }

    // Increase delay if response time is high
    if (metrics.avgResponseTime > 5000) {
      multiplier *= 1.8;
    } else if (metrics.avgResponseTime > 2000) {
      multiplier *= 1.3;
    }

    return Math.min(multiplier, 5.0); // Cap at 5x
  }

  private shouldRetry(error: Error, attempt: number, maxRetries: number): boolean {
    // Don't retry if max attempts reached
    if (attempt >= maxRetries) return false;

    // Don't retry certain types of errors
    if (error instanceof ValidationError) {
      const nonRetryableErrors = [
        'validation',
        'authentication',
        'authorization',
        'not_found',
        'bad_request'
      ];
      
      if (nonRetryableErrors.includes(error.code)) {
        return false;
      }
    }

    // Check if error message indicates non-retryable condition
    const nonRetryablePatterns = [
      /authentication/i,
      /authorization/i,
      /forbidden/i,
      /not found/i,
      /bad request/i,
      /invalid/i
    ];

    return !nonRetryablePatterns.some(pattern => pattern.test(error.message));
  }

  private async isCircuitOpen(key: string): Promise<boolean> {
    const state = this.circuitBreakers.get(key);
    if (!state) return false;

    if (state.state === 'open') {
      // Check if recovery time has passed
      if (state.nextRetryTime && new Date() >= state.nextRetryTime) {
        state.state = 'half-open';
        state.successCount = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  private async transitionCircuitToHalfOpen(key: string): Promise<void> {
    const state = this.circuitBreakers.get(key);
    if (state && state.state === 'open') {
      state.state = 'half-open';
      state.successCount = 0;
    }
  }

  private async recordSuccess(key: string, context: RetryContext): Promise<void> {
    // Update circuit breaker
    let state = this.circuitBreakers.get(key);
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        windowStartTime: new Date()
      };
      this.circuitBreakers.set(key, state);
    }

    state.successCount++;
    
    if (state.state === 'half-open' && state.successCount >= 3) {
      state.state = 'closed';
      state.failureCount = 0;
    }

    // Update retry statistics
    this.updateRetryStats(key, context, true);
  }

  private async recordFailure(key: string, context: RetryContext): Promise<void> {
    // Update circuit breaker
    let state = this.circuitBreakers.get(key);
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        windowStartTime: new Date()
      };
      this.circuitBreakers.set(key, state);
    }

    state.failureCount++;
    state.lastFailureTime = new Date();

    // Check if we should open the circuit
    if (state.failureCount >= 5 && state.state !== 'open') {
      state.state = 'open';
      state.nextRetryTime = new Date(Date.now() + 30000); // 30 seconds
    }

    // Update retry statistics
    this.updateRetryStats(key, context, false);
  }

  private updateRetryStats(key: string, context: RetryContext, success: boolean): void {
    let stats = this.retryStatistics.get(key);
    if (!stats) {
      stats = {
        totalAttempts: 0,
        totalRetries: 0,
        successfulRetries: 0,
        averageRetryCount: 0,
        lastUpdated: new Date()
      };
      this.retryStatistics.set(key, stats);
    }

    stats.totalAttempts++;
    if (context.attempt > 0) {
      stats.totalRetries++;
      if (success) {
        stats.successfulRetries++;
      }
    }

    stats.averageRetryCount = stats.totalRetries / stats.totalAttempts;
    stats.lastUpdated = new Date();
  }

  private async updateAdaptiveMetrics(
    context: RetryContext, 
    success: boolean, 
    attempts: number
  ): Promise<void> {
    const key = `${context.endpoint}:${context.method}`;
    let metrics = this.adaptiveMetrics.get(key);
    
    if (!metrics) {
      metrics = {
        avgResponseTime: 1000,
        recentSuccessRate: 1.0,
        recentErrorRate: 0.0,
        sampleCount: 0,
        lastUpdated: new Date()
      };
      this.adaptiveMetrics.set(key, metrics);
    }

    // Update metrics with exponential moving average
    const alpha = 0.1; // Smoothing factor
    
    metrics.recentSuccessRate = (1 - alpha) * metrics.recentSuccessRate + alpha * (success ? 1 : 0);
    metrics.recentErrorRate = 1 - metrics.recentSuccessRate;
    metrics.sampleCount++;
    metrics.lastUpdated = new Date();

    // Response time would be updated if we had timing information
    // This would typically come from the actual operation execution
  }

  private getDefaultStrategy(): BackoffStrategy {
    return {
      type: 'exponential',
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      maxRetries: 5,
      jitterPercent: 20,
      backoffMultiplier: 2.0
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Supporting interfaces
interface AdaptiveMetrics {
  avgResponseTime: number;
  recentSuccessRate: number;
  recentErrorRate: number;
  sampleCount: number;
  lastUpdated: Date;
}

interface RetryStats {
  totalAttempts: number;
  totalRetries: number;
  successfulRetries: number;
  averageRetryCount: number;
  lastUpdated: Date;
}

// Global instance
export const intelligentBackoffManager = new IntelligentBackoffManager();

// Convenience functions for common retry scenarios

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options?: Partial<BackoffStrategy & RetryContext>
): Promise<T> {
  const strategy: BackoffStrategy = {
    type: 'exponential',
    baseDelayMs: options?.baseDelayMs || 1000,
    maxDelayMs: options?.maxDelayMs || 30000,
    maxRetries: options?.maxRetries || 5,
    jitterPercent: options?.jitterPercent || 20,
    backoffMultiplier: options?.backoffMultiplier || 2.0
  };

  const result = await intelligentBackoffManager.executeWithRetry(
    operation,
    strategy,
    options || {}
  );

  if (!result.success) {
    throw result.error || new Error('Operation failed after all retries');
  }

  return result.result!;
}

export async function retryWithAdaptiveBackoff<T>(
  operation: () => Promise<T>,
  endpoint: string,
  method: string,
  options?: Partial<RetryContext>
): Promise<T> {
  const strategy = await intelligentBackoffManager.getRecommendedStrategy(endpoint, method);
  
  const result = await intelligentBackoffManager.executeWithRetry(
    operation,
    strategy,
    { endpoint, method, ...options }
  );

  if (!result.success) {
    throw result.error || new Error('Operation failed after all retries');
  }

  return result.result!;
}

export function createRetryDecorator(
  strategy?: BackoffStrategy,
  contextExtractor?: (args: any[]) => Partial<RetryContext>
) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const defaultStrategy = strategy || {
        type: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 15000,
        maxRetries: 3,
        jitterPercent: 15,
        backoffMultiplier: 2.0
      };

      const context = contextExtractor ? contextExtractor(args) : {
        endpoint: `${target.constructor.name}.${propertyKey}`,
        method: 'POST'
      };

      const result = await intelligentBackoffManager.executeWithRetry(
        () => originalMethod.apply(this, args),
        defaultStrategy,
        context
      );

      if (!result.success) {
        throw result.error || new Error('Method execution failed after retries');
      }

      return result.result;
    };

    return descriptor;
  };
}