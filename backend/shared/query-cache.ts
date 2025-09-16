import { api } from "encore.dev/api";
import { Secret } from "encore.dev/config";

interface CacheConfig {
  ttlSeconds: number;
  maxSize: number;
  keyPrefix: string;
  enableCompression: boolean;
  compressionThreshold: number; // bytes
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
  hitCount: number;
  compressed: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  totalSize: number;
  avgHitCount: number;
  evictions: number;
}

export class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalKeys: 0,
    totalSize: 0,
    avgHitCount: 0,
    evictions: 0
  };
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private config: CacheConfig) {
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        evicted++;
      }
    }
    
    this.stats.evictions += evicted;
    this.stats.totalKeys = this.cache.size;
    this.updateHitRate();
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    let lowestHitCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Prioritize evicting entries with low hit count and old timestamp
      const score = entry.hitCount / ((Date.now() - entry.timestamp) / 1000);
      if (score < lowestHitCount) {
        lowestHitCount = score;
        oldestKey = key;
        oldestTime = entry.timestamp;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      this.stats.totalSize -= entry.size;
      this.stats.evictions++;
      this.stats.totalKeys = this.cache.size;
    }
  }

  private compress(data: any): { data: string; compressed: boolean } {
    const jsonString = JSON.stringify(data);
    if (jsonString.length < this.config.compressionThreshold) {
      return { data: jsonString, compressed: false };
    }

    try {
      // Simple compression simulation (in real implementation, use zlib or similar)
      const compressed = Buffer.from(jsonString).toString('base64');
      return { data: compressed, compressed: true };
    } catch {
      return { data: jsonString, compressed: false };
    }
  }

  private decompress(data: string, compressed: boolean): any {
    if (!compressed) {
      return JSON.parse(data);
    }

    try {
      const decompressed = Buffer.from(data, 'base64').toString();
      return JSON.parse(decompressed);
    } catch {
      return JSON.parse(data);
    }
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    if (this.cache.size > 0) {
      const totalHits = Array.from(this.cache.values())
        .reduce((sum, entry) => sum + entry.hitCount, 0);
      this.stats.avgHitCount = totalHits / this.cache.size;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(fullKey);
      this.stats.totalSize -= entry.size;
      this.stats.totalKeys = this.cache.size;
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    entry.hitCount++;
    this.stats.hits++;
    this.updateHitRate();

    try {
      return this.decompress(entry.data, entry.compressed);
    } catch {
      // If decompression fails, remove the corrupted entry
      this.cache.delete(fullKey);
      this.stats.totalSize -= entry.size;
      this.stats.totalKeys = this.cache.size;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const ttl = ttlSeconds || this.config.ttlSeconds;
    const { data, compressed } = this.compress(value);
    const size = data.length;

    // Check size limits and evict if necessary
    while (this.stats.totalSize + size > this.config.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }

    // If the entry is still too large after eviction, don't cache it
    if (size > this.config.maxSize) {
      return;
    }

    const entry: CacheEntry<string> = {
      data,
      timestamp: Date.now(),
      ttl,
      size,
      hitCount: 0,
      compressed
    };

    // Remove existing entry if it exists
    const existingEntry = this.cache.get(fullKey);
    if (existingEntry) {
      this.stats.totalSize -= existingEntry.size;
    }

    this.cache.set(fullKey, entry);
    this.stats.totalSize += size;
    this.stats.totalKeys = this.cache.size;
  }

  async del(key: string): Promise<void> {
    const fullKey = `${this.config.keyPrefix}:${key}`;
    const entry = this.cache.get(fullKey);
    if (entry) {
      this.cache.delete(fullKey);
      this.stats.totalSize -= entry.size;
      this.stats.totalKeys = this.cache.size;
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.totalSize = 0;
    this.stats.totalKeys = 0;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Cache configurations for different use cases
export const cacheConfigs = {
  fastQueries: {
    ttlSeconds: 300, // 5 minutes
    maxSize: 10 * 1024 * 1024, // 10MB
    keyPrefix: 'fast',
    enableCompression: false,
    compressionThreshold: 1024
  },
  mediumQueries: {
    ttlSeconds: 1800, // 30 minutes
    maxSize: 50 * 1024 * 1024, // 50MB
    keyPrefix: 'medium',
    enableCompression: true,
    compressionThreshold: 512
  },
  slowQueries: {
    ttlSeconds: 3600, // 1 hour
    maxSize: 100 * 1024 * 1024, // 100MB
    keyPrefix: 'slow',
    enableCompression: true,
    compressionThreshold: 256
  },
  analyticsQueries: {
    ttlSeconds: 7200, // 2 hours
    maxSize: 200 * 1024 * 1024, // 200MB
    keyPrefix: 'analytics',
    enableCompression: true,
    compressionThreshold: 512
  }
};

// Global cache instances
export const fastCache = new QueryCache(cacheConfigs.fastQueries);
export const mediumCache = new QueryCache(cacheConfigs.mediumQueries);
export const slowCache = new QueryCache(cacheConfigs.slowQueries);
export const analyticsCache = new QueryCache(cacheConfigs.analyticsQueries);

// Cache decorator for database operations
export function cached<T extends any[], R>(
  cache: QueryCache,
  keyGenerator: (...args: T) => string,
  ttlSeconds?: number
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const cacheKey = keyGenerator(...args);
      
      // Try to get from cache first
      const cachedResult = await cache.get<R>(cacheKey);
      if (cachedResult !== null) {
        return cachedResult;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      await cache.set(cacheKey, result, ttlSeconds);
      
      return result;
    };
  };
}

// Utility function to generate cache keys
export function generateCacheKey(prefix: string, ...parts: (string | number | boolean)[]): string {
  return `${prefix}:${parts.map(p => String(p)).join(':')}`;
}

// Cache warming utility
export async function warmCache<T>(
  cache: QueryCache,
  keys: string[],
  dataFetcher: (key: string) => Promise<T>
): Promise<void> {
  const promises = keys.map(async (key) => {
    try {
      const data = await dataFetcher(key);
      await cache.set(key, data);
    } catch (error) {
      console.error(`Failed to warm cache for key ${key}:`, error);
    }
  });

  await Promise.allSettled(promises);
}