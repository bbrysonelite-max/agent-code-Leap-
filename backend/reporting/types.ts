export interface Dashboard {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  layout: any;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: string;
  title: string;
  description?: string;
  config: any;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  created_at: Date;
}

export interface Report {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: ReportType;
  config: any;
  filters: any;
  schedule_config?: any;
  created_at: Date;
  updated_at: Date;
}

export interface ReportExecution {
  id: string;
  report_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  file_path?: string;
  file_size?: number;
  execution_time_ms?: number;
  error_message?: string;
  format: string;
}

export type ReportType = 'prospect_analysis' | 'email_performance' | 'activity_summary' | 'custom';

export interface CreateReportRequest {
  name: string;
  description?: string;
  type: ReportType;
  config: any;
  filters: any;
  schedule_config?: any;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  layout?: any;
  is_default?: boolean;
}

export interface ChartData {
  type: string;
  title: string;
  data: any[];
  config?: any;
}

export interface DrillDownRequest {
  metric: string;
  filters?: any;
  date_range?: DateRange;
}

export interface DrillDownResponse {
  data: any[];
  total: number;
}

export interface MetricSummaryResponse {
  metrics: any[];
  totals: any;
}

export interface DateRange {
  start_date: Date;
  end_date: Date;
}

export interface ReportFilters {
  [key: string]: any;
}

export interface CreateDashboardRequest {
  name: string;
  description?: string;
  layout?: any;
  is_default?: boolean;
}

export interface DashboardListResponse {
  dashboards: Dashboard[];
  total: number;
}

export interface ExportRequest {
  report_id: string;
  format: 'pdf' | 'csv' | 'xlsx';
  options?: ExportOptions;
}

export interface ExportOptions {
  include_charts?: boolean;
  date_range?: DateRange;
}

export interface ReportData {
  summary: any;
  charts: ChartData[];
  raw_data?: any[];
}

export interface ReportListResponse {
  reports: Report[];
  total: number;
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  config?: any;
  filters?: any;
  schedule_config?: any;
}

export interface CreateWidgetRequest {
  dashboard_id: string;
  widget_type: string;
  title: string;
  description?: string;
  config: any;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

export interface UpdateWidgetRequest {
  widget_type?: string;
  title?: string;
  description?: string;
  config?: any;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

export interface WidgetDataResponse {
  data: any;
  last_updated: Date;
}

export interface WidgetListResponse {
  widgets: DashboardWidget[];
  total: number;
}