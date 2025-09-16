import { SQLDatabase } from "encore.dev/storage/sqldb";

export const db = new SQLDatabase("reporting", {
  migrations: "./migrations",
});

export interface Dashboard {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  layout: any[];
  is_default: boolean;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
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
  is_scheduled: boolean;
  last_generated_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ReportExecution {
  id: string;
  report_id: string;
  status: ExecutionStatus;
  format: ExportFormat;
  file_path?: string;
  file_size?: number;
  error_message?: string;
  execution_time_ms?: number;
  created_at: Date;
  completed_at?: Date;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: WidgetType;
  title: string;
  config: any;
  data_source: DataSource;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  created_at: Date;
  updated_at: Date;
}

export type ReportType = 'prospects' | 'campaigns' | 'agents' | 'deals' | 'activities';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ExportFormat = 'json' | 'pdf' | 'excel';
export type WidgetType = 'chart' | 'table' | 'metric' | 'timeline';
export type DataSource = 'prospects' | 'campaigns' | 'agents' | 'deals' | 'activities';