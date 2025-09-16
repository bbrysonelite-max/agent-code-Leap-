import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { prospectDB as prospectDb } from "../prospect/db";
import { agentDB as agentDb } from "../agent/db";
import { emailDB as emailDb } from "../email/db";
import { CRM as crmDb } from "../ai_crm/db";
import { DrillDownRequest, DrillDownResponse, MetricSummaryResponse, DateRange, ReportFilters } from "./types";

export const drillDown = api(
  { method: "POST", path: "/analytics/drill-down", auth: true, expose: true },
  async (request: {
    data_source: string;
    dimension: string;
    value: any;
    filters?: any;
    date_range?: any;
  }): Promise<DrillDownResponse> => {
    const { data_source, dimension, value, filters, date_range } = request;
    
    switch (data_source) {
      case 'prospects':
        return await drillDownProspects(dimension, value, filters, date_range);
      case 'campaigns':
        return await drillDownCampaigns(dimension, value, filters, date_range);
      case 'agents':
        return await drillDownAgents(dimension, value, filters, date_range);
      case 'deals':
        return await drillDownDeals(dimension, value, filters, date_range);
      case 'activities':
        return await drillDownActivities(dimension, value, filters, date_range);
      default:
        throw new Error(`Unsupported data source: ${data_source}`);
    }
  }
);

async function drillDownProspects(
  dimension: string, 
  value: any, 
  filters?: ReportFilters, 
  dateRange?: DateRange
): Promise<any> {
  let whereClause = "WHERE 1=1";
  const params: any[] = [];
  let paramIndex = 0;
  
  if (dateRange) {
    whereClause += ` AND created_at >= $${++paramIndex} AND created_at <= $${++paramIndex}`;
    params.push(dateRange.start_date, dateRange.end_date);
  }
  
  // Add dimension filter
  switch (dimension) {
    case 'status':
      whereClause += ` AND status = $${++paramIndex}`;
      params.push(value);
      break;
    case 'score_range':
      if (Array.isArray(value) && value.length === 2) {
        whereClause += ` AND score >= $${++paramIndex} AND score <= $${++paramIndex}`;
        params.push(value[0], value[1]);
      }
      break;
    case 'date':
      whereClause += ` AND DATE(created_at) = $${++paramIndex}`;
      params.push(value);
      break;
  }
  
  // Add additional filters
  if (filters?.prospect_statuses?.length) {
    whereClause += ` AND status = ANY($${++paramIndex})`;
    params.push(filters.prospect_statuses);
  }
  
  const query = `
    SELECT 
      id,
      name,
      email,
      company,
      status,
      score,
      created_at,
      COUNT(*) OVER() as total_count
    FROM prospects
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  
  const results = await prospectDb.query(query, ...params);
  
  return {
    dimension,
    value,
    total_count: results[0]?.total_count || 0,
    data: results.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      company: row.company,
      status: row.status,
      score: row.score,
      created_at: row.created_at
    }))
  };
}

async function drillDownCampaigns(
  dimension: string,
  value: any,
  filters?: ReportFilters,
  dateRange?: DateRange
): Promise<any> {
  let whereClause = "WHERE 1=1";
  const params: any[] = [];
  let paramIndex = 0;
  
  if (dateRange) {
    whereClause += ` AND created_at >= $${++paramIndex} AND created_at <= $${++paramIndex}`;
    params.push(dateRange.start_date, dateRange.end_date);
  }
  
  switch (dimension) {
    case 'status':
      whereClause += ` AND status = $${++paramIndex}`;
      params.push(value);
      break;
    case 'performance':
      // Filter by performance tier (high, medium, low)
      if (value === 'high') {
        whereClause += ` AND open_rate > 0.25`;
      } else if (value === 'medium') {
        whereClause += ` AND open_rate > 0.15 AND open_rate <= 0.25`;
      } else if (value === 'low') {
        whereClause += ` AND open_rate <= 0.15`;
      }
      break;
  }
  
  if (filters?.campaign_ids?.length) {
    whereClause += ` AND id = ANY($${++paramIndex})`;
    params.push(filters.campaign_ids);
  }
  
  const query = `
    SELECT 
      id,
      name,
      subject,
      status,
      sent_count,
      opened_count,
      clicked_count,
      replied_count,
      open_rate,
      click_rate,
      reply_rate,
      created_at,
      COUNT(*) OVER() as total_count
    FROM email_campaigns
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  
  const results = await emailDb.query(query, ...params);
  
  return {
    dimension,
    value,
    total_count: results[0]?.total_count || 0,
    data: results
  };
}

async function drillDownAgents(
  dimension: string,
  value: any,
  filters?: ReportFilters,
  dateRange?: DateRange
): Promise<any> {
  let whereClause = "WHERE 1=1";
  const params: any[] = [];
  let paramIndex = 0;
  
  if (dateRange) {
    whereClause += ` AND created_at >= $${++paramIndex} AND created_at <= $${++paramIndex}`;
    params.push(dateRange.start_date, dateRange.end_date);
  }
  
  switch (dimension) {
    case 'status':
      whereClause += ` AND status = $${++paramIndex}`;
      params.push(value);
      break;
    case 'performance':
      // Would need additional performance metrics table
      break;
  }
  
  if (filters?.agent_ids?.length) {
    whereClause += ` AND id = ANY($${++paramIndex})`;
    params.push(filters.agent_ids);
  }
  
  const query = `
    SELECT 
      id,
      name,
      email,
      status,
      daily_limit,
      current_count,
      created_at,
      COUNT(*) OVER() as total_count
    FROM agents
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  
  const results = await agentDb.query(query, ...params);
  
  return {
    dimension,
    value,
    total_count: results[0]?.total_count || 0,
    data: results
  };
}

async function drillDownDeals(
  dimension: string,
  value: any,
  filters?: ReportFilters,
  dateRange?: DateRange
): Promise<any> {
  let whereClause = "WHERE 1=1";
  const params: any[] = [];
  let paramIndex = 0;
  
  if (dateRange) {
    whereClause += ` AND created_at >= $${++paramIndex} AND created_at <= $${++paramIndex}`;
    params.push(dateRange.start_date, dateRange.end_date);
  }
  
  switch (dimension) {
    case 'stage':
      whereClause += ` AND stage = $${++paramIndex}`;
      params.push(value);
      break;
    case 'value_range':
      if (Array.isArray(value) && value.length === 2) {
        whereClause += ` AND value >= $${++paramIndex} AND value <= $${++paramIndex}`;
        params.push(value[0], value[1]);
      }
      break;
  }
  
  if (filters?.deal_stages?.length) {
    whereClause += ` AND stage = ANY($${++paramIndex})`;
    params.push(filters.deal_stages);
  }
  
  const query = `
    SELECT 
      id,
      title,
      stage,
      value,
      probability,
      contact_id,
      created_at,
      updated_at,
      COUNT(*) OVER() as total_count
    FROM deals
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  
  const results = await crmDb.query(query, ...params);
  
  return {
    dimension,
    value,
    total_count: results[0]?.total_count || 0,
    data: results
  };
}

async function drillDownActivities(
  dimension: string,
  value: any,
  filters?: ReportFilters,
  dateRange?: DateRange
): Promise<any> {
  let whereClause = "WHERE 1=1";
  const params: any[] = [];
  let paramIndex = 0;
  
  if (dateRange) {
    whereClause += ` AND created_at >= $${++paramIndex} AND created_at <= $${++paramIndex}`;
    params.push(dateRange.start_date, dateRange.end_date);
  }
  
  switch (dimension) {
    case 'type':
      whereClause += ` AND type = $${++paramIndex}`;
      params.push(value);
      break;
    case 'outcome':
      whereClause += ` AND outcome = $${++paramIndex}`;
      params.push(value);
      break;
  }
  
  if (filters?.activity_types?.length) {
    whereClause += ` AND type = ANY($${++paramIndex})`;
    params.push(filters.activity_types);
  }
  
  const query = `
    SELECT 
      id,
      type,
      subject,
      description,
      outcome,
      contact_id,
      deal_id,
      created_at,
      COUNT(*) OVER() as total_count
    FROM activities
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 100
  `;
  
  const results = await crmDb.query(query, ...params);
  
  return {
    dimension,
    value,
    total_count: results[0]?.total_count || 0,
    data: results
  };
}

export const getMetricSummary = api(
  { method: "POST", path: "/analytics/summary", auth: true, expose: true },
  async (params: {
    data_source: string;
    date_range?: any;
    filters?: any;
  }): Promise<MetricSummaryResponse> => {
    const { data_source, date_range, filters } = params;
    
    const defaultDateRange = date_range || {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end_date: new Date()
    };
    
    switch (data_source) {
      case 'prospects':
        return await getProspectSummary(defaultDateRange, filters);
      case 'campaigns':
        return await getCampaignSummary(defaultDateRange, filters);
      case 'agents':
        return await getAgentSummary(defaultDateRange, filters);
      case 'deals':
        return await getDealSummary(defaultDateRange, filters);
      case 'activities':
        return await getActivitySummary(defaultDateRange, filters);
      default:
        throw new Error(`Unsupported data source: ${data_source}`);
    }
  }
);

async function getProspectSummary(dateRange: DateRange, filters?: ReportFilters): Promise<any> {
  const query = `
    SELECT 
      COUNT(*) as total_prospects,
      COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_prospects,
      COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_prospects,
      AVG(score) as avg_score,
      MIN(score) as min_score,
      MAX(score) as max_score
    FROM prospects
    WHERE created_at >= $1 AND created_at <= $2
  `;
  
  const result = await prospectDb.queryRow(query, dateRange.start_date, dateRange.end_date);
  
  return {
    total_prospects: parseInt(result.total_prospects),
    qualified_prospects: parseInt(result.qualified_prospects),
    contacted_prospects: parseInt(result.contacted_prospects),
    qualification_rate: result.total_prospects > 0 ? result.qualified_prospects / result.total_prospects : 0,
    contact_rate: result.total_prospects > 0 ? result.contacted_prospects / result.total_prospects : 0,
    avg_score: parseFloat(result.avg_score || 0),
    score_range: { min: parseFloat(result.min_score || 0), max: parseFloat(result.max_score || 0) }
  };
}

async function getCampaignSummary(dateRange: DateRange, filters?: ReportFilters): Promise<any> {
  const query = `
    SELECT 
      COUNT(*) as total_campaigns,
      SUM(sent_count) as total_sent,
      SUM(opened_count) as total_opened,
      SUM(clicked_count) as total_clicked,
      SUM(replied_count) as total_replied,
      AVG(open_rate) as avg_open_rate,
      AVG(click_rate) as avg_click_rate,
      AVG(reply_rate) as avg_reply_rate
    FROM email_campaigns
    WHERE created_at >= $1 AND created_at <= $2
  `;
  
  const result = await emailDb.queryRow(query, dateRange.start_date, dateRange.end_date);
  
  return {
    total_campaigns: parseInt(result.total_campaigns),
    total_sent: parseInt(result.total_sent || 0),
    total_opened: parseInt(result.total_opened || 0),
    total_clicked: parseInt(result.total_clicked || 0),
    total_replied: parseInt(result.total_replied || 0),
    avg_open_rate: parseFloat(result.avg_open_rate || 0),
    avg_click_rate: parseFloat(result.avg_click_rate || 0),
    avg_reply_rate: parseFloat(result.avg_reply_rate || 0)
  };
}

async function getAgentSummary(dateRange: DateRange, filters?: ReportFilters): Promise<any> {
  const query = `
    SELECT 
      COUNT(*) as total_agents,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_agents,
      COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_agents,
      AVG(daily_limit) as avg_daily_limit,
      SUM(current_count) as total_current_count
    FROM agents
    WHERE created_at >= $1 AND created_at <= $2
  `;
  
  const result = await agentDb.queryRow(query, dateRange.start_date, dateRange.end_date);
  
  return {
    total_agents: parseInt(result.total_agents),
    active_agents: parseInt(result.active_agents),
    paused_agents: parseInt(result.paused_agents),
    avg_daily_limit: parseFloat(result.avg_daily_limit || 0),
    total_current_count: parseInt(result.total_current_count || 0),
    utilization_rate: result.avg_daily_limit > 0 ? result.total_current_count / (result.total_agents * result.avg_daily_limit) : 0
  };
}

async function getDealSummary(dateRange: DateRange, filters?: ReportFilters): Promise<any> {
  const query = `
    SELECT 
      COUNT(*) as total_deals,
      SUM(value) as total_value,
      COUNT(CASE WHEN stage = 'closed_won' THEN 1 END) as won_deals,
      SUM(CASE WHEN stage = 'closed_won' THEN value ELSE 0 END) as won_value,
      AVG(value) as avg_deal_value,
      AVG(probability) as avg_probability
    FROM deals
    WHERE created_at >= $1 AND created_at <= $2
  `;
  
  const result = await crmDb.queryRow(query, dateRange.start_date, dateRange.end_date);
  
  return {
    total_deals: parseInt(result.total_deals),
    total_value: parseFloat(result.total_value || 0),
    won_deals: parseInt(result.won_deals),
    won_value: parseFloat(result.won_value || 0),
    avg_deal_value: parseFloat(result.avg_deal_value || 0),
    avg_probability: parseFloat(result.avg_probability || 0),
    win_rate: result.total_deals > 0 ? result.won_deals / result.total_deals : 0,
    conversion_value: result.total_value > 0 ? result.won_value / result.total_value : 0
  };
}

async function getActivitySummary(dateRange: DateRange, filters?: ReportFilters): Promise<any> {
  const query = `
    SELECT 
      COUNT(*) as total_activities,
      COUNT(CASE WHEN type = 'email' THEN 1 END) as email_activities,
      COUNT(CASE WHEN type = 'call' THEN 1 END) as call_activities,
      COUNT(CASE WHEN type = 'meeting' THEN 1 END) as meeting_activities,
      COUNT(CASE WHEN outcome = 'successful' THEN 1 END) as successful_activities
    FROM activities
    WHERE created_at >= $1 AND created_at <= $2
  `;
  
  const result = await crmDb.queryRow(query, dateRange.start_date, dateRange.end_date);
  
  return {
    total_activities: parseInt(result.total_activities),
    email_activities: parseInt(result.email_activities),
    call_activities: parseInt(result.call_activities),
    meeting_activities: parseInt(result.meeting_activities),
    successful_activities: parseInt(result.successful_activities),
    success_rate: result.total_activities > 0 ? result.successful_activities / result.total_activities : 0
  };
}