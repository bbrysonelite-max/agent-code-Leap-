import { api } from "encore.dev/api";
import { db } from "./db";
import { ValidationError } from "../shared/errors";

export interface QuotaUsageBreakdown {
  userId: string;
  tier: string;
  dailyUsage: {
    total: number;
    byEndpoint: Record<string, number>;
    byHour: Record<string, number>;
    remaining: number;
    resetTime: string;
  };
  monthlyUsage: {
    total: number;
    byEndpoint: Record<string, number>;
    byDay: Record<string, number>;
    remaining: number;
    resetTime: string;
  };
  quotaHealth: {
    score: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    projectedDailyUsage: number;
    projectedMonthlyUsage: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface QuotaAlert {
  id: number;
  userId: string;
  alertType: 'approaching_limit' | 'limit_exceeded' | 'unusual_usage';
  threshold: number;
  currentUsage: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: Date;
  acknowledged: boolean;
}

export interface QuotaAdjustmentRequest {
  userId: string;
  adjustmentType: 'temporary_increase' | 'permanent_change' | 'emergency_boost';
  dailyQuotaChange?: number;
  monthlyQuotaChange?: number;
  validUntil?: Date;
  reason: string;
  autoApprove?: boolean;
}

export interface UsageForecast {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  projectedUsage: number;
  confidence: number;
  factors: string[];
  recommendations: string[];
}

class QuotaManager {
  
  /**
   * Get comprehensive quota usage breakdown for a user
   */
  async getQuotaUsageBreakdown(userId: string): Promise<QuotaUsageBreakdown> {
    // Get current quota configuration
    const quota = await this.getUserQuotaConfig(userId);
    
    // Get usage data
    const [dailyUsage, monthlyUsage, usageHistory] = await Promise.all([
      this.getDailyUsageBreakdown(userId),
      this.getMonthlyUsageBreakdown(userId),
      this.getUsageHistory(userId, 30) // Last 30 days
    ]);

    // Calculate quota health metrics
    const quotaHealth = await this.calculateQuotaHealth(userId, usageHistory);

    return {
      userId,
      tier: quota.tier,
      dailyUsage: {
        total: dailyUsage.total,
        byEndpoint: dailyUsage.byEndpoint,
        byHour: dailyUsage.byHour,
        remaining: Math.max(0, quota.dailyQuota - dailyUsage.total),
        resetTime: this.getNextDailyReset().toISOString()
      },
      monthlyUsage: {
        total: monthlyUsage.total,
        byEndpoint: monthlyUsage.byEndpoint,
        byDay: monthlyUsage.byDay,
        remaining: Math.max(0, quota.monthlyQuota - monthlyUsage.total),
        resetTime: this.getNextMonthlyReset().toISOString()
      },
      quotaHealth
    };
  }

  /**
   * Intelligent quota adjustment with approval workflow
   */
  async requestQuotaAdjustment(request: QuotaAdjustmentRequest): Promise<{
    requestId: string;
    status: 'approved' | 'pending' | 'denied';
    reason?: string;
  }> {
    // Validate request
    await this.validateAdjustmentRequest(request);

    // Check if auto-approval criteria are met
    const autoApprovalResult = await this.checkAutoApprovalEligibility(request);
    
    if (autoApprovalResult.eligible || request.autoApprove) {
      // Apply adjustment immediately
      await this.applyQuotaAdjustment(request);
      
      return {
        requestId: `adj_${Date.now()}_${request.userId}`,
        status: 'approved',
        reason: autoApprovalResult.reason
      };
    }

    // Create pending request for manual review
    const requestId = await this.createAdjustmentRequest(request);
    
    // Notify administrators
    await this.notifyAdministrators(request, requestId);

    return {
      requestId,
      status: 'pending',
      reason: 'Request requires manual review'
    };
  }

  /**
   * Dynamic quota scaling based on usage patterns
   */
  async performDynamicQuotaScaling(): Promise<void> {
    const users = await this.getUsersNeedingQuotaAdjustment();
    
    for (const user of users) {
      try {
        const analysis = await this.analyzeUserUsagePattern(user.userId);
        
        if (analysis.shouldIncrease) {
          await this.requestQuotaAdjustment({
            userId: user.userId,
            adjustmentType: 'temporary_increase',
            dailyQuotaChange: analysis.suggestedDailyIncrease,
            monthlyQuotaChange: analysis.suggestedMonthlyIncrease,
            validUntil: analysis.validUntil,
            reason: `Automatic scaling: ${analysis.reason}`,
            autoApprove: true
          });
        } else if (analysis.shouldDecrease) {
          await this.requestQuotaAdjustment({
            userId: user.userId,
            adjustmentType: 'temporary_increase',
            dailyQuotaChange: -analysis.suggestedDailyDecrease,
            monthlyQuotaChange: -analysis.suggestedMonthlyDecrease,
            validUntil: analysis.validUntil,
            reason: `Automatic scaling: ${analysis.reason}`,
            autoApprove: true
          });
        }
      } catch (error) {
        console.error(`Error scaling quota for user ${user.userId}:`, error);
      }
    }
  }

  /**
   * Generate usage forecasts and alerts
   */
  async generateUsageForecast(userId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<UsageForecast> {
    const historicalData = await this.getUsageHistory(userId, this.getHistoryDays(period));
    const currentTrends = await this.analyzeUsageTrends(historicalData);
    
    // Machine learning model would go here
    // For now, using statistical forecasting
    const forecast = await this.statisticalForecast(historicalData, period);
    
    const recommendations = await this.generateRecommendations(userId, forecast, currentTrends);

    return {
      userId,
      period,
      projectedUsage: forecast.projected,
      confidence: forecast.confidence,
      factors: forecast.factors,
      recommendations
    };
  }

  /**
   * Proactive quota alert system
   */
  async checkProactiveAlerts(): Promise<QuotaAlert[]> {
    const alerts: QuotaAlert[] = [];
    const users = await this.getAllActiveUsers();

    for (const user of users) {
      try {
        const breakdown = await this.getQuotaUsageBreakdown(user.userId);
        const forecast = await this.generateUsageForecast(user.userId, 'daily');
        
        // Check various alert conditions
        alerts.push(...await this.checkQuotaAlerts(breakdown, forecast));
        
      } catch (error) {
        console.error(`Error checking alerts for user ${user.userId}:`, error);
      }
    }

    // Store alerts in database
    await this.storeAlerts(alerts);
    
    // Send notifications for critical alerts
    await this.sendCriticalAlertNotifications(alerts.filter(a => a.severity === 'critical'));

    return alerts;
  }

  /**
   * Smart quota redistribution during peak usage
   */
  async performQuotaRedistribution(): Promise<void> {
    const systemLoad = await this.getSystemLoadMetrics();
    
    if (systemLoad.overallUsage > 85) {
      // Identify users exceeding fair use and temporarily reduce quotas
      const heavyUsers = await this.identifyHeavyUsers();
      const lightUsers = await this.identifyLightUsers();
      
      // Temporarily redistribute quotas
      await this.redistributeQuotas(heavyUsers, lightUsers);
      
      // Schedule reversal for off-peak hours
      await this.scheduleQuotaReversal(heavyUsers, lightUsers);
    }
  }

  // Private helper methods

  private async getUserQuotaConfig(userId: string): Promise<any> {
    const result = await db.queryAll`
      SELECT user_id as "userId", tier, daily_quota as "dailyQuota", 
             monthly_quota as "monthlyQuota", current_daily_usage as "currentDailyUsage",
             current_monthly_usage as "currentMonthlyUsage"
      FROM user_quotas
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (result.length === 0) {
      throw new ValidationError("User quota not found", "not_found");
    }

    return result[0];
  }

  private async getDailyUsageBreakdown(userId: string): Promise<{
    total: number;
    byEndpoint: Record<string, number>;
    byHour: Record<string, number>;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db.queryAll`
      SELECT 
        endpoint,
        EXTRACT(HOUR FROM created_at) as hour,
        SUM(request_count) as requests
      FROM rate_limit_usage
      WHERE identifier = ${userId}
        AND DATE(created_at) = ${today}
      GROUP BY endpoint, EXTRACT(HOUR FROM created_at)
    `;

    const byEndpoint: Record<string, number> = {};
    const byHour: Record<string, number> = {};
    let total = 0;

    for (const row of result) {
      const requests = parseInt(row.requests);
      total += requests;
      byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] || 0) + requests;
      byHour[row.hour] = (byHour[row.hour] || 0) + requests;
    }

    return { total, byEndpoint, byHour };
  }

  private async getMonthlyUsageBreakdown(userId: string): Promise<{
    total: number;
    byEndpoint: Record<string, number>;
    byDay: Record<string, number>;
  }> {
    const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const result = await db.queryAll`
      SELECT 
        endpoint,
        DATE(created_at) as day,
        SUM(request_count) as requests
      FROM rate_limit_usage
      WHERE identifier = ${userId}
        AND TO_CHAR(created_at, 'YYYY-MM') = ${thisMonth}
      GROUP BY endpoint, DATE(created_at)
    `;

    const byEndpoint: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let total = 0;

    for (const row of result) {
      const requests = parseInt(row.requests);
      total += requests;
      byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] || 0) + requests;
      byDay[row.day] = (byDay[row.day] || 0) + requests;
    }

    return { total, byEndpoint, byDay };
  }

  private async getUsageHistory(userId: string, days: number): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db.queryAll`
      SELECT 
        DATE(created_at) as date,
        endpoint,
        SUM(request_count) as total_requests
      FROM rate_limit_usage
      WHERE identifier = ${userId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at), endpoint
      ORDER BY date DESC
    `;

    return result;
  }

  private async calculateQuotaHealth(userId: string, usageHistory: any[]): Promise<{
    score: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    projectedDailyUsage: number;
    projectedMonthlyUsage: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    // Simplified health calculation
    const recentUsage = usageHistory.slice(0, 7); // Last 7 days
    const avgDailyUsage = recentUsage.reduce((sum, day) => sum + day.total_requests, 0) / 7;
    
    const trend = this.calculateTrend(recentUsage.map(d => d.total_requests));
    const projectedDailyUsage = Math.ceil(avgDailyUsage * 1.1); // 10% buffer
    const projectedMonthlyUsage = projectedDailyUsage * 30;
    
    // Get user quota
    const quota = await this.getUserQuotaConfig(userId);
    const dailyUtilization = (projectedDailyUsage / quota.dailyQuota) * 100;
    const monthlyUtilization = (projectedMonthlyUsage / quota.monthlyQuota) * 100;
    
    let score = 100;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (dailyUtilization > 90 || monthlyUtilization > 90) {
      score -= 40;
      riskLevel = 'critical';
    } else if (dailyUtilization > 75 || monthlyUtilization > 75) {
      score -= 25;
      riskLevel = 'high';
    } else if (dailyUtilization > 60 || monthlyUtilization > 60) {
      score -= 15;
      riskLevel = 'medium';
    }

    return {
      score: Math.max(0, score),
      trend,
      projectedDailyUsage,
      projectedMonthlyUsage,
      riskLevel
    };
  }

  private calculateTrend(values: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const older = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
    
    const change = (recent - older) / older;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  private getNextDailyReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private getNextMonthlyReset(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }

  private async validateAdjustmentRequest(request: QuotaAdjustmentRequest): Promise<void> {
    if (!request.userId || !request.reason) {
      throw new ValidationError("User ID and reason are required", "validation");
    }

    if (!request.dailyQuotaChange && !request.monthlyQuotaChange) {
      throw new ValidationError("At least one quota change must be specified", "validation");
    }
  }

  private async checkAutoApprovalEligibility(request: QuotaAdjustmentRequest): Promise<{
    eligible: boolean;
    reason: string;
  }> {
    // Check user's history and request parameters
    const userMetrics = await this.getUserTrustMetrics(request.userId);
    
    // Auto-approve small increases for trusted users
    if (userMetrics.trustScore > 80 && 
        (request.dailyQuotaChange || 0) <= 1000 && 
        (request.monthlyQuotaChange || 0) <= 30000) {
      return { eligible: true, reason: 'Trusted user with reasonable increase' };
    }

    // Auto-approve emergency boosts for premium users
    if (request.adjustmentType === 'emergency_boost' && userMetrics.tier === 'premium') {
      return { eligible: true, reason: 'Emergency boost for premium user' };
    }

    return { eligible: false, reason: 'Requires manual review' };
  }

  private async getUserTrustMetrics(userId: string): Promise<{
    trustScore: number;
    tier: string;
    violationHistory: number;
  }> {
    // Calculate trust score based on various factors
    return { trustScore: 85, tier: 'premium', violationHistory: 0 };
  }

  private async applyQuotaAdjustment(request: QuotaAdjustmentRequest): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (request.dailyQuotaChange) {
      updates.push(`daily_quota = daily_quota + $${values.length + 1}`);
      values.push(request.dailyQuotaChange);
    }

    if (request.monthlyQuotaChange) {
      updates.push(`monthly_quota = monthly_quota + $${values.length + 1}`);
      values.push(request.monthlyQuotaChange);
    }

    updates.push(`updated_at = NOW()`);
    values.push(request.userId);

    const updateClause = updates.join(', ');

    // Use raw SQL for dynamic queries
    const sql = `
      UPDATE user_quotas
      SET ${updateClause}
      WHERE user_id = $${values.length}
    `;
    await db.queryAll(sql, ...values);
  }

  private async createAdjustmentRequest(request: QuotaAdjustmentRequest): Promise<string> {
    // Store request in database for admin review
    const requestId = `req_${Date.now()}_${request.userId}`;
    // Implementation would insert into adjustment_requests table
    return requestId;
  }

  private async notifyAdministrators(request: QuotaAdjustmentRequest, requestId: string): Promise<void> {
    // Send notification to administrators about pending request
    console.log(`Quota adjustment request ${requestId} pending admin review`);
  }

  private getHistoryDays(period: 'daily' | 'weekly' | 'monthly'): number {
    switch (period) {
      case 'daily': return 7;
      case 'weekly': return 30;
      case 'monthly': return 90;
      default: return 7;
    }
  }

  private async analyzeUsageTrends(historicalData: any[]): Promise<any> {
    // Analyze patterns, seasonality, growth trends
    return { growth: 'stable', seasonality: 'none', anomalies: [] };
  }

  private async statisticalForecast(historicalData: any[], period: string): Promise<{
    projected: number;
    confidence: number;
    factors: string[];
  }> {
    // Simplified statistical forecasting
    const recent = historicalData.slice(0, 7);
    const average = recent.reduce((sum, day) => sum + day.total_requests, 0) / recent.length;
    
    return {
      projected: Math.ceil(average * 1.1),
      confidence: 0.75,
      factors: ['Historical average', 'Growth trend', 'Seasonal patterns']
    };
  }

  private async generateRecommendations(userId: string, forecast: any, trends: any): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (forecast.projected > 1000) {
      recommendations.push('Consider upgrading to a higher tier plan');
    }
    
    if (trends.growth === 'increasing') {
      recommendations.push('Monitor usage closely as growth is accelerating');
    }

    return recommendations;
  }

  private async getAllActiveUsers(): Promise<{ userId: string }[]> {
    const result = await db.queryAll`
      SELECT DISTINCT user_id as "userId" 
      FROM user_quotas 
      WHERE current_daily_usage > 0 OR current_monthly_usage > 0
    `;
    return result as { userId: string }[];
  }

  private async checkQuotaAlerts(breakdown: QuotaUsageBreakdown, forecast: UsageForecast): Promise<QuotaAlert[]> {
    const alerts: QuotaAlert[] = [];
    
    // Check if approaching daily limit
    const dailyUtilization = (breakdown.dailyUsage.total / (breakdown.dailyUsage.total + breakdown.dailyUsage.remaining)) * 100;
    if (dailyUtilization > 80) {
      alerts.push({
        id: 0,
        userId: breakdown.userId,
        alertType: 'approaching_limit',
        threshold: 80,
        currentUsage: dailyUtilization,
        message: 'Daily quota is 80% utilized',
        severity: dailyUtilization > 90 ? 'critical' : 'warning',
        createdAt: new Date(),
        acknowledged: false
      });
    }

    return alerts;
  }

  private async storeAlerts(alerts: QuotaAlert[]): Promise<void> {
    // Store alerts in database
    for (const alert of alerts) {
      // Implementation would insert into quota_alerts table
    }
  }

  private async sendCriticalAlertNotifications(alerts: QuotaAlert[]): Promise<void> {
    // Send notifications for critical alerts
    for (const alert of alerts) {
      console.warn(`Critical quota alert: ${alert.message} for user ${alert.userId}`);
    }
  }

  private async getUsersNeedingQuotaAdjustment(): Promise<{ userId: string }[]> {
    // Implementation would query users with high utilization or specific patterns
    return [];
  }

  private async analyzeUserUsagePattern(userId: string): Promise<{
    shouldIncrease: boolean;
    shouldDecrease: boolean;
    suggestedDailyIncrease: number;
    suggestedMonthlyIncrease: number;
    suggestedDailyDecrease: number;
    suggestedMonthlyDecrease: number;
    validUntil: Date;
    reason: string;
  }> {
    // Analyze usage patterns and return recommendations
    return {
      shouldIncrease: false,
      shouldDecrease: false,
      suggestedDailyIncrease: 0,
      suggestedMonthlyIncrease: 0,
      suggestedDailyDecrease: 0,
      suggestedMonthlyDecrease: 0,
      validUntil: new Date(),
      reason: 'No adjustment needed'
    };
  }

  private async getSystemLoadMetrics(): Promise<{ overallUsage: number }> {
    // Get current system load metrics
    return { overallUsage: 70 };
  }

  private async identifyHeavyUsers(): Promise<{ userId: string; usage: number }[]> {
    // Implementation would identify users with exceptionally high usage
    return [];
  }

  private async identifyLightUsers(): Promise<{ userId: string; usage: number }[]> {
    // Implementation would identify users with low usage
    return [];
  }

  private async redistributeQuotas(heavyUsers: any[], lightUsers: any[]): Promise<void> {
    // Temporarily adjust quotas for load balancing
  }

  private async scheduleQuotaReversal(heavyUsers: any[], lightUsers: any[]): Promise<void> {
    // Schedule reversal of temporary quota changes
  }
}

// Global instance
export const quotaManager = new QuotaManager();

// API endpoints
export const getQuotaBreakdown = api(
  { method: "GET", path: "/rate-limiting/quota/breakdown/:userId", expose: true },
  async ({ userId }: { userId: string }): Promise<QuotaUsageBreakdown> => {
    return await quotaManager.getQuotaUsageBreakdown(userId);
  }
);

export const requestQuotaAdjustment = api(
  { method: "POST", path: "/rate-limiting/quota/adjust", expose: true },
  async (request: QuotaAdjustmentRequest) => {
    return await quotaManager.requestQuotaAdjustment(request);
  }
);

export const getUsageForecast = api(
  { method: "GET", path: "/rate-limiting/quota/forecast/:userId", expose: true },
  async ({ userId, period = 'daily' }: { userId: string; period?: 'daily' | 'weekly' | 'monthly' }): Promise<UsageForecast> => {
    return await quotaManager.generateUsageForecast(userId, period);
  }
);

export const checkQuotaAlerts = api(
  { method: "GET", path: "/rate-limiting/quota/alerts", expose: true },
  async (): Promise<{ alerts: QuotaAlert[] }> => {
    const alerts = await quotaManager.checkProactiveAlerts();
    return { alerts };
  }
);

export const performQuotaScaling = api(
  { method: "POST", path: "/rate-limiting/quota/scale", expose: true },
  async (): Promise<{ success: boolean }> => {
    await quotaManager.performDynamicQuotaScaling();
    return { success: true };
  }
);