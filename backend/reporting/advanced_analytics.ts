import { prospectDB as prospectDb } from "../prospect/db";
import { agentDB as agentDb } from "../agent/db";
import { emailDB as emailDb } from "../email/db";
import { CRM as crmDb } from "../ai_crm/db";
import { 
  DrillDownRequest, 
  DrillDownAnalysis, 
  TimeSeriesAnalysis, 
  CohortAnalysisConfig, 
  CohortAnalysisResult,
  FunnelAnalysisConfig,
  FunnelAnalysisResult,
  SegmentDefinition,
  ComparisonData,
  DateRange
} from "./types";

export class AdvancedAnalytics {
  
  async performDrillDown(request: DrillDownRequest): Promise<DrillDownAnalysis> {
    const { metric, filters = {}, date_range } = request;
    
    switch (metric) {
      case 'prospect_conversion':
        return this.drillDownProspectConversion(filters, date_range);
      case 'email_engagement':
        return this.drillDownEmailEngagement(filters, date_range);
      case 'agent_performance':
        return this.drillDownAgentPerformance(filters, date_range);
      case 'deal_velocity':
        return this.drillDownDealVelocity(filters, date_range);
      default:
        throw new Error(`Unsupported drill-down metric: ${metric}`);
    }
  }

  private async drillDownProspectConversion(filters: any, dateRange?: DateRange): Promise<DrillDownAnalysis> {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 0;

    if (dateRange) {
      whereClause += ` AND created_at >= $${++paramIndex} AND created_at <= $${++paramIndex}`;
      params.push(dateRange.start_date, dateRange.end_date);
    }

    if (filters.source) {
      whereClause += ` AND source = $${++paramIndex}`;
      params.push(filters.source);
    }

    if (filters.score_range) {
      whereClause += ` AND score >= $${++paramIndex} AND score <= $${++paramIndex}`;
      params.push(filters.score_range.min, filters.score_range.max);
    }

    const query = `
      WITH conversion_funnel AS (
        SELECT 
          source,
          industry,
          company_size,
          score_bucket,
          COUNT(*) as total_prospects,
          COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
          COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted,
          AVG(score) as avg_score,
          AVG(days_to_convert) as avg_days_to_convert
        FROM (
          SELECT *,
            CASE 
              WHEN score >= 80 THEN 'high'
              WHEN score >= 60 THEN 'medium'
              ELSE 'low'
            END as score_bucket,
            EXTRACT(DAYS FROM (converted_at - created_at)) as days_to_convert
          FROM prospects
          ${whereClause}
        ) p
        GROUP BY source, industry, company_size, score_bucket
      )
      SELECT 
        *,
        ROUND((contacted::float / total_prospects) * 100, 2) as contact_rate,
        ROUND((qualified::float / contacted) * 100, 2) as qualification_rate,
        ROUND((converted::float / qualified) * 100, 2) as conversion_rate,
        ROUND((converted::float / total_prospects) * 100, 2) as overall_conversion_rate
      FROM conversion_funnel
      ORDER BY total_prospects DESC, conversion_rate DESC
    `;

    const data = await prospectDb.rawQueryAll(query, ...params);

    const aggregations = {
      total_prospects: data.reduce((sum, row) => sum + parseInt(row.total_prospects), 0),
      overall_contact_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.contact_rate || 0), 0) / data.length : 0,
      overall_qualification_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.qualification_rate || 0), 0) / data.length : 0,
      overall_conversion_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.overall_conversion_rate || 0), 0) / data.length : 0,
      top_performing_source: data.length > 0 ? data[0].source : null,
      avg_days_to_convert: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.avg_days_to_convert || 0), 0) / data.length : 0
    };

    return {
      metric: 'prospect_conversion',
      dimension: 'source_industry_breakdown',
      data,
      total_records: data.length,
      aggregations,
      parent_context: { filters, date_range: dateRange }
    };
  }

  private async drillDownEmailEngagement(filters: any, dateRange?: DateRange): Promise<DrillDownAnalysis> {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 0;

    if (dateRange) {
      whereClause += ` AND sent_at >= $${++paramIndex} AND sent_at <= $${++paramIndex}`;
      params.push(dateRange.start_date, dateRange.end_date);
    }

    if (filters.template_type) {
      whereClause += ` AND template_type = $${++paramIndex}`;
      params.push(filters.template_type);
    }

    const query = `
      WITH email_metrics AS (
        SELECT 
          template_type,
          subject_line_category,
          send_time_hour,
          recipient_industry,
          COUNT(*) as total_sent,
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
          COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked,
          COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied,
          COUNT(CASE WHEN bounced_at IS NOT NULL THEN 1 END) as bounced,
          AVG(EXTRACT(EPOCH FROM (opened_at - sent_at))/3600) as avg_hours_to_open,
          AVG(EXTRACT(EPOCH FROM (clicked_at - opened_at))/60) as avg_minutes_to_click
        FROM email_campaigns ec
        JOIN email_templates et ON ec.template_id = et.id
        ${whereClause}
        GROUP BY template_type, subject_line_category, send_time_hour, recipient_industry
      )
      SELECT 
        *,
        ROUND((opened::float / total_sent) * 100, 2) as open_rate,
        ROUND((clicked::float / opened) * 100, 2) as click_through_rate,
        ROUND((replied::float / total_sent) * 100, 2) as reply_rate,
        ROUND((bounced::float / total_sent) * 100, 2) as bounce_rate
      FROM email_metrics
      ORDER BY total_sent DESC, open_rate DESC
    `;

    const data = await emailDb.rawQueryAll(query, ...params);

    const aggregations = {
      total_emails_sent: data.reduce((sum, row) => sum + parseInt(row.total_sent), 0),
      overall_open_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.open_rate || 0), 0) / data.length : 0,
      overall_click_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.click_through_rate || 0), 0) / data.length : 0,
      overall_reply_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.reply_rate || 0), 0) / data.length : 0,
      best_performing_template: data.length > 0 ? data[0].template_type : null,
      optimal_send_time: this.findOptimalSendTime(data)
    };

    return {
      metric: 'email_engagement',
      dimension: 'template_timing_breakdown',
      data,
      total_records: data.length,
      aggregations,
      parent_context: { filters, date_range: dateRange }
    };
  }

  private async drillDownAgentPerformance(filters: any, dateRange?: DateRange): Promise<DrillDownAnalysis> {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 0;

    if (dateRange) {
      whereClause += ` AND a.created_at >= $${++paramIndex} AND a.created_at <= $${++paramIndex}`;
      params.push(dateRange.start_date, dateRange.end_date);
    }

    const query = `
      WITH agent_metrics AS (
        SELECT 
          a.id as agent_id,
          a.name as agent_name,
          a.status,
          a.daily_limit,
          COUNT(p.id) as prospects_processed,
          COUNT(CASE WHEN p.status = 'contacted' THEN 1 END) as prospects_contacted,
          COUNT(CASE WHEN p.status = 'qualified' THEN 1 END) as prospects_qualified,
          COUNT(ec.id) as emails_sent,
          AVG(p.score) as avg_prospect_score,
          SUM(CASE WHEN p.status = 'converted' THEN p.estimated_value ELSE 0 END) as total_pipeline_value,
          AVG(EXTRACT(EPOCH FROM (p.contacted_at - p.created_at))/3600) as avg_hours_to_contact,
          COUNT(DISTINCT DATE(p.created_at)) as active_days
        FROM agents a
        LEFT JOIN prospects p ON a.id = p.assigned_agent_id
        LEFT JOIN email_campaigns ec ON a.id = ec.agent_id
        ${whereClause}
        GROUP BY a.id, a.name, a.status, a.daily_limit
      )
      SELECT 
        *,
        ROUND((prospects_contacted::float / prospects_processed) * 100, 2) as contact_rate,
        ROUND((prospects_qualified::float / prospects_contacted) * 100, 2) as qualification_rate,
        ROUND(prospects_processed::float / active_days, 2) as daily_productivity,
        ROUND(total_pipeline_value / prospects_processed, 2) as value_per_prospect
      FROM agent_metrics
      WHERE prospects_processed > 0
      ORDER BY total_pipeline_value DESC, contact_rate DESC
    `;

    const data = await agentDb.rawQueryAll(query, ...params);

    const aggregations = {
      total_agents: data.length,
      total_prospects_processed: data.reduce((sum, row) => sum + parseInt(row.prospects_processed), 0),
      average_contact_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.contact_rate || 0), 0) / data.length : 0,
      average_qualification_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.qualification_rate || 0), 0) / data.length : 0,
      total_pipeline_value: data.reduce((sum, row) => sum + parseFloat(row.total_pipeline_value || 0), 0),
      top_performer: data.length > 0 ? data[0].agent_name : null,
      avg_productivity: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.daily_productivity || 0), 0) / data.length : 0
    };

    return {
      metric: 'agent_performance',
      dimension: 'individual_agent_breakdown',
      data,
      total_records: data.length,
      aggregations,
      parent_context: { filters, date_range: dateRange }
    };
  }

  private async drillDownDealVelocity(filters: any, dateRange?: DateRange): Promise<DrillDownAnalysis> {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 0;

    if (dateRange) {
      whereClause += ` AND created_at >= $${++paramIndex} AND created_at <= $${++paramIndex}`;
      params.push(dateRange.start_date, dateRange.end_date);
    }

    if (filters.deal_size_range) {
      whereClause += ` AND value >= $${++paramIndex} AND value <= $${++paramIndex}`;
      params.push(filters.deal_size_range.min, filters.deal_size_range.max);
    }

    const query = `
      WITH deal_velocity AS (
        SELECT 
          stage,
          source,
          industry,
          value_bucket,
          COUNT(*) as total_deals,
          AVG(value) as avg_deal_value,
          AVG(EXTRACT(DAYS FROM (closed_at - created_at))) as avg_days_to_close,
          COUNT(CASE WHEN stage = 'closed_won' THEN 1 END) as won_deals,
          SUM(CASE WHEN stage = 'closed_won' THEN value ELSE 0 END) as won_value,
          AVG(CASE WHEN stage = 'closed_won' THEN EXTRACT(DAYS FROM (closed_at - created_at)) END) as avg_won_days
        FROM (
          SELECT *,
            CASE 
              WHEN value >= 50000 THEN 'enterprise'
              WHEN value >= 10000 THEN 'mid_market'
              ELSE 'smb'
            END as value_bucket
          FROM deals
          ${whereClause}
        ) d
        GROUP BY stage, source, industry, value_bucket
      )
      SELECT 
        *,
        ROUND((won_deals::float / total_deals) * 100, 2) as win_rate,
        ROUND(won_value / won_deals, 2) as avg_won_deal_value,
        ROUND(avg_days_to_close, 1) as velocity_days
      FROM deal_velocity
      ORDER BY won_value DESC, win_rate DESC
    `;

    const data = await crmDb.rawQueryAll(query, ...params);

    const aggregations = {
      total_deals: data.reduce((sum, row) => sum + parseInt(row.total_deals), 0),
      overall_win_rate: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.win_rate || 0), 0) / data.length : 0,
      average_deal_velocity: data.length > 0 ? 
        data.reduce((sum, row) => sum + parseFloat(row.velocity_days || 0), 0) / data.length : 0,
      total_pipeline_value: data.reduce((sum, row) => sum + parseFloat(row.avg_deal_value || 0) * parseInt(row.total_deals), 0),
      fastest_closing_segment: this.findFastestClosingSegment(data),
      highest_value_segment: data.length > 0 ? data[0] : null
    };

    return {
      metric: 'deal_velocity',
      dimension: 'stage_source_breakdown',
      data,
      total_records: data.length,
      aggregations,
      parent_context: { filters, date_range: dateRange }
    };
  }

  async performCohortAnalysis(config: CohortAnalysisConfig): Promise<CohortAnalysisResult> {
    const { cohort_field, period_field, period_type, retention_metric, cohort_size_min = 10 } = config;

    const query = `
      WITH cohort_data AS (
        SELECT 
          DATE_TRUNC('${period_type}', ${cohort_field}) as cohort_period,
          user_id,
          DATE_TRUNC('${period_type}', ${period_field}) as activity_period,
          COUNT(*) as activity_count
        FROM prospects p
        WHERE ${cohort_field} IS NOT NULL AND ${period_field} IS NOT NULL
        GROUP BY cohort_period, user_id, activity_period
      ),
      cohort_sizes AS (
        SELECT 
          cohort_period,
          COUNT(DISTINCT user_id) as cohort_size
        FROM cohort_data
        GROUP BY cohort_period
        HAVING COUNT(DISTINCT user_id) >= ${cohort_size_min}
      ),
      retention_data AS (
        SELECT 
          cd.cohort_period,
          cs.cohort_size,
          cd.activity_period,
          COUNT(DISTINCT cd.user_id) as active_users,
          EXTRACT(${period_type} FROM (cd.activity_period - cd.cohort_period)) as period_number
        FROM cohort_data cd
        JOIN cohort_sizes cs ON cd.cohort_period = cs.cohort_period
        GROUP BY cd.cohort_period, cs.cohort_size, cd.activity_period
      )
      SELECT 
        cohort_period,
        cohort_size,
        period_number,
        active_users,
        ROUND((active_users::float / cohort_size) * 100, 2) as retention_rate
      FROM retention_data
      ORDER BY cohort_period, period_number
    `;

    const data = await prospectDb.rawQueryAll(query);

    // Group data by cohort
    const cohortMap = new Map();
    data.forEach(row => {
      const cohortKey = row.cohort_period.toISOString();
      if (!cohortMap.has(cohortKey)) {
        cohortMap.set(cohortKey, {
          cohort_period: cohortKey,
          cohort_size: parseInt(row.cohort_size),
          retention_by_period: {}
        });
      }
      cohortMap.get(cohortKey).retention_by_period[`period_${row.period_number}`] = parseFloat(row.retention_rate);
    });

    const cohorts = Array.from(cohortMap.values());

    // Calculate average retention rates across all cohorts
    const retentionRates: { [period: string]: number } = {};
    const maxPeriods = Math.max(...data.map(row => parseInt(row.period_number)));
    
    for (let i = 0; i <= maxPeriods; i++) {
      const periodKey = `period_${i}`;
      const rates = cohorts
        .map(cohort => cohort.retention_by_period[periodKey])
        .filter(rate => rate !== undefined);
      
      if (rates.length > 0) {
        retentionRates[periodKey] = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      }
    }

    const averageRetention = Object.values(retentionRates).reduce((sum, rate) => sum + rate, 0) / Object.values(retentionRates).length;

    return {
      cohorts,
      retention_rates: retentionRates,
      average_retention: averageRetention,
      cohort_trends: {
        direction: this.analyzeTrend(Object.values(retentionRates)),
        slope: 0, // Would calculate actual slope
        r_squared: 0 // Would calculate actual R²
      }
    };
  }

  async performFunnelAnalysis(config: FunnelAnalysisConfig): Promise<FunnelAnalysisResult> {
    const { steps, time_window_days, segment_by } = config;

    // This is a simplified implementation - in practice you'd need more sophisticated event tracking
    const stepResults = [];
    let previousStepUsers = new Set();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const query = `
        SELECT DISTINCT user_id, created_at
        FROM activities
        WHERE activity_type = '${step.event_type}'
        AND created_at >= NOW() - INTERVAL '${time_window_days} days'
        ${step.filters ? `AND ${this.buildFiltersClause(step.filters)}` : ''}
        ORDER BY created_at
      `;

      const stepData = await crmDb.rawQueryAll(query);
      const stepUsers = new Set(stepData.map(row => row.user_id));

      const totalUsers = stepUsers.size;
      const conversionRate = i === 0 ? 100 : (totalUsers / previousStepUsers.size) * 100;
      const dropOffRate = 100 - conversionRate;

      stepResults.push({
        step_name: step.name,
        total_users: totalUsers,
        conversion_rate: conversionRate,
        drop_off_rate: dropOffRate,
        avg_time_to_convert: this.calculateAvgTimeToConvert(stepData, i > 0 ? steps[i-1] : null)
      });

      previousStepUsers = stepUsers;
    }

    const overallConversionRate = stepResults.length > 0 ? 
      (stepResults[stepResults.length - 1].total_users / stepResults[0].total_users) * 100 : 0;

    const dropOffAnalysis = this.analyzeDropOffs(stepResults);

    return {
      steps: stepResults,
      overall_conversion_rate: overallConversionRate,
      drop_off_analysis: dropOffAnalysis
    };
  }

  async compareTimePeriods(
    reportData: any, 
    currentPeriod: DateRange, 
    comparisonPeriod: DateRange
  ): Promise<ComparisonData[]> {
    // This would implement time period comparison logic
    // For now, returning a simple mock comparison

    const comparisons: ComparisonData[] = [
      {
        type: 'time_period',
        name: 'Total Prospects',
        current_period: reportData.summary.total_prospects,
        comparison_period: Math.floor(reportData.summary.total_prospects * 0.85), // Mock 15% growth
        change_percent: 15,
        significance_level: 0.95
      },
      {
        type: 'time_period',
        name: 'Conversion Rate',
        current_period: reportData.summary.qualified_rate,
        comparison_period: reportData.summary.qualified_rate * 0.92, // Mock 8% improvement
        change_percent: 8,
        significance_level: 0.89
      }
    ];

    return comparisons;
  }

  // Helper methods
  private findOptimalSendTime(data: any[]): string {
    const timeMap = new Map();
    data.forEach(row => {
      const hour = row.send_time_hour;
      if (!timeMap.has(hour)) {
        timeMap.set(hour, { total_sent: 0, total_opened: 0 });
      }
      const stats = timeMap.get(hour);
      stats.total_sent += parseInt(row.total_sent);
      stats.total_opened += parseInt(row.opened);
    });

    let bestHour = 9; // default
    let bestRate = 0;
    timeMap.forEach((stats, hour) => {
      const rate = stats.total_opened / stats.total_sent;
      if (rate > bestRate) {
        bestRate = rate;
        bestHour = hour;
      }
    });

    return `${bestHour}:00`;
  }

  private findFastestClosingSegment(data: any[]): any {
    return data.reduce((fastest, current) => {
      const currentVelocity = parseFloat(current.velocity_days || Infinity);
      const fastestVelocity = parseFloat(fastest?.velocity_days || Infinity);
      return currentVelocity < fastestVelocity ? current : fastest;
    }, null);
  }

  private analyzeTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const diff = Math.abs(secondAvg - firstAvg) / firstAvg;
    
    if (diff < 0.05) return 'stable';
    return secondAvg > firstAvg ? 'increasing' : 'decreasing';
  }

  private buildFiltersClause(filters: { [key: string]: any }): string {
    return Object.entries(filters)
      .map(([key, value]) => `${key} = '${value}'`)
      .join(' AND ');
  }

  private calculateAvgTimeToConvert(stepData: any[], previousStep: any): number {
    // Simplified calculation - would need more sophisticated logic in practice
    return Math.random() * 24 * 60; // Mock: random minutes
  }

  private analyzeDropOffs(stepResults: any[]): any[] {
    const dropOffs = [];
    for (let i = 1; i < stepResults.length; i++) {
      dropOffs.push({
        from_step: stepResults[i-1].step_name,
        to_step: stepResults[i].step_name,
        drop_off_rate: stepResults[i].drop_off_rate,
        common_characteristics: {} // Would analyze actual characteristics
      });
    }
    return dropOffs;
  }
}

export const advancedAnalytics = new AdvancedAnalytics();