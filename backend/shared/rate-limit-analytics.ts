import { db } from "../rate_limiting/db";

export interface RateLimitMetrics {
  date: string;
  endpoint: string;
  method: string;
  tier: string;
  totalRequests: number;
  blockedRequests: number;
  uniqueUsers: number;
  avgRequestsPerUser: number;
  peakRequestsPerMinute: number;
  blockingRate: number;
}

export interface UsageAlert {
  id: number;
  name: string;
  endpoint?: string;
  method?: string;
  tier?: string;
  thresholdType: string;
  thresholdValue: number;
  timeWindowMinutes: number;
  enabled: boolean;
  webhookUrl?: string;
  emailRecipients?: string[];
}

export interface AlertTrigger {
  alertId: number;
  alertName: string;
  currentValue: number;
  thresholdValue: number;
  endpoint?: string;
  method?: string;
  tier?: string;
  triggeredAt: Date;
  severity: 'warning' | 'critical';
}

export class RateLimitAnalytics {
  
  // Generate daily analytics
  async generateDailyAnalytics(date?: string): Promise<RateLimitMetrics[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const result = await db.queryAll`
      WITH daily_stats AS (
        SELECT 
          rul.endpoint,
          rul.method,
          COALESCE(rlr.tier, 'unknown') as tier,
          COUNT(*) as total_requests,
          SUM(rul.blocked_count) as blocked_requests,
          COUNT(DISTINCT rul.identifier) as unique_users,
          AVG(rul.request_count) as avg_requests_per_user,
          MAX(rul.request_count) as peak_requests_per_minute
        FROM rate_limit_usage rul
        LEFT JOIN rate_limit_rules rlr ON rul.endpoint = rlr.endpoint AND rul.method = rlr.method
        WHERE DATE(rul.created_at) = ${targetDate}
        GROUP BY rul.endpoint, rul.method, rlr.tier
      )
      SELECT 
        ${targetDate} as date,
        endpoint,
        method,
        tier,
        total_requests as "totalRequests",
        blocked_requests as "blockedRequests", 
        unique_users as "uniqueUsers",
        ROUND(avg_requests_per_user::numeric, 2) as "avgRequestsPerUser",
        peak_requests_per_minute as "peakRequestsPerMinute",
        CASE 
          WHEN total_requests > 0 
          THEN ROUND((blocked_requests::numeric / total_requests::numeric) * 100, 2)
          ELSE 0 
        END as "blockingRate"
      FROM daily_stats
      ORDER BY total_requests DESC
    `;

    // Store analytics in database
    for (const metric of result) {
      await db.queryAll`
        INSERT INTO rate_limit_analytics (
          date, endpoint, method, tier, total_requests, blocked_requests,
          unique_users, avg_requests_per_user, peak_requests_per_minute
        ) VALUES (
          ${metric.date}, ${metric.endpoint}, ${metric.method}, ${metric.tier},
          ${metric.totalRequests}, ${metric.blockedRequests}, ${metric.uniqueUsers},
          ${metric.avgRequestsPerUser}, ${metric.peakRequestsPerMinute}
        )
        ON CONFLICT (date, endpoint, method, tier)
        DO UPDATE SET
          total_requests = EXCLUDED.total_requests,
          blocked_requests = EXCLUDED.blocked_requests,
          unique_users = EXCLUDED.unique_users,
          avg_requests_per_user = EXCLUDED.avg_requests_per_user,
          peak_requests_per_minute = EXCLUDED.peak_requests_per_minute
      `;
    }

    return result;
  }

  // Get analytics for a date range
  async getAnalytics(
    startDate: string,
    endDate: string,
    endpoint?: string,
    tier?: string
  ): Promise<RateLimitMetrics[]> {
    let whereClause = `WHERE date BETWEEN ${startDate} AND ${endDate}`;
    
    if (endpoint) {
      whereClause += ` AND endpoint = ${endpoint}`;
    }
    
    if (tier) {
      whereClause += ` AND tier = ${tier}`;
    }

    const result = await db.queryAll`
      SELECT 
        date, endpoint, method, tier,
        total_requests as "totalRequests",
        blocked_requests as "blockedRequests",
        unique_users as "uniqueUsers", 
        avg_requests_per_user as "avgRequestsPerUser",
        peak_requests_per_minute as "peakRequestsPerMinute",
        CASE 
          WHEN total_requests > 0 
          THEN ROUND((blocked_requests::numeric / total_requests::numeric) * 100, 2)
          ELSE 0 
        END as "blockingRate"
      FROM rate_limit_analytics
      ${whereClause}
      ORDER BY date DESC, total_requests DESC
    `;

    return result;
  }

  // Get real-time usage statistics
  async getRealTimeUsage(timeWindowMinutes: number = 5): Promise<any[]> {
    const windowStart = new Date(Date.now() - (timeWindowMinutes * 60 * 1000));

    const result = await db.queryAll`
      SELECT 
        endpoint,
        method,
        COUNT(*) as active_windows,
        SUM(request_count) as total_requests,
        SUM(blocked_count) as total_blocked,
        COUNT(DISTINCT identifier) as unique_users,
        AVG(request_count) as avg_requests_per_window,
        MAX(request_count) as max_requests_per_window
      FROM rate_limit_usage
      WHERE window_start >= ${windowStart}
      GROUP BY endpoint, method
      ORDER BY total_requests DESC
    `;

    return result;
  }

  // Get user quota usage summary
  async getUserQuotaUsage(userId?: string): Promise<any[]> {
    let whereClause = '';
    if (userId) {
      whereClause = `WHERE user_id = ${userId}`;
    }

    const result = await db.queryAll`
      SELECT 
        user_id as "userId",
        tier,
        daily_quota as "dailyQuota",
        current_daily_usage as "currentDailyUsage",
        monthly_quota as "monthlyQuota", 
        current_monthly_usage as "currentMonthlyUsage",
        ROUND((current_daily_usage::numeric / daily_quota::numeric) * 100, 2) as "dailyUsagePercent",
        ROUND((current_monthly_usage::numeric / monthly_quota::numeric) * 100, 2) as "monthlyUsagePercent",
        quota_reset_date as "quotaResetDate",
        monthly_reset_date as "monthlyResetDate"
      FROM user_quotas
      ${whereClause}
      ORDER BY daily_usage_percent DESC
    `;

    return result;
  }

  // Check for alert conditions
  async checkAlertConditions(): Promise<AlertTrigger[]> {
    const alerts = await this.getActiveAlerts();
    const triggers: AlertTrigger[] = [];

    for (const alert of alerts) {
      try {
        const currentValue = await this.calculateAlertValue(alert);
        
        if (currentValue >= alert.thresholdValue) {
          const severity = currentValue >= (alert.thresholdValue * 1.2) ? 'critical' : 'warning';
          
          triggers.push({
            alertId: alert.id,
            alertName: alert.name,
            currentValue,
            thresholdValue: alert.thresholdValue,
            endpoint: alert.endpoint,
            method: alert.method,
            tier: alert.tier,
            triggeredAt: new Date(),
            severity
          });
        }
      } catch (error) {
        console.error(`Error checking alert ${alert.name}:`, error);
      }
    }

    return triggers;
  }

  private async getActiveAlerts(): Promise<UsageAlert[]> {
    const result = await db.queryAll`
      SELECT 
        id, name, endpoint, method, tier, threshold_type as "thresholdType",
        threshold_value as "thresholdValue", time_window_minutes as "timeWindowMinutes",
        enabled, webhook_url as "webhookUrl", email_recipients as "emailRecipients"
      FROM rate_limit_alerts
      WHERE enabled = true
      ORDER BY threshold_value DESC
    `;

    return result;
  }

  private async calculateAlertValue(alert: UsageAlert): Promise<number> {
    const windowStart = new Date(Date.now() - (alert.timeWindowMinutes * 60 * 1000));

    switch (alert.thresholdType) {
      case 'usage_percentage':
        return await this.calculateUsagePercentage(alert, windowStart);
      
      case 'blocked_requests':
        return await this.calculateBlockedRequests(alert, windowStart);
      
      case 'quota_percentage':
        return await this.calculateQuotaPercentage(alert);
      
      default:
        throw new Error(`Unknown threshold type: ${alert.thresholdType}`);
    }
  }

  private async calculateUsagePercentage(alert: UsageAlert, windowStart: Date): Promise<number> {
    let whereClause = `WHERE window_start >= ${windowStart}`;
    
    if (alert.endpoint) {
      whereClause += ` AND endpoint = ${alert.endpoint}`;
    }
    if (alert.method) {
      whereClause += ` AND method = ${alert.method}`;
    }

    const result = await db.queryAll`
      SELECT 
        SUM(request_count) as total_requests,
        COUNT(DISTINCT identifier) as unique_users
      FROM rate_limit_usage
      ${whereClause}
    `;

    const totalRequests = result[0]?.total_requests || 0;
    
    // Get theoretical maximum based on rate limits
    const ruleResult = await db.queryAll`
      SELECT AVG(max_requests) as avg_limit
      FROM rate_limit_rules
      WHERE enabled = true
      ${alert.endpoint ? `AND endpoint = ${alert.endpoint}` : ''}
      ${alert.method ? `AND method = ${alert.method}` : ''}
      ${alert.tier ? `AND tier = ${alert.tier}` : ''}
    `;

    const avgLimit = ruleResult[0]?.avg_limit || 100;
    const timeWindowMinutes = alert.timeWindowMinutes;
    const theoreticalMax = avgLimit * timeWindowMinutes;

    return theoreticalMax > 0 ? (totalRequests / theoreticalMax) * 100 : 0;
  }

  private async calculateBlockedRequests(alert: UsageAlert, windowStart: Date): Promise<number> {
    let whereClause = `WHERE window_start >= ${windowStart}`;
    
    if (alert.endpoint) {
      whereClause += ` AND endpoint = ${alert.endpoint}`;
    }
    if (alert.method) {
      whereClause += ` AND method = ${alert.method}`;
    }

    const result = await db.queryAll`
      SELECT SUM(blocked_count) as total_blocked
      FROM rate_limit_usage
      ${whereClause}
    `;

    return result[0]?.total_blocked || 0;
  }

  private async calculateQuotaPercentage(alert: UsageAlert): Promise<number> {
    let whereClause = '';
    if (alert.tier) {
      whereClause = `WHERE tier = ${alert.tier}`;
    }

    const result = await db.queryAll`
      SELECT 
        AVG(GREATEST(
          current_daily_usage::numeric / daily_quota::numeric,
          current_monthly_usage::numeric / monthly_quota::numeric
        )) * 100 as avg_quota_percentage
      FROM user_quotas
      ${whereClause}
    `;

    return result[0]?.avg_quota_percentage || 0;
  }

  // Send alert notifications
  async sendAlertNotifications(triggers: AlertTrigger[]): Promise<void> {
    for (const trigger of triggers) {
      try {
        // Log alert
        console.warn(`Rate limit alert triggered: ${trigger.alertName}`, {
          currentValue: trigger.currentValue,
          thresholdValue: trigger.thresholdValue,
          endpoint: trigger.endpoint,
          severity: trigger.severity
        });

        // Here you would integrate with your notification system
        // For example: email service, Slack webhook, PagerDuty, etc.
        
        // Example webhook notification (if configured)
        const alert = await this.getAlertById(trigger.alertId);
        if (alert?.webhookUrl) {
          await this.sendWebhookNotification(alert.webhookUrl, trigger);
        }

      } catch (error) {
        console.error(`Failed to send alert notification for ${trigger.alertName}:`, error);
      }
    }
  }

  private async getAlertById(alertId: number): Promise<UsageAlert | null> {
    const result = await db.queryAll`
      SELECT 
        id, name, endpoint, method, tier, threshold_type as "thresholdType",
        threshold_value as "thresholdValue", time_window_minutes as "timeWindowMinutes",
        enabled, webhook_url as "webhookUrl", email_recipients as "emailRecipients"
      FROM rate_limit_alerts
      WHERE id = ${alertId}
      LIMIT 1
    `;

    return result.length > 0 ? result[0] : null;
  }

  private async sendWebhookNotification(webhookUrl: string, trigger: AlertTrigger): Promise<void> {
    try {
      const payload = {
        alert: trigger.alertName,
        severity: trigger.severity,
        currentValue: trigger.currentValue,
        thresholdValue: trigger.thresholdValue,
        endpoint: trigger.endpoint,
        method: trigger.method,
        tier: trigger.tier,
        triggeredAt: trigger.triggeredAt.toISOString(),
        message: `Rate limit alert: ${trigger.alertName} - Current: ${trigger.currentValue}, Threshold: ${trigger.thresholdValue}`
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  // Get top violators (users/IPs with most violations)
  async getTopViolators(limit: number = 10): Promise<any[]> {
    const result = await db.queryAll`
      SELECT 
        identifier,
        COUNT(DISTINCT endpoint) as endpoints_violated,
        SUM(violation_count) as total_violations,
        MAX(penalty_until) as latest_penalty_until,
        AVG(penalty_multiplier) as avg_penalty_multiplier
      FROM rate_limit_penalties
      WHERE penalty_until > NOW() - INTERVAL '7 days'
      GROUP BY identifier
      ORDER BY total_violations DESC
      LIMIT ${limit}
    `;

    return result;
  }

  // Get rate limiting health score
  async getHealthScore(): Promise<{
    score: number;
    factors: any[];
    recommendations: string[];
  }> {
    const factors = [];
    const recommendations = [];
    let totalScore = 100;

    // Check blocking rate
    const blockingRate = await this.getOverallBlockingRate();
    factors.push({ name: 'Blocking Rate', value: blockingRate, weight: 30 });
    
    if (blockingRate > 10) {
      totalScore -= 20;
      recommendations.push('High blocking rate detected. Consider adjusting rate limits.');
    } else if (blockingRate > 5) {
      totalScore -= 10;
      recommendations.push('Moderate blocking rate. Monitor for potential issues.');
    }

    // Check quota utilization
    const quotaUtilization = await this.getAverageQuotaUtilization();
    factors.push({ name: 'Quota Utilization', value: quotaUtilization, weight: 25 });
    
    if (quotaUtilization > 90) {
      totalScore -= 15;
      recommendations.push('Very high quota utilization. Consider increasing quotas.');
    } else if (quotaUtilization > 80) {
      totalScore -= 8;
      recommendations.push('High quota utilization. Monitor closely.');
    }

    // Check penalty frequency
    const penaltyFrequency = await this.getPenaltyFrequency();
    factors.push({ name: 'Penalty Frequency', value: penaltyFrequency, weight: 20 });
    
    if (penaltyFrequency > 5) {
      totalScore -= 15;
      recommendations.push('High penalty frequency. Review rate limiting rules.');
    }

    // Check system health
    const systemHealth = await this.getSystemHealth();
    factors.push({ name: 'System Health', value: systemHealth, weight: 25 });
    
    if (systemHealth < 95) {
      totalScore -= 10;
      recommendations.push('Rate limiting system health issues detected.');
    }

    return {
      score: Math.max(0, Math.min(100, totalScore)),
      factors,
      recommendations
    };
  }

  private async getOverallBlockingRate(): Promise<number> {
    const result = await db.queryAll`
      SELECT 
        SUM(blocked_count) as total_blocked,
        SUM(request_count) as total_requests
      FROM rate_limit_usage
      WHERE window_start >= NOW() - INTERVAL '24 hours'
    `;

    const blocked = result[0]?.total_blocked || 0;
    const total = result[0]?.total_requests || 1;
    
    return (blocked / total) * 100;
  }

  private async getAverageQuotaUtilization(): Promise<number> {
    const result = await db.queryAll`
      SELECT AVG(
        GREATEST(
          current_daily_usage::numeric / daily_quota::numeric,
          current_monthly_usage::numeric / monthly_quota::numeric
        )
      ) * 100 as avg_utilization
      FROM user_quotas
    `;

    return result[0]?.avg_utilization || 0;
  }

  private async getPenaltyFrequency(): Promise<number> {
    const result = await db.queryAll`
      SELECT COUNT(*) as penalty_count
      FROM rate_limit_penalties
      WHERE updated_at >= NOW() - INTERVAL '24 hours'
    `;

    return result[0]?.penalty_count || 0;
  }

  private async getSystemHealth(): Promise<number> {
    // This is a simplified health check
    // In a real system, you'd check database performance, cache hit rates, etc.
    return 98; // Assume healthy for now
  }
}

// Global instance
export const rateLimitAnalytics = new RateLimitAnalytics();

// Note: Cron jobs would be implemented separately in a production environment