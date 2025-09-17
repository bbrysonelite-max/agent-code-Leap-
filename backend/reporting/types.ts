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
  refresh_interval_seconds?: number;
  is_real_time?: boolean;
  drill_down_config?: any;
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
  tags?: string[];
  data_sources?: string[];
  complexity_score?: number;
  estimated_runtime_ms?: number;
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

export type ReportType = 'prospect_analysis' | 'email_performance' | 'activity_summary' | 'agent_performance' | 'deal_pipeline' | 'conversion_funnel' | 'cohort_analysis' | 'custom';

export interface CreateReportRequest {
  name: string;
  description?: string;
  type: ReportType;
  config: any;
  filters: any;
  schedule_config?: any;
  tags?: string[];
  data_sources?: string[];
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
  metadata: ReportMetadata;
  summary: any;
  charts: ChartData[];
  raw_data?: any[];
  drill_down_options?: DrillDownOption[];
  comparisons?: ComparisonData[];
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

// New interfaces for enhanced reporting
export interface ReportMetadata {
  report_id: string;
  generated_at: Date;
  filters: ReportFilters;
  date_range: DateRange;
  total_records: number;
  generation_time_ms?: number;
  data_freshness?: Date;
}

export interface DrillDownOption {
  metric: string;
  label: string;
  description?: string;
  available_dimensions: string[];
  default_grouping?: string;
}

export interface ComparisonData {
  type: 'time_period' | 'segment' | 'cohort';
  name: string;
  current_period: any;
  comparison_period: any;
  change_percent: number;
  significance_level?: number;
}

export interface DrillDownAnalysis {
  metric: string;
  dimension: string;
  data: any[];
  total_records: number;
  aggregations: { [key: string]: any };
  parent_context?: any;
}

export interface SegmentDefinition {
  id: string;
  name: string;
  description?: string;
  criteria: SegmentCriteria;
}

export interface SegmentCriteria {
  demographic_filters?: { [key: string]: any };
  behavioral_filters?: { [key: string]: any };
  engagement_filters?: { [key: string]: any };
  time_window?: DateRange;
}

export interface AdvancedReportConfig {
  base_config: any;
  segments?: string[];
  comparison_periods?: DateRange[];
  drill_down_enabled: boolean;
  real_time_updates: boolean;
  cache_duration_minutes?: number;
}

export interface ScheduledReportJob {
  id: string;
  report_id: string;
  cron_expression: string;
  next_run_at: Date;
  last_run_at?: Date;
  is_active: boolean;
  notification_emails: string[];
  created_at: Date;
  updated_at: Date;
}

export interface ReportSubscription {
  id: string;
  report_id: string;
  user_id: string;
  email: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'excel' | 'email_summary';
  is_active: boolean;
  created_at: Date;
}

export interface BulkExportRequest {
  report_ids: string[];
  format: 'pdf' | 'excel' | 'zip';
  options?: ExportOptions;
}

export interface ReportComparison {
  id: string;
  report_id: string;
  comparison_type: 'time_period' | 'segment' | 'cohort';
  config: any;
  created_at: Date;
}

export interface TimeSeriesAnalysis {
  metric: string;
  data_points: TimeSeriesPoint[];
  trend_analysis: TrendAnalysis;
  seasonality?: SeasonalityPattern;
  anomalies?: AnomalyDetection[];
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  metadata?: { [key: string]: any };
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  r_squared: number;
  projection_30_days?: number;
}

export interface SeasonalityPattern {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  strength: number;
  peak_periods: string[];
}

export interface AnomalyDetection {
  timestamp: Date;
  actual_value: number;
  expected_value: number;
  deviation_score: number;
  severity: 'low' | 'medium' | 'high';
}

export interface CohortAnalysisConfig {
  cohort_field: string; // field to group users by (e.g., 'signup_date')
  period_field: string; // field to track activity over time
  period_type: 'day' | 'week' | 'month';
  retention_metric: string;
  cohort_size_min?: number;
}

export interface CohortAnalysisResult {
  cohorts: CohortData[];
  retention_rates: { [period: string]: number };
  average_retention: number;
  cohort_trends: TrendAnalysis;
}

export interface CohortData {
  cohort_period: string;
  cohort_size: number;
  retention_by_period: { [period: string]: number };
}

export interface FunnelAnalysisConfig {
  steps: FunnelStep[];
  time_window_days: number;
  segment_by?: string;
}

export interface FunnelStep {
  name: string;
  event_type: string;
  filters?: { [key: string]: any };
}

export interface FunnelAnalysisResult {
  steps: FunnelStepResult[];
  overall_conversion_rate: number;
  drop_off_analysis: DropOffAnalysis[];
  segment_breakdown?: { [segment: string]: FunnelAnalysisResult };
}

export interface FunnelStepResult {
  step_name: string;
  total_users: number;
  conversion_rate: number;
  drop_off_rate: number;
  avg_time_to_convert?: number;
}

export interface DropOffAnalysis {
  from_step: string;
  to_step: string;
  drop_off_rate: number;
  common_characteristics: { [key: string]: any };
}

export interface SavedDrillDown {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  base_metric: string;
  filters: ReportFilters;
  created_at: Date;
}