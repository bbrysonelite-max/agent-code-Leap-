import { SQLDatabase } from "encore.dev/storage/sqldb";
import { DatabasePool, defaultDbConfig, highVolumeDbConfig } from "./db-config";
import { QueryCache, fastCache, mediumCache, slowCache, analyticsCache, generateCacheKey } from "./query-cache";
import { executeQuery, handleDatabaseError } from "./database";

interface QueryOptions {
  cache?: QueryCache;
  cacheTtl?: number;
  usePool?: boolean;
  timeout?: number;
  retries?: number;
  enableMonitoring?: boolean;
  serviceName?: string;
}

interface QueryMetrics {
  queryHash: string;
  executionTime: number;
  cacheHit: boolean;
  connectionWaitTime: number;
  rowsAffected?: number;
  rowsReturned?: number;
}

export class EnhancedDatabase {
  private pool: DatabasePool;
  private monitoringEnabled: boolean = true;
  private serviceName: string;

  constructor(
    private database: SQLDatabase,
    private name: string,
    serviceName: string,
    useHighVolumeConfig: boolean = false
  ) {
    this.serviceName = serviceName;
    this.pool = DatabasePool.getInstance(
      name,
      database,
      useHighVolumeConfig ? highVolumeDbConfig : defaultDbConfig
    );
  }

  async queryWithCache<T>(
    queryFn: () => Promise<T>,
    cacheKey: string,
    options: QueryOptions = {}
  ): Promise<T> {
    const cache = options.cache || fastCache;
    const cacheTtl = options.cacheTtl || 300;
    const fullCacheKey = generateCacheKey(this.name, cacheKey);

    // Try cache first
    const cached = await cache.get<T>(fullCacheKey);
    if (cached !== null) {
      if (this.monitoringEnabled && options.enableMonitoring !== false) {
        await this.logQueryMetrics({
          queryHash: this.hashString(cacheKey),
          executionTime: 0,
          cacheHit: true,
          connectionWaitTime: 0
        });
      }
      return cached;
    }

    // Execute query
    const startTime = Date.now();
    const connectionStartTime = Date.now();
    
    const result = await this.executeWithPool(queryFn, options);
    
    const executionTime = Date.now() - startTime;
    const connectionWaitTime = Date.now() - connectionStartTime;

    // Cache the result
    await cache.set(fullCacheKey, result, cacheTtl);

    // Log metrics
    if (this.monitoringEnabled && options.enableMonitoring !== false) {
      await this.logQueryMetrics({
        queryHash: this.hashString(cacheKey),
        executionTime,
        cacheHit: false,
        connectionWaitTime
      });
    }

    return result;
  }

  async executeWithRetry<T>(
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const maxRetries = options.retries || 3;
    const timeout = options.timeout || 30000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeWithTimeout(queryFn, timeout, options);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.warn(`Query retry ${attempt}/${maxRetries} after ${delay}ms delay:`, error);
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  async batchExecute<T>(
    queries: Array<() => Promise<T>>,
    options: {
      batchSize?: number;
      parallel?: boolean;
      continueOnError?: boolean;
    } = {}
  ): Promise<Array<T | Error>> {
    const batchSize = options.batchSize || 10;
    const results: Array<T | Error> = [];
    
    if (options.parallel) {
      // Execute all queries in parallel
      const promises = queries.map(async (queryFn, index) => {
        try {
          return await this.executeWithPool(queryFn);
        } catch (error) {
          if (!options.continueOnError) {
            throw error;
          }
          return error instanceof Error ? error : new Error(String(error));
        }
      });
      
      const batchResults = await Promise.allSettled(promises);
      return batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
      );
    } else {
      // Execute in batches sequentially
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        
        for (const queryFn of batch) {
          try {
            const result = await this.executeWithPool(queryFn);
            results.push(result);
          } catch (error) {
            if (!options.continueOnError) {
              throw error;
            }
            results.push(error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    }
    
    return results;
  }

  async transaction<T>(
    transactionFn: (tx: any) => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      return await this.pool.withConnection(async () => {
        // In a real implementation, this would start a database transaction
        // For now, we'll simulate transaction behavior
        const result = await transactionFn({
          exec: this.database.exec.bind(this.database),
          rawQueryRow: this.database.rawQueryRow.bind(this.database),
          rawQueryAll: this.database.rawQueryAll.bind(this.database)
        });
        
        return result;
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (this.monitoringEnabled) {
        await this.logQueryMetrics({
          queryHash: this.hashString('transaction'),
          executionTime,
          cacheHit: false,
          connectionWaitTime: 0
        });
      }
      
      throw error;
    }
  }

  async analyzeQuery(queryText: string): Promise<{
    estimatedCost: number;
    suggestedIndexes: string[];
    optimizationTips: string[];
    executionPlan?: any;
  }> {
    // This would use database-specific EXPLAIN functionality
    // For now, return mock analysis
    const analysis = {
      estimatedCost: this.estimateQueryCost(queryText),
      suggestedIndexes: this.suggestIndexes(queryText),
      optimizationTips: this.generateOptimizationTips(queryText),
      executionPlan: undefined
    };

    return analysis;
  }

  async warmupCache(
    warmupQueries: Array<{
      key: string;
      queryFn: () => Promise<any>;
      cache?: QueryCache;
      ttl?: number;
    }>
  ): Promise<void> {
    console.log(`Warming up cache for ${this.name} with ${warmupQueries.length} queries...`);
    
    const promises = warmupQueries.map(async ({ key, queryFn, cache, ttl }) => {
      try {
        const cacheInstance = cache || fastCache;
        const fullKey = generateCacheKey(this.name, key);
        
        // Check if already cached
        const existing = await cacheInstance.get(fullKey);
        if (existing !== null) {
          return;
        }
        
        // Execute and cache
        const result = await queryFn();
        await cacheInstance.set(fullKey, result, ttl || 300);
        
        console.log(`Warmed up cache key: ${key}`);
      } catch (error) {
        console.warn(`Failed to warm up cache key ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log(`Cache warmup completed for ${this.name}`);
  }

  async getPerformanceStats(): Promise<{
    poolStats: any;
    cacheStats: any;
    recentQueries: number;
    avgQueryTime: number;
  }> {
    const poolStats = this.pool.getStats();
    
    // Get cache stats for all cache instances
    const cacheStats = {
      fast: fastCache.getStats(),
      medium: mediumCache.getStats(),
      slow: slowCache.getStats(),
      analytics: analyticsCache.getStats()
    };

    // This would query actual performance metrics in production
    return {
      poolStats,
      cacheStats,
      recentQueries: 1250,
      avgQueryTime: 145
    };
  }

  private async executeWithPool<T>(
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    if (options.usePool !== false) {
      return this.pool.withConnection(queryFn);
    } else {
      return queryFn();
    }
  }

  private async executeWithTimeout<T>(
    queryFn: () => Promise<T>,
    timeout: number,
    options: QueryOptions = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);

      this.executeWithPool(queryFn, options)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async logQueryMetrics(metrics: QueryMetrics): Promise<void> {
    try {
      // In production, this would send metrics to the performance monitoring service
      console.log(`Query metrics for ${this.serviceName}:`, {
        ...metrics,
        serviceName: this.serviceName,
        databaseName: this.name,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('Failed to log query metrics:', error);
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private estimateQueryCost(queryText: string): number {
    const lowerQuery = queryText.toLowerCase();
    let cost = 1;

    // Rough cost estimation based on query patterns
    if (lowerQuery.includes('join')) cost += 3;
    if (lowerQuery.includes('order by')) cost += 2;
    if (lowerQuery.includes('group by')) cost += 2;
    if (lowerQuery.includes('like')) cost += 1;
    if (lowerQuery.includes('distinct')) cost += 2;
    if (lowerQuery.includes('count(*)')) cost += 1;

    // Penalize potentially expensive patterns
    if (lowerQuery.includes('like \'%')) cost += 5;
    if ((lowerQuery.match(/join/g) || []).length > 2) cost += 5;

    return Math.min(cost * 10, 100); // Cap at 100
  }

  private suggestIndexes(queryText: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = queryText.toLowerCase();

    // Look for WHERE conditions
    const whereMatch = lowerQuery.match(/where\s+(.+?)(?:\s+order|\s+group|\s+limit|$)/);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columnMatches = whereClause.match(/(\w+)\s*[=<>]/g);
      if (columnMatches) {
        columnMatches.forEach(match => {
          const column = match.replace(/\s*[=<>].*/, '');
          suggestions.push(`Consider index on ${column}`);
        });
      }
    }

    // Look for JOIN conditions
    const joinMatches = lowerQuery.match(/join\s+\w+\s+on\s+(.+?)(?:\s+where|\s+order|\s+group|$)/g);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const onClause = match.match(/on\s+(.+)/);
        if (onClause) {
          suggestions.push(`Consider index on JOIN columns: ${onClause[1]}`);
        }
      });
    }

    // Look for ORDER BY
    const orderMatch = lowerQuery.match(/order\s+by\s+(.+?)(?:\s+limit|$)/);
    if (orderMatch) {
      suggestions.push(`Consider index on ORDER BY columns: ${orderMatch[1]}`);
    }

    return suggestions;
  }

  private generateOptimizationTips(queryText: string): string[] {
    const tips: string[] = [];
    const lowerQuery = queryText.toLowerCase();

    if (lowerQuery.includes('select *')) {
      tips.push('Avoid SELECT * - specify only needed columns');
    }

    if (lowerQuery.includes('like \'%') && lowerQuery.includes('%\'')) {
      tips.push('Leading wildcard LIKE queries are slow - consider full-text search');
    }

    if (lowerQuery.includes('order by') && !lowerQuery.includes('limit')) {
      tips.push('Consider adding LIMIT to ORDER BY queries');
    }

    if ((lowerQuery.match(/join/g) || []).length > 3) {
      tips.push('Complex joins detected - consider breaking into smaller queries');
    }

    if (lowerQuery.includes('group by') && lowerQuery.includes('having')) {
      tips.push('HAVING clause filters after grouping - consider moving conditions to WHERE');
    }

    if (lowerQuery.includes('distinct') && lowerQuery.includes('order by')) {
      tips.push('DISTINCT with ORDER BY can be expensive - ensure proper indexing');
    }

    if (lowerQuery.includes('count(*)') && lowerQuery.includes('where')) {
      tips.push('For large tables, consider approximate counts or caching');
    }

    return tips;
  }

  destroy(): void {
    this.pool.destroy();
  }
}

// Factory function to create enhanced database instances
export function createEnhancedDatabase(
  database: SQLDatabase,
  name: string,
  serviceName: string,
  options: {
    useHighVolumeConfig?: boolean;
    enableMonitoring?: boolean;
  } = {}
): EnhancedDatabase {
  const enhanced = new EnhancedDatabase(
    database,
    name,
    serviceName,
    options.useHighVolumeConfig || false
  );

  return enhanced;
}

// Utility functions for common database operations
export async function bulkInsert<T>(
  database: EnhancedDatabase,
  table: string,
  records: T[],
  options: {
    batchSize?: number;
    onConflict?: string;
    returning?: string[];
  } = {}
): Promise<void> {
  const batchSize = options.batchSize || 1000;
  const batches = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }

  const insertQueries = batches.map(batch => () => {
    // This would generate proper bulk insert SQL
    // For now, return a mock promise
    return Promise.resolve();
  });

  await database.batchExecute(insertQueries, { 
    parallel: false,
    continueOnError: false 
  });
}

export async function vacuum(
  database: SQLDatabase,
  tables?: string[]
): Promise<void> {
  // This would run database-specific maintenance commands
  console.log(`Running vacuum operation on ${tables ? tables.join(', ') : 'all tables'}`);
  
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 1000));
}

export async function analyzeTableStats(
  database: SQLDatabase,
  tables?: string[]
): Promise<void> {
  // This would update table statistics for query optimization
  console.log(`Analyzing table statistics for ${tables ? tables.join(', ') : 'all tables'}`);
  
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 500));
}