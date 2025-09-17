import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db, DashboardWidget } from "./db";
import { CreateWidgetRequest, UpdateWidgetRequest, WidgetDataResponse, WidgetListResponse } from "./types";
import { prospectDB as prospectDb } from "../prospect/db";
import { agentDB as agentDb } from "../agent/db";
import { emailDB as emailDb } from "../email/db";
import { CRM as crmDb } from "../ai_crm/db";

export const createAdvancedWidget = api(
  { method: "POST", path: "/dashboards/:dashboardId/widgets/advanced", auth: true, expose: true },
  async ({ dashboardId, ...req }: { dashboardId: string } & CreateWidgetRequest): Promise<DashboardWidget> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the dashboard
    const dashboard = await db.queryRow`
      SELECT * FROM dashboards 
      WHERE id = ${dashboardId} AND user_id = ${userID}
    `;
    
    if (!dashboard) {
      throw new Error("Dashboard not found or access denied");
    }
    
    // Validate widget configuration
    validateWidgetConfig(req.widget_type, req.config);
    
    const result = await db.queryRow`
      INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, description, config, 
                                   position_x, position_y, width, height, refresh_interval_seconds,
                                   is_real_time, drill_down_config)
      VALUES (${dashboardId}, ${req.widget_type}, ${req.title}, ${req.description || null}, 
              ${JSON.stringify(req.config)}, ${req.position_x}, ${req.position_y}, 
              ${req.width}, ${req.height}, ${req.refresh_interval_seconds || 300},
              ${req.is_real_time || false}, ${JSON.stringify(req.drill_down_config || {})})
      RETURNING *
    `;
    
    return {
      ...result,
      config: JSON.parse(result.config as string),
      drill_down_config: JSON.parse(result.drill_down_config as string || '{}')
    };
  }
);

export const getAdvancedWidgetData = api(
  { method: "GET", path: "/widgets/:id/advanced-data", auth: true, expose: true },
  async ({ id, filters }: { id: string; filters?: any }): Promise<WidgetDataResponse> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Verify user owns the widget
    const widget = await db.queryRow`
      SELECT w.*, d.user_id
      FROM dashboard_widgets w
      JOIN dashboards d ON w.dashboard_id = d.id
      WHERE w.id = ${id} AND d.user_id = ${userID}
    `;
    
    if (!widget) {
      throw new Error("Widget not found or access denied");
    }
    
    // Generate widget data based on type and config
    const data = await generateAdvancedWidgetData(widget, filters);
    
    return {
      data,
      last_updated: new Date(),
      cache_duration: widget.refresh_interval_seconds || 300
    };
  }
);

export const refreshAdvancedWidget = api(
  { method: "POST", path: "/widgets/:id/refresh-advanced", auth: true, expose: true },
  async ({ id }: { id: string }): Promise<WidgetDataResponse> => {
    // Force refresh widget data
    return getAdvancedWidgetData({ id });
  }
);

export const getAvailableWidgetTypes = api(
  { method: "GET", path: "/widgets/types", auth: true, expose: true },
  async (): Promise<{ widget_types: any[] }> => {
    return {
      widget_types: [
        {
          type: 'metric',
          name: 'Key Metric',
          description: 'Display a single important metric with trend',
          config_schema: {
            data_source: { type: 'select', options: ['prospects', 'campaigns', 'agents', 'deals'] },
            metric: { type: 'select', options: ['count', 'sum', 'average', 'percentage'] },
            time_period: { type: 'select', options: ['today', 'week', 'month', 'quarter'] },
            comparison_period: { type: 'boolean', default: true }
          }
        },
        {
          type: 'chart',
          name: 'Chart',
          description: 'Visualize data with various chart types',
          config_schema: {
            chart_type: { type: 'select', options: ['line', 'bar', 'pie', 'doughnut', 'area'] },
            data_source: { type: 'select', options: ['prospects', 'campaigns', 'agents', 'deals'] },
            grouping: { type: 'select', options: ['day', 'week', 'month', 'source', 'status'] },
            time_period: { type: 'select', options: ['7_days', '30_days', '90_days', '1_year'] }
          }
        },
        {
          type: 'table',
          name: 'Data Table',
          description: 'Display detailed data in table format',
          config_schema: {
            data_source: { type: 'select', options: ['prospects', 'campaigns', 'agents', 'deals'] },
            columns: { type: 'multi_select', options: ['name', 'status', 'score', 'date', 'value'] },
            sort_by: { type: 'select', options: ['date', 'name', 'score', 'value'] },
            limit: { type: 'number', default: 10, max: 100 }
          }
        },
        {
          type: 'funnel',
          name: 'Conversion Funnel',
          description: 'Track conversion through multiple stages',
          config_schema: {
            data_source: { type: 'select', options: ['prospects', 'deals'] },
            stages: { type: 'array', items: { type: 'string' } },
            time_period: { type: 'select', options: ['30_days', '90_days', '1_year'] }
          }
        },
        {
          type: 'heatmap',
          name: 'Activity Heatmap',
          description: 'Visualize activity patterns over time',
          config_schema: {
            data_source: { type: 'select', options: ['email_activity', 'prospect_activity'] },
            time_range: { type: 'select', options: ['24_hours', '7_days', '30_days'] }
          }
        },
        {
          type: 'progress',
          name: 'Goal Progress',
          description: 'Track progress towards goals',
          config_schema: {
            metric: { type: 'select', options: ['prospects', 'emails', 'deals'] },
            goal_value: { type: 'number', required: true },
            time_period: { type: 'select', options: ['daily', 'weekly', 'monthly'] }
          }
        }
      ]
    };
  }
);

export const cloneWidget = api(
  { method: "POST", path: "/widgets/:id/clone", auth: true, expose: true },
  async ({ id, target_dashboard_id }: { id: string; target_dashboard_id?: string }): Promise<DashboardWidget> => {
    const auth = getAuthData()!;
    const userID = auth.userID;
    
    // Get original widget
    const originalWidget = await db.queryRow`
      SELECT w.*, d.user_id
      FROM dashboard_widgets w
      JOIN dashboards d ON w.dashboard_id = d.id
      WHERE w.id = ${id} AND d.user_id = ${userID}
    `;
    
    if (!originalWidget) {
      throw new Error("Widget not found or access denied");
    }
    
    const targetDashboardId = target_dashboard_id || originalWidget.dashboard_id;
    
    // Verify target dashboard access
    const targetDashboard = await db.queryRow`
      SELECT * FROM dashboards 
      WHERE id = ${targetDashboardId} AND user_id = ${userID}
    `;
    
    if (!targetDashboard) {
      throw new Error("Target dashboard not found or access denied");
    }
    
    // Create cloned widget
    const result = await db.queryRow`
      INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, description, config, 
                                   position_x, position_y, width, height, refresh_interval_seconds,
                                   is_real_time, drill_down_config)
      VALUES (${targetDashboardId}, ${originalWidget.widget_type}, 
              ${originalWidget.title + ' (Copy)'}, ${originalWidget.description}, 
              ${originalWidget.config}, ${originalWidget.position_x + 1}, ${originalWidget.position_y + 1}, 
              ${originalWidget.width}, ${originalWidget.height}, ${originalWidget.refresh_interval_seconds},
              ${originalWidget.is_real_time}, ${originalWidget.drill_down_config})
      RETURNING *
    `;
    
    return {
      ...result,
      config: JSON.parse(result.config as string),
      drill_down_config: JSON.parse(result.drill_down_config as string || '{}')
    };
  }
);

async function generateAdvancedWidgetData(widget: any, filters?: any): Promise<any> {
  const { widget_type, config } = widget;
  const parsedConfig = JSON.parse(config as string);
  
  switch (widget_type) {
    case 'metric':
      return generateMetricData(parsedConfig, filters);
    case 'chart':
      return generateChartData(parsedConfig, filters);
    case 'table':
      return generateTableData(parsedConfig, filters);
    case 'funnel':
      return generateFunnelData(parsedConfig, filters);
    case 'heatmap':
      return generateHeatmapData(parsedConfig, filters);
    case 'progress':
      return generateProgressData(parsedConfig, filters);
    default:
      throw new Error(`Unsupported widget type: ${widget_type}`);
  }
}

async function generateMetricData(config: any, filters?: any): Promise<any> {
  const { data_source, metric, time_period, comparison_period } = config;
  
  let currentValue = 0;
  let previousValue = 0;
  
  const timeFilter = getTimeFilter(time_period);
  const comparisonTimeFilter = getTimeFilter(time_period, true);
  
  switch (data_source) {
    case 'prospects':
      if (metric === 'count') {
        const currentResult = await prospectDb.queryRow`
          SELECT COUNT(*) as value FROM prospects WHERE created_at >= ${timeFilter.start}
        `;
        currentValue = parseInt(currentResult.value);
        
        if (comparison_period) {
          const previousResult = await prospectDb.queryRow`
            SELECT COUNT(*) as value FROM prospects 
            WHERE created_at >= ${comparisonTimeFilter.start} AND created_at < ${comparisonTimeFilter.end}
          `;
          previousValue = parseInt(previousResult.value);
        }
      }
      break;
    case 'campaigns':
      if (metric === 'average') {
        const currentResult = await emailDb.queryRow`
          SELECT AVG(open_rate) as value FROM email_campaigns WHERE created_at >= ${timeFilter.start}
        `;
        currentValue = parseFloat(currentResult.value || 0);
      }
      break;
  }
  
  const change = comparison_period && previousValue > 0 ? 
    ((currentValue - previousValue) / previousValue) * 100 : 0;
  
  return {
    value: currentValue,
    previous_value: previousValue,
    change: change,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    format: getMetricFormat(metric),
    label: getMetricLabel(data_source, metric)
  };
}

async function generateChartData(config: any, filters?: any): Promise<any> {
  const { chart_type, data_source, grouping, time_period } = config;
  const timeFilter = getTimeFilter(time_period);
  
  let data = [];
  
  switch (data_source) {
    case 'prospects':
      if (grouping === 'day') {
        const results = await prospectDb.queryAll`
          SELECT DATE_TRUNC('day', created_at) as period, COUNT(*) as value
          FROM prospects 
          WHERE created_at >= ${timeFilter.start}
          GROUP BY period
          ORDER BY period
        `;
        data = results.map(row => ({
          x: row.period.toISOString().split('T')[0],
          y: parseInt(row.value)
        }));
      } else if (grouping === 'status') {
        const results = await prospectDb.queryAll`
          SELECT status, COUNT(*) as value
          FROM prospects 
          WHERE created_at >= ${timeFilter.start}
          GROUP BY status
        `;
        data = results.map(row => ({
          label: row.status,
          value: parseInt(row.value)
        }));
      }
      break;
  }
  
  return {
    type: chart_type,
    data,
    config: {
      responsive: true,
      animation: true,
      title: getChartTitle(data_source, grouping)
    }
  };
}

async function generateTableData(config: any, filters?: any): Promise<any> {
  const { data_source, columns, sort_by, limit } = config;
  
  let data = [];
  
  switch (data_source) {
    case 'prospects':
      const columnList = columns.join(', ');
      const results = await prospectDb.queryAll`
        SELECT ${columnList} FROM prospects 
        ORDER BY ${sort_by} DESC
        LIMIT ${limit || 10}
      `;
      data = results;
      break;
  }
  
  return {
    headers: columns.map((col: string) => formatLabel(col)),
    rows: data.map(row => columns.map((col: string) => row[col])),
    total_count: data.length
  };
}

async function generateFunnelData(config: any, filters?: any): Promise<any> {
  const { data_source, stages, time_period } = config;
  const timeFilter = getTimeFilter(time_period);
  
  // Mock funnel data for now
  const funnelData = stages.map((stage: string, index: number) => {
    const value = Math.floor(1000 * Math.pow(0.7, index)); // 30% drop-off each stage
    const conversionRate = index === 0 ? 100 : (value / 1000) * 100;
    
    return {
      stage,
      value,
      conversion_rate: conversionRate,
      drop_off_rate: index === 0 ? 0 : 100 - conversionRate
    };
  });
  
  return {
    stages: funnelData,
    overall_conversion: funnelData.length > 0 ? funnelData[funnelData.length - 1].conversion_rate : 0
  };
}

async function generateHeatmapData(config: any, filters?: any): Promise<any> {
  const { data_source, time_range } = config;
  
  // Generate mock heatmap data (24h x 7 days)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const data = days.map(day => 
    hours.map(hour => ({
      day,
      hour,
      value: Math.floor(Math.random() * 100)
    }))
  ).flat();
  
  return {
    data,
    max_value: Math.max(...data.map(d => d.value)),
    dimensions: { days, hours }
  };
}

async function generateProgressData(config: any, filters?: any): Promise<any> {
  const { metric, goal_value, time_period } = config;
  
  // Mock progress calculation
  const currentValue = Math.floor(Math.random() * goal_value * 1.2);
  const progress = (currentValue / goal_value) * 100;
  
  return {
    current_value: currentValue,
    goal_value,
    progress_percentage: Math.min(progress, 100),
    status: progress >= 100 ? 'achieved' : progress >= 80 ? 'on_track' : 'behind',
    remaining: Math.max(goal_value - currentValue, 0)
  };
}

// Helper functions
function validateWidgetConfig(widgetType: string, config: any): void {
  const requiredFields: { [key: string]: string[] } = {
    'metric': ['data_source', 'metric'],
    'chart': ['chart_type', 'data_source'],
    'table': ['data_source', 'columns'],
    'funnel': ['data_source', 'stages'],
    'heatmap': ['data_source'],
    'progress': ['metric', 'goal_value']
  };
  
  const required = requiredFields[widgetType] || [];
  const missing = required.filter(field => !config[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields for ${widgetType}: ${missing.join(', ')}`);
  }
}

function getTimeFilter(period: string, isPrevious: boolean = false): { start: Date; end?: Date } {
  const now = new Date();
  const start = new Date();
  
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      if (isPrevious) {
        start.setDate(start.getDate() - 1);
        return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
      }
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      if (isPrevious) {
        start.setDate(start.getDate() - 7);
        return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000) };
      }
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      if (isPrevious) {
        start.setMonth(start.getMonth() - 1);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        return { start, end };
      }
      break;
  }
  
  return { start };
}

function getMetricFormat(metric: string): string {
  const formats: { [key: string]: string } = {
    'count': 'number',
    'sum': 'currency',
    'average': 'decimal',
    'percentage': 'percent'
  };
  return formats[metric] || 'number';
}

function getMetricLabel(dataSource: string, metric: string): string {
  return `${formatLabel(metric)} ${formatLabel(dataSource)}`;
}

function getChartTitle(dataSource: string, grouping: string): string {
  return `${formatLabel(dataSource)} by ${formatLabel(grouping)}`;
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}