export interface CreateDashboardRequest {
  name: string;
  description?: string;
  layout?: any[];
  is_default?: boolean;
  is_public?: boolean;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  layout?: any[];
  is_default?: boolean;
  is_public?: boolean;
}

export interface CreateReportRequest {
  name: string;
  description?: string;
  type: ReportType;
  config: ReportConfig;
  filters?: ReportFilters;
  schedule_config?: ScheduleConfig;
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  config?: ReportConfig;
  filters?: ReportFilters;
  schedule_config?: ScheduleConfig;
}

export interface ReportConfig {
  date_range: DateRange;
  grouping: GroupingOptions;
  metrics: string[];
  chart_type?: ChartType;
  segments?: string[];
}

export interface ScoreRange {
  min: number;
  max: number;
}

export interface ReportFilters {
  agent_ids?: string[];
  campaign_ids?: string[];
  prospect_statuses?: string[];
  deal_stages?: string[];
  activity_types?: string[];
  score_range?: ScoreRange;
  custom_filters?: Record<string, any>;
}

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  time: string; // HH:MM format
  timezone: string;
  recipients: string[];
  format: ExportFormat;
  enabled: boolean;
}

export interface DateRange {
  start_date: Date;
  end_date: Date;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface GroupingOptions {
  primary: string;
  secondary?: string;
  time_period?: 'hour' | 'day' | 'week' | 'month';
}

export interface CreateWidgetRequest {
  dashboard_id: string;
  widget_type: WidgetType;
  title: string;
  config: WidgetConfig;
  data_source: DataSource;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

export interface UpdateWidgetRequest {
  widget_type?: WidgetType;
  title?: string;
  config?: WidgetConfig;
  data_source?: DataSource;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

export interface WidgetConfig {
  chart_type?: ChartType;
  metrics: string[];
  filters?: ReportFilters;
  date_range?: DateRange;
  grouping?: GroupingOptions;
  display_options?: {
    show_legend?: boolean;
    show_labels?: boolean;
    color_scheme?: string;
    animation?: boolean;
  };
}

export interface ReportData {
  metadata: {
    report_id: string;
    generated_at: Date;
    filters: ReportFilters;
    date_range: DateRange;
    total_records: number;
  };
  data: any[];
  summary: Record<string, any>;
  charts?: ChartData[];
}

export interface ChartData {
  type: ChartType;
  title: string;
  data: any[];
  config: any;
}

export interface DrillDownRequest {
  data_source: DataSource;
  dimension: string;
  value: any;
  filters?: ReportFilters;
  date_range?: DateRange;
}

export interface ExportRequest {
  report_id: string;
  format: ExportFormat;
  options?: ExportOptions;
}

export interface ExportOptions {
  include_charts?: boolean;
  include_raw_data?: boolean;
  template?: string;
  branding?: {
    logo_url?: string;
    company_name?: string;
    colors?: Record<string, string>;
  };
}

export interface DrillDownResponse {
  dimension: string;
  value: any;
  total_count: number;
  data: any[];
}

export interface MetricSummaryResponse {
  total_prospects?: number;
  qualified_prospects?: number;
  contacted_prospects?: number;
  qualification_rate?: number;
  contact_rate?: number;
  avg_score?: number;
  score_range?: ScoreRange;
  total_campaigns?: number;
  total_sent?: number;
  total_opened?: number;
  total_clicked?: number;
  total_replied?: number;
  avg_open_rate?: number;
  avg_click_rate?: number;
  avg_reply_rate?: number;
  total_agents?: number;
  active_agents?: number;
  paused_agents?: number;
  avg_daily_limit?: number;
  total_current_count?: number;
  utilization_rate?: number;
  total_deals?: number;
  total_value?: number;
  won_deals?: number;
  won_value?: number;
  avg_deal_value?: number;
  avg_probability?: number;
  win_rate?: number;
  conversion_value?: number;
  total_activities?: number;
  email_activities?: number;
  call_activities?: number;
  meeting_activities?: number;
  successful_activities?: number;
  success_rate?: number;
}

export interface WidgetDataResponse {
  data: any[];
  labels?: string[];
  datasets?: any[];
}

export interface DashboardListResponse {
  dashboards: any[];
}

export interface ReportListResponse {
  reports: any[];
}

export interface WidgetListResponse {
  widgets: any[];
}

export interface ReportExecutionListResponse {
  executions: any[];
}

export type ReportType = 'prospects' | 'campaigns' | 'agents' | 'deals' | 'activities';
export type WidgetType = 'chart' | 'table' | 'metric' | 'timeline';
export type DataSource = 'prospects' | 'campaigns' | 'agents' | 'deals' | 'activities';
export type ChartType = 'line' | 'bar' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'funnel';
export type ExportFormat = 'json' | 'pdf' | 'excel';
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';