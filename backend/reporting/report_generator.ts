import { prospectDB as prospectDb } from "../prospect/db";
import { agentDB as agentDb } from "../agent/db";
import { emailDB as emailDb } from "../email/db";
import { CRM as crmDb } from "../ai_crm/db";
import { Report, ReportType } from "./db";
import { ReportData, ChartData, DateRange, ReportFilters } from "./types";

export async function generateReportData(report: Report): Promise<ReportData> {
  const { type, config, filters } = report;
  
  switch (type) {
    case 'prospects':
      return generateProspectReport(config, filters);
    case 'campaigns':
      return generateCampaignReport(config, filters);
    case 'agents':
      return generateAgentReport(config, filters);
    case 'deals':
      return generateDealReport(config, filters);
    case 'activities':
      return generateActivityReport(config, filters);
    default:
      throw new Error(`Unsupported report type: ${type}`);
  }
}

async function generateProspectReport(config: any, filters: ReportFilters): Promise<ReportData> {
  const { date_range, metrics, grouping } = config;
  
  let whereClause = "WHERE created_at >= $1 AND created_at <= $2";
  const params = [date_range.start_date, date_range.end_date];
  let paramIndex = 2;
  
  if (filters.prospect_statuses?.length) {
    whereClause += ` AND status = ANY($${++paramIndex})`;
    params.push(filters.prospect_statuses);
  }
  
  if (filters.score_range) {
    whereClause += ` AND score >= $${++paramIndex} AND score <= $${++paramIndex}`;
    params.push(filters.score_range.min, filters.score_range.max);
  }
  
  const query = `
    SELECT 
      COUNT(*) as total_prospects,
      AVG(score) as avg_score,
      COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_count,
      COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_count,
      DATE_TRUNC('${grouping.time_period || 'day'}', created_at) as period
    FROM prospects
    ${whereClause}
    GROUP BY period
    ORDER BY period
  `;
  
  const data = await prospectDb.rawQueryAll(query, ...params);
  
  const summary = {
    total_prospects: data.reduce((sum, row) => sum + parseInt(row.total_prospects), 0),
    avg_score: data.length > 0 ? data.reduce((sum, row) => sum + parseFloat(row.avg_score || 0), 0) / data.length : 0,
    qualified_rate: data.length > 0 ? data.reduce((sum, row) => sum + parseInt(row.qualified_count), 0) / data.reduce((sum, row) => sum + parseInt(row.total_prospects), 0) : 0
  };
  
  const charts: ChartData[] = [
    {
      type: 'line',
      title: 'Prospect Acquisition Over Time',
      data: data.map(row => ({
        x: row.period,
        y: parseInt(row.total_prospects)
      })),
      config: { color: '#3b82f6' }
    },
    {
      type: 'bar',
      title: 'Prospect Status Distribution',
      data: data.map(row => ({
        period: row.period,
        qualified: parseInt(row.qualified_count),
        contacted: parseInt(row.contacted_count),
        total: parseInt(row.total_prospects)
      })),
      config: { stacked: true }
    }
  ];
  
  return {
    metadata: {
      report_id: '',
      generated_at: new Date(),
      filters,
      date_range,
      total_records: data.length
    },
    data,
    summary,
    charts
  };
}

async function generateCampaignReport(config: any, filters: ReportFilters): Promise<ReportData> {
  const { date_range, metrics, grouping } = config;
  
  let whereClause = "WHERE created_at >= $1 AND created_at <= $2";
  const params = [date_range.start_date, date_range.end_date];
  let paramIndex = 2;
  
  if (filters.campaign_ids?.length) {
    whereClause += ` AND id = ANY($${++paramIndex})`;
    params.push(filters.campaign_ids);
  }
  
  const query = `
    SELECT 
      COUNT(*) as total_campaigns,
      SUM(sent_count) as total_sent,
      SUM(opened_count) as total_opened,
      SUM(clicked_count) as total_clicked,
      SUM(replied_count) as total_replied,
      AVG(open_rate) as avg_open_rate,
      AVG(click_rate) as avg_click_rate,
      AVG(reply_rate) as avg_reply_rate,
      DATE_TRUNC('${grouping.time_period || 'day'}', created_at) as period
    FROM email_campaigns
    ${whereClause}
    GROUP BY period
    ORDER BY period
  `;
  
  const data = await emailDb.rawQueryAll(query, ...params);
  
  const summary = {
    total_campaigns: data.reduce((sum, row) => sum + parseInt(row.total_campaigns), 0),
    total_sent: data.reduce((sum, row) => sum + parseInt(row.total_sent || 0), 0),
    avg_open_rate: data.length > 0 ? data.reduce((sum, row) => sum + parseFloat(row.avg_open_rate || 0), 0) / data.length : 0,
    avg_click_rate: data.length > 0 ? data.reduce((sum, row) => sum + parseFloat(row.avg_click_rate || 0), 0) / data.length : 0,
    avg_reply_rate: data.length > 0 ? data.reduce((sum, row) => sum + parseFloat(row.avg_reply_rate || 0), 0) / data.length : 0
  };
  
  const charts: ChartData[] = [
    {
      type: 'line',
      title: 'Email Performance Over Time',
      data: data.map(row => ({
        period: row.period,
        sent: parseInt(row.total_sent || 0),
        opened: parseInt(row.total_opened || 0),
        clicked: parseInt(row.total_clicked || 0),
        replied: parseInt(row.total_replied || 0)
      })),
      config: { multiSeries: true }
    },
    {
      type: 'bar',
      title: 'Campaign Engagement Rates',
      data: data.map(row => ({
        period: row.period,
        open_rate: parseFloat(row.avg_open_rate || 0),
        click_rate: parseFloat(row.avg_click_rate || 0),
        reply_rate: parseFloat(row.avg_reply_rate || 0)
      })),
      config: { percentage: true }
    }
  ];
  
  return {
    metadata: {
      report_id: '',
      generated_at: new Date(),
      filters,
      date_range,
      total_records: data.length
    },
    data,
    summary,
    charts
  };
}

async function generateAgentReport(config: any, filters: ReportFilters): Promise<ReportData> {
  const { date_range, metrics, grouping } = config;
  
  let whereClause = "WHERE created_at >= $1 AND created_at <= $2";
  const params = [date_range.start_date, date_range.end_date];
  let paramIndex = 2;
  
  if (filters.agent_ids?.length) {
    whereClause += ` AND id = ANY($${++paramIndex})`;
    params.push(filters.agent_ids);
  }
  
  const query = `
    SELECT 
      COUNT(*) as total_agents,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_agents,
      COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_agents,
      AVG(daily_limit) as avg_daily_limit,
      DATE_TRUNC('${grouping.time_period || 'day'}', created_at) as period
    FROM agents
    ${whereClause}
    GROUP BY period
    ORDER BY period
  `;
  
  const data = await agentDb.query(query, ...params);
  
  const summary = {
    total_agents: data.reduce((sum, row) => sum + parseInt(row.total_agents), 0),
    active_agents: data.reduce((sum, row) => sum + parseInt(row.active_agents), 0),
    avg_daily_limit: data.length > 0 ? data.reduce((sum, row) => sum + parseFloat(row.avg_daily_limit || 0), 0) / data.length : 0
  };
  
  const charts: ChartData[] = [
    {
      type: 'pie',
      title: 'Agent Status Distribution',
      data: [
        { label: 'Active', value: summary.active_agents },
        { label: 'Paused', value: summary.total_agents - summary.active_agents }
      ],
      config: { colors: ['#10b981', '#ef4444'] }
    }
  ];
  
  return {
    metadata: {
      report_id: '',
      generated_at: new Date(),
      filters,
      date_range,
      total_records: data.length
    },
    data,
    summary,
    charts
  };
}

async function generateDealReport(config: any, filters: ReportFilters): Promise<ReportData> {
  const { date_range, metrics, grouping } = config;
  
  let whereClause = "WHERE created_at >= $1 AND created_at <= $2";
  const params = [date_range.start_date, date_range.end_date];
  let paramIndex = 2;
  
  if (filters.deal_stages?.length) {
    whereClause += ` AND stage = ANY($${++paramIndex})`;
    params.push(filters.deal_stages);
  }
  
  const query = `
    SELECT 
      COUNT(*) as total_deals,
      SUM(value) as total_value,
      AVG(value) as avg_deal_value,
      COUNT(CASE WHEN stage = 'closed_won' THEN 1 END) as won_deals,
      SUM(CASE WHEN stage = 'closed_won' THEN value ELSE 0 END) as won_value,
      DATE_TRUNC('${grouping.time_period || 'day'}', created_at) as period
    FROM deals
    ${whereClause}
    GROUP BY period
    ORDER BY period
  `;
  
  const data = await crmDb.query(query, ...params);
  
  const summary = {
    total_deals: data.reduce((sum, row) => sum + parseInt(row.total_deals), 0),
    total_value: data.reduce((sum, row) => sum + parseFloat(row.total_value || 0), 0),
    won_deals: data.reduce((sum, row) => sum + parseInt(row.won_deals), 0),
    won_value: data.reduce((sum, row) => sum + parseFloat(row.won_value || 0), 0),
    win_rate: 0
  };
  
  summary.win_rate = summary.total_deals > 0 ? summary.won_deals / summary.total_deals : 0;
  
  const charts: ChartData[] = [
    {
      type: 'line',
      title: 'Deal Pipeline Over Time',
      data: data.map(row => ({
        period: row.period,
        total: parseInt(row.total_deals),
        won: parseInt(row.won_deals),
        value: parseFloat(row.total_value || 0)
      })),
      config: { multiSeries: true }
    },
    {
      type: 'funnel',
      title: 'Deal Conversion Funnel',
      data: [
        { stage: 'Total Deals', value: summary.total_deals },
        { stage: 'Won Deals', value: summary.won_deals }
      ],
      config: { colors: ['#3b82f6', '#10b981'] }
    }
  ];
  
  return {
    metadata: {
      report_id: '',
      generated_at: new Date(),
      filters,
      date_range,
      total_records: data.length
    },
    data,
    summary,
    charts
  };
}

async function generateActivityReport(config: any, filters: ReportFilters): Promise<ReportData> {
  const { date_range, metrics, grouping } = config;
  
  let whereClause = "WHERE created_at >= $1 AND created_at <= $2";
  const params = [date_range.start_date, date_range.end_date];
  let paramIndex = 2;
  
  if (filters.activity_types?.length) {
    whereClause += ` AND type = ANY($${++paramIndex})`;
    params.push(filters.activity_types);
  }
  
  const query = `
    SELECT 
      COUNT(*) as total_activities,
      COUNT(CASE WHEN type = 'email' THEN 1 END) as email_activities,
      COUNT(CASE WHEN type = 'call' THEN 1 END) as call_activities,
      COUNT(CASE WHEN type = 'meeting' THEN 1 END) as meeting_activities,
      DATE_TRUNC('${grouping.time_period || 'day'}', created_at) as period
    FROM activities
    ${whereClause}
    GROUP BY period
    ORDER BY period
  `;
  
  const data = await crmDb.query(query, ...params);
  
  const summary = {
    total_activities: data.reduce((sum, row) => sum + parseInt(row.total_activities), 0),
    email_activities: data.reduce((sum, row) => sum + parseInt(row.email_activities), 0),
    call_activities: data.reduce((sum, row) => sum + parseInt(row.call_activities), 0),
    meeting_activities: data.reduce((sum, row) => sum + parseInt(row.meeting_activities), 0)
  };
  
  const charts: ChartData[] = [
    {
      type: 'doughnut',
      title: 'Activity Type Distribution',
      data: [
        { label: 'Email', value: summary.email_activities },
        { label: 'Call', value: summary.call_activities },
        { label: 'Meeting', value: summary.meeting_activities }
      ],
      config: { colors: ['#3b82f6', '#10b981', '#f59e0b'] }
    }
  ];
  
  return {
    metadata: {
      report_id: '',
      generated_at: new Date(),
      filters,
      date_range,
      total_records: data.length
    },
    data,
    summary,
    charts
  };
}