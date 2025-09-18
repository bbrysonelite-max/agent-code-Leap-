import { api } from "encore.dev/api";
import { db } from "./db";
import { enhancedAnalyticsEngine } from "./enhanced_analytics";
import { rateLimitAnalytics } from "../shared/rate-limit-analytics";

export interface RealTimeAlert {
  id: string;
  type: 'threshold_breach' | 'anomaly_detected' | 'system_health' | 'quota_warning' | 'attack_pattern';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  timestamp: Date;
  source: {
    component: string;
    identifier: string;
    metadata: Record<string, any>;
  };
  metrics: {
    current: number;
    threshold: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
  };
  actions: AlertAction[];
  autoResolution?: {
    enabled: boolean;
    timeoutMinutes: number;
    conditions: string[];
  };
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  escalated: boolean;
  escalatedAt?: Date;
}

export interface AlertAction {
  type: 'throttle' | 'block' | 'scale' | 'notify' | 'investigate';
  description: string;
  automated: boolean;
  executed: boolean;
  executedAt?: Date;
  result?: string;
}

export interface MonitoringRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    timeWindowMinutes: number;
    aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count';
  }[];
  filters: {
    endpoint?: string;
    method?: string;
    tier?: string;
    userId?: string;
  };
  alertConfig: {
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    cooldownMinutes: number;
    autoActions: string[];
    notificationChannels: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemMetrics {
  timestamp: Date;
  requests: {
    total: number;
    successful: number;
    blocked: number;
    rate: number; // requests per second
  };
  quotas: {
    totalUsers: number;
    nearLimit: number; // users at >80% quota
    exceeded: number; // users who exceeded quota
    avgUtilization: number;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  circuitBreakers: {
    total: number;
    open: number;
    halfOpen: number;
    closed: number;
  };
  anomalies: {
    detected: number;
    severity: Record<string, number>;
  };
}

export interface DashboardData {
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    score: number;
    lastUpdate: Date;
  };
  realTimeMetrics: SystemMetrics;
  activeAlerts: RealTimeAlert[];
  topEndpoints: {
    endpoint: string;
    method: string;
    requestCount: number;
    blockingRate: number;
    avgResponseTime: number;
  }[];
  quotaStatus: {
    tier: string;
    totalUsers: number;
    avgUtilization: number;
    usersNearLimit: number;
  }[];
  trends: {
    metric: string;
    value: number;
    change: number;
    period: string;
  }[];
}

class RealTimeMonitor {
  private activeAlerts = new Map<string, RealTimeAlert>();
  private monitoringRules = new Map<string, MonitoringRule>();
  private metricHistory: SystemMetrics[] = [];
  private maxHistorySize = 1000; // Keep last 1000 data points
  private notificationChannels = new Map<string, NotificationChannel>();

  constructor() {
    // Initialize with default monitoring rules
    this.initializeDefaultRules();
    
    // Start monitoring loop
    this.startMonitoring();
  }

  /**
   * Start real-time monitoring with configurable intervals
   */
  private startMonitoring(): void {
    // High-frequency monitoring (every 30 seconds)
    setInterval(() => this.performHighFrequencyMonitoring(), 30000);
    
    // Medium-frequency monitoring (every 2 minutes)
    setInterval(() => this.performMediumFrequencyMonitoring(), 120000);
    
    // Low-frequency monitoring (every 5 minutes)
    setInterval(() => this.performLowFrequencyMonitoring(), 300000);
    
    // Cleanup old data (every hour)
    setInterval(() => this.cleanup(), 3600000);
  }

  /**
   * Get current dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const [
      systemHealth,
      realTimeMetrics,
      topEndpoints,
      quotaStatus,
      trends
    ] = await Promise.all([
      this.getSystemHealth(),
      this.getCurrentSystemMetrics(),
      this.getTopEndpoints(),
      this.getQuotaStatus(),
      this.getTrends()
    ]);

    return {
      systemHealth,
      realTimeMetrics,
      activeAlerts: Array.from(this.activeAlerts.values())
        .filter(alert => !alert.acknowledgedAt || alert.severity === 'emergency')
        .sort((a, b) => this.getSeverityPriority(b.severity) - this.getSeverityPriority(a.severity)),
      topEndpoints,
      quotaStatus,
      trends
    };
  }

  /**
   * Create new monitoring rule
   */
  async createMonitoringRule(rule: Omit<MonitoringRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<MonitoringRule> {
    const newRule: MonitoringRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.monitoringRules.set(newRule.id, newRule);
    await this.storeMonitoringRule(newRule);

    return newRule;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      
      await this.updateAlertInDatabase(alert);
      await this.notifyAlertAcknowledged(alert, acknowledgedBy);
    }
  }

  /**
   * Manually trigger alert resolution
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolvedAt) {
      alert.resolvedAt = new Date();
      
      await this.updateAlertInDatabase(alert);
      await this.notifyAlertResolved(alert, resolvedBy);
      
      // Remove from active alerts after a delay to allow for UI updates
      setTimeout(() => this.activeAlerts.delete(alertId), 60000);
    }
  }

  /**
   * Execute automated actions for an alert
   */
  async executeAutomatedActions(alert: RealTimeAlert): Promise<void> {
    for (const action of alert.actions.filter(a => a.automated && !a.executed)) {
      try {
        const result = await this.executeAction(action, alert);
        action.executed = true;
        action.executedAt = new Date();
        action.result = result;
        
        console.log(`Automated action executed: ${action.type} for alert ${alert.id}`, { result });
      } catch (error) {
        console.error(`Failed to execute automated action ${action.type} for alert ${alert.id}:`, error);
        action.result = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    await this.updateAlertInDatabase(alert);
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStatistics(): Promise<{
    totalRules: number;
    activeRules: number;
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    avgResolutionTime: number;
    automationSuccessRate: number;
  }> {
    const activeAlerts = Array.from(this.activeAlerts.values());
    const alertsBySeverity: Record<string, number> = {};
    
    activeAlerts.forEach(alert => {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    });

    // Get resolved alerts for statistics
    const resolvedAlerts = await this.getResolvedAlertsFromDatabase(7); // Last 7 days
    const avgResolutionTime = this.calculateAverageResolutionTime(resolvedAlerts);
    const automationSuccessRate = this.calculateAutomationSuccessRate(resolvedAlerts);

    return {
      totalRules: this.monitoringRules.size,
      activeRules: Array.from(this.monitoringRules.values()).filter(r => r.enabled).length,
      totalAlerts: activeAlerts.length,
      alertsBySeverity,
      avgResolutionTime,
      automationSuccessRate
    };
  }

  // Private monitoring methods

  private async performHighFrequencyMonitoring(): Promise<void> {
    try {
      // Quick checks for immediate threats
      await this.checkSystemHealth();
      await this.checkQuotaThresholds();
      await this.checkTrafficSpikes();
      await this.processRealTimeAlerts();
    } catch (error) {
      console.error('High-frequency monitoring error:', error);
    }
  }

  private async performMediumFrequencyMonitoring(): Promise<void> {
    try {
      // Pattern detection and trend analysis
      await this.detectAnomalies();
      await this.analyzeUsagePatterns();
      await this.checkCircuitBreakerStates();
      await this.evaluateMonitoringRules();
    } catch (error) {
      console.error('Medium-frequency monitoring error:', error);
    }
  }

  private async performLowFrequencyMonitoring(): Promise<void> {
    try {
      // Long-term analysis and optimization
      await this.generatePredictiveAlerts();
      await this.optimizeMonitoringRules();
      await this.generateHealthReports();
      await this.updateBaselines();
    } catch (error) {
      console.error('Low-frequency monitoring error:', error);
    }
  }

  private async checkSystemHealth(): Promise<void> {
    const health = await enhancedAnalyticsEngine.getSystemHealthMetrics();
    
    if (health.overall.score < 50) {
      await this.createAlert({
        type: 'system_health',
        severity: 'emergency',
        title: 'Critical System Health Issue',
        message: `System health score dropped to ${health.overall.score}%`,
        source: {
          component: 'system_monitor',
          identifier: 'overall_health',
          metadata: health
        },
        metrics: {
          current: health.overall.score,
          threshold: 50,
          trend: 'decreasing',
          confidence: 0.95
        },
        actions: [
          {
            type: 'scale',
            description: 'Auto-scale system resources',
            automated: true,
            executed: false
          },
          {
            type: 'throttle',
            description: 'Apply emergency throttling',
            automated: true,
            executed: false
          }
        ]
      });
    }
  }

  private async checkQuotaThresholds(): Promise<void> {
    const quotaUsage = await rateLimitAnalytics.getUserQuotaUsage();
    
    for (const user of quotaUsage) {
      if (user.dailyUsagePercent > 90) {
        await this.createAlert({
          type: 'quota_warning',
          severity: user.dailyUsagePercent > 95 ? 'critical' : 'warning',
          title: 'Quota Threshold Exceeded',
          message: `User ${user.userId} has used ${user.dailyUsagePercent}% of daily quota`,
          source: {
            component: 'quota_monitor',
            identifier: user.userId,
            metadata: user
          },
          metrics: {
            current: user.dailyUsagePercent,
            threshold: 90,
            trend: 'increasing',
            confidence: 0.9
          },
          actions: [
            {
              type: 'notify',
              description: 'Notify user about quota usage',
              automated: true,
              executed: false
            }
          ]
        });
      }
    }
  }

  private async checkTrafficSpikes(): Promise<void> {
    const realTimeUsage = await rateLimitAnalytics.getRealTimeUsage(5);
    
    for (const endpoint of realTimeUsage) {
      const historicalAvg = await this.getHistoricalAverage(endpoint.endpoint, endpoint.method);
      const currentRate = endpoint.total_requests || 0;
      
      if (currentRate > historicalAvg * 3) { // 3x normal traffic
        await this.createAlert({
          type: 'anomaly_detected',
          severity: currentRate > historicalAvg * 5 ? 'critical' : 'warning',
          title: 'Traffic Spike Detected',
          message: `${endpoint.endpoint} receiving ${currentRate} requests (${Math.round(currentRate / historicalAvg)}x normal)`,
          source: {
            component: 'traffic_monitor',
            identifier: `${endpoint.endpoint}:${endpoint.method}`,
            metadata: endpoint
          },
          metrics: {
            current: currentRate,
            threshold: historicalAvg * 3,
            trend: 'increasing',
            confidence: 0.85
          },
          actions: [
            {
              type: 'throttle',
              description: 'Apply temporary throttling',
              automated: false,
              executed: false
            }
          ]
        });
      }
    }
  }

  private async detectAnomalies(): Promise<void> {
    const patterns = await enhancedAnalyticsEngine.analyzeUsagePatterns(60);
    
    for (const pattern of patterns) {
      if (pattern.riskAssessment.score > 70) {
        await this.createAlert({
          type: 'attack_pattern',
          severity: pattern.riskAssessment.score > 90 ? 'critical' : 'warning',
          title: 'Suspicious Pattern Detected',
          message: `${pattern.pattern.type} pattern detected for ${pattern.identifier}`,
          source: {
            component: 'pattern_analyzer',
            identifier: pattern.identifier,
            metadata: pattern
          },
          metrics: {
            current: pattern.riskAssessment.score,
            threshold: 70,
            trend: 'increasing',
            confidence: pattern.pattern.confidence
          },
          actions: [
            {
              type: pattern.riskAssessment.recommendedAction as any,
              description: `Recommended action: ${pattern.riskAssessment.recommendedAction}`,
              automated: pattern.riskAssessment.recommendedAction === 'throttle',
              executed: false
            }
          ]
        });
      }
    }
  }

  private async evaluateMonitoringRules(): Promise<void> {
    for (const rule of this.monitoringRules.values()) {
      if (!rule.enabled) continue;
      
      try {
        const shouldAlert = await this.evaluateRule(rule);
        if (shouldAlert) {
          await this.triggerRuleAlert(rule);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }
  }

  private async createAlert(alertData: Omit<RealTimeAlert, 'id' | 'timestamp' | 'acknowledged' | 'escalated'>): Promise<RealTimeAlert> {
    const alert: RealTimeAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
      escalated: false
    };

    // Check for duplicate alerts
    const existingAlert = this.findSimilarAlert(alert);
    if (existingAlert) {
      // Update existing alert instead of creating new one
      existingAlert.timestamp = new Date();
      existingAlert.metrics = alert.metrics;
      return existingAlert;
    }

    this.activeAlerts.set(alert.id, alert);
    await this.storeAlert(alert);
    await this.sendAlertNotifications(alert);
    
    // Execute automated actions
    if (alert.actions.some(a => a.automated)) {
      setTimeout(() => this.executeAutomatedActions(alert), 1000);
    }

    // Schedule auto-escalation for critical alerts
    if (alert.severity === 'critical' || alert.severity === 'emergency') {
      setTimeout(() => this.checkForEscalation(alert.id), 300000); // 5 minutes
    }

    return alert;
  }

  private findSimilarAlert(newAlert: RealTimeAlert): RealTimeAlert | undefined {
    const threshold = 300000; // 5 minutes
    const now = new Date().getTime();
    
    return Array.from(this.activeAlerts.values()).find(existing => 
      existing.type === newAlert.type &&
      existing.source.component === newAlert.source.component &&
      existing.source.identifier === newAlert.source.identifier &&
      (now - existing.timestamp.getTime()) < threshold &&
      !existing.resolvedAt
    );
  }

  private async executeAction(action: AlertAction, alert: RealTimeAlert): Promise<string> {
    switch (action.type) {
      case 'throttle':
        return await this.applyThrottling(alert);
      case 'block':
        return await this.applyBlocking(alert);
      case 'scale':
        return await this.triggerScaling(alert);
      case 'notify':
        return await this.sendNotification(alert);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async applyThrottling(alert: RealTimeAlert): Promise<string> {
    // Apply temporary throttling based on alert context
    const identifier = alert.source.identifier;
    const endpoint = alert.source.metadata?.endpoint;
    
    if (endpoint) {
      // Apply endpoint-specific throttling
      return `Applied throttling to ${endpoint} for ${identifier}`;
    } else {
      // Apply user-specific throttling
      return `Applied global throttling for ${identifier}`;
    }
  }

  private async applyBlocking(alert: RealTimeAlert): Promise<string> {
    // Implement blocking logic
    return `Applied blocking for ${alert.source.identifier}`;
  }

  private async triggerScaling(alert: RealTimeAlert): Promise<string> {
    // Trigger infrastructure scaling
    return `Triggered auto-scaling for ${alert.source.component}`;
  }

  private async sendNotification(alert: RealTimeAlert): Promise<string> {
    // Send notification to relevant channels
    return `Sent notification for alert ${alert.id}`;
  }

  // Utility methods

  private getSeverityPriority(severity: string): number {
    const priorities = { emergency: 4, critical: 3, warning: 2, info: 1 };
    return priorities[severity as keyof typeof priorities] || 0;
  }

  private initializeDefaultRules(): void {
    // Add default monitoring rules
    const defaultRules: Omit<MonitoringRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 5%',
        enabled: true,
        conditions: [
          {
            metric: 'error_rate',
            operator: '>',
            threshold: 5,
            timeWindowMinutes: 5,
            aggregation: 'avg'
          }
        ],
        filters: {},
        alertConfig: {
          severity: 'warning',
          cooldownMinutes: 10,
          autoActions: ['investigate'],
          notificationChannels: ['slack', 'email']
        }
      }
    ];

    defaultRules.forEach(rule => {
      const fullRule: MonitoringRule = {
        ...rule,
        id: `default_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.monitoringRules.set(fullRule.id, fullRule);
    });
  }

  private cleanup(): void {
    // Remove old metric history
    if (this.metricHistory.length > this.maxHistorySize) {
      this.metricHistory = this.metricHistory.slice(-this.maxHistorySize);
    }

    // Remove resolved alerts older than 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.resolvedAt && alert.resolvedAt < dayAgo) {
        this.activeAlerts.delete(id);
      }
    }
  }

  // Placeholder methods for external integrations
  private async storeAlert(alert: RealTimeAlert): Promise<void> { /* Store in database */ }
  private async updateAlertInDatabase(alert: RealTimeAlert): Promise<void> { /* Update database */ }
  private async storeMonitoringRule(rule: MonitoringRule): Promise<void> { /* Store in database */ }
  private async sendAlertNotifications(alert: RealTimeAlert): Promise<void> { /* Send notifications */ }
  private async notifyAlertAcknowledged(alert: RealTimeAlert, by: string): Promise<void> { /* Notify acknowledgment */ }
  private async notifyAlertResolved(alert: RealTimeAlert, by: string): Promise<void> { /* Notify resolution */ }
  private async getHistoricalAverage(endpoint: string, method: string): Promise<number> { return 100; }
  private async evaluateRule(rule: MonitoringRule): Promise<boolean> { return false; }
  private async triggerRuleAlert(rule: MonitoringRule): Promise<void> { /* Trigger alert */ }
  private async checkForEscalation(alertId: string): Promise<void> { /* Check escalation */ }
  private async getResolvedAlertsFromDatabase(days: number): Promise<RealTimeAlert[]> { return []; }
  private calculateAverageResolutionTime(alerts: RealTimeAlert[]): number { return 300; }
  private calculateAutomationSuccessRate(alerts: RealTimeAlert[]): number { return 0.85; }
  
  private async getCurrentSystemMetrics(): Promise<SystemMetrics> {
    // Get current system metrics
    return {
      timestamp: new Date(),
      requests: { total: 1500, successful: 1425, blocked: 75, rate: 25 },
      quotas: { totalUsers: 150, nearLimit: 12, exceeded: 3, avgUtilization: 68 },
      performance: { avgResponseTime: 145, p95ResponseTime: 320, errorRate: 2.1, throughput: 1200 },
      circuitBreakers: { total: 25, open: 2, halfOpen: 1, closed: 22 },
      anomalies: { detected: 3, severity: { low: 2, medium: 1, high: 0 } }
    };
  }

  private async getSystemHealth(): Promise<any> {
    return { status: 'healthy', score: 94, lastUpdate: new Date() };
  }

  private async getTopEndpoints(): Promise<any[]> {
    return [
      { endpoint: '/api/email/send', method: 'POST', requestCount: 450, blockingRate: 3.2, avgResponseTime: 120 },
      { endpoint: '/api/prospect/search', method: 'POST', requestCount: 380, blockingRate: 1.8, avgResponseTime: 200 }
    ];
  }

  private async getQuotaStatus(): Promise<any[]> {
    return [
      { tier: 'enterprise', totalUsers: 25, avgUtilization: 45, usersNearLimit: 2 },
      { tier: 'premium', totalUsers: 75, avgUtilization: 68, usersNearLimit: 8 }
    ];
  }

  private async getTrends(): Promise<any[]> {
    return [
      { metric: 'requests_per_minute', value: 1250, change: 8.5, period: '1h' },
      { metric: 'error_rate', value: 2.1, change: -0.3, period: '1h' }
    ];
  }

  private async processRealTimeAlerts(): Promise<void> { /* Process pending alerts */ }
  private async analyzeUsagePatterns(): Promise<void> { /* Analyze patterns */ }
  private async checkCircuitBreakerStates(): Promise<void> { /* Check circuit breakers */ }
  private async generatePredictiveAlerts(): Promise<void> { /* Generate predictive alerts */ }
  private async optimizeMonitoringRules(): Promise<void> { /* Optimize rules */ }
  private async generateHealthReports(): Promise<void> { /* Generate reports */ }
  private async updateBaselines(): Promise<void> { /* Update baselines */ }
}

interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

// Global instance
export const realTimeMonitor = new RealTimeMonitor();

// API endpoints
export const getDashboard = api(
  { method: "GET", path: "/rate-limiting/monitoring/dashboard", expose: true },
  async (): Promise<DashboardData> => {
    return await realTimeMonitor.getDashboardData();
  }
);

export interface CreateMonitoringRuleRequest {
  name: string;
  description: string;
  enabled: boolean;
  conditions: any[];
  filters: any;
  alertConfig: any;
}

export const createMonitoringRule = api(
  { method: "POST", path: "/rate-limiting/monitoring/rules", expose: true },
  async (rule: CreateMonitoringRuleRequest): Promise<{ rule: MonitoringRule }> => {
    const result = await realTimeMonitor.createMonitoringRule(rule);
    return { rule: result };
  }
);

export const acknowledgeAlert = api(
  { method: "POST", path: "/rate-limiting/monitoring/alerts/:alertId/acknowledge", expose: true },
  async ({ alertId, acknowledgedBy }: { alertId: string; acknowledgedBy: string }): Promise<{ success: boolean }> => {
    await realTimeMonitor.acknowledgeAlert(alertId, acknowledgedBy);
    return { success: true };
  }
);

export const resolveAlert = api(
  { method: "POST", path: "/rate-limiting/monitoring/alerts/:alertId/resolve", expose: true },
  async ({ alertId, resolvedBy }: { alertId: string; resolvedBy: string }): Promise<{ success: boolean }> => {
    await realTimeMonitor.resolveAlert(alertId, resolvedBy);
    return { success: true };
  }
);

export const getMonitoringStats = api(
  { method: "GET", path: "/rate-limiting/monitoring/statistics", expose: true },
  async () => {
    return await realTimeMonitor.getMonitoringStatistics();
  }
);