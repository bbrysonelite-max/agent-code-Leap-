import { SQLDatabase } from "encore.dev/storage/sqldb";

export const DB = new SQLDatabase("gdpr", {
  migrations: "./migrations",
});

export interface GDPRRequest {
  id: number;
  request_id: string;
  user_id: string;
  request_type: 'export' | 'delete' | 'rectification' | 'portability';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  submitted_by?: string;
  verification_method?: string;
  verification_status: 'pending' | 'verified' | 'failed';
  data_categories?: string[];
  export_format?: 'json' | 'csv' | 'xml';
  export_file_path?: string;
  deletion_completed_at?: Date;
  failure_reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  expires_at?: Date;
}

export interface DataMapping {
  id: number;
  service_name: string;
  table_name: string;
  column_name: string;
  data_category: string;
  data_type: string;
  is_user_identifier: boolean;
  retention_policy?: string;
  anonymization_method?: string;
  is_exportable: boolean;
  export_name?: string;
  created_at: Date;
}