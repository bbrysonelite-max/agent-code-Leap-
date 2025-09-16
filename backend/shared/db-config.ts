import { SQLDatabase } from "encore.dev/storage/sqldb";

export interface DatabaseConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
  statementTimeoutMs: number;
  healthCheckIntervalMs: number;
}

export const defaultDbConfig: DatabaseConfig = {
  maxConnections: 50,
  minConnections: 5,
  connectionTimeoutMs: 30000,
  idleTimeoutMs: 600000, // 10 minutes
  maxLifetimeMs: 3600000, // 1 hour
  statementTimeoutMs: 60000, // 1 minute
  healthCheckIntervalMs: 300000, // 5 minutes
};

export const highVolumeDbConfig: DatabaseConfig = {
  maxConnections: 100,
  minConnections: 10,
  connectionTimeoutMs: 15000,
  idleTimeoutMs: 300000, // 5 minutes
  maxLifetimeMs: 1800000, // 30 minutes
  statementTimeoutMs: 30000, // 30 seconds
  healthCheckIntervalMs: 120000, // 2 minutes
};

export class DatabasePool {
  private static instances = new Map<string, DatabasePool>();
  private activeConnections = 0;
  private connectionQueue: Array<{
    resolve: (connection: any) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    private name: string,
    private database: SQLDatabase,
    private config: DatabaseConfig = defaultDbConfig
  ) {
    this.startHealthCheck();
  }

  static getInstance(
    name: string,
    database: SQLDatabase,
    config?: DatabaseConfig
  ): DatabasePool {
    if (!this.instances.has(name)) {
      this.instances.set(name, new DatabasePool(name, database, config));
    }
    return this.instances.get(name)!;
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.database.rawQueryRow<{ now: Date }>("SELECT NOW() as now");
      } catch (error) {
        console.error(`Database health check failed for ${this.name}:`, error);
      }
    }, this.config.healthCheckIntervalMs);
  }

  async withConnection<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Check connection limits
      if (this.activeConnections >= this.config.maxConnections) {
        await this.waitForConnection();
      }
      
      this.activeConnections++;
      
      const result = await this.executeWithTimeout(operation);
      return result;
    } finally {
      this.activeConnections--;
      this.processQueue();
    }
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Database connection timeout after ${this.config.connectionTimeoutMs}ms`));
      }, this.config.connectionTimeoutMs);

      this.connectionQueue.push({
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      });
    });
  }

  private processQueue(): void {
    if (this.connectionQueue.length > 0 && this.activeConnections < this.config.maxConnections) {
      const next = this.connectionQueue.shift();
      if (next) {
        // Check if request hasn't timed out
        if (Date.now() - next.timestamp < this.config.connectionTimeoutMs) {
          next.resolve(undefined);
        } else {
          next.reject(new Error('Connection request timed out while queued'));
          this.processQueue(); // Try next in queue
        }
      }
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Statement timeout after ${this.config.statementTimeoutMs}ms`));
      }, this.config.statementTimeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  getStats() {
    return {
      name: this.name,
      activeConnections: this.activeConnections,
      queueLength: this.connectionQueue.length,
      maxConnections: this.config.maxConnections,
      minConnections: this.config.minConnections,
      connectionUtilization: (this.activeConnections / this.config.maxConnections) * 100
    };
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    DatabasePool.instances.delete(this.name);
  }
}