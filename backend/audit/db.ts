import { SQLDatabase } from "encore.dev/storage/sqldb";

export const DB = new SQLDatabase("audit", {
  migrations: "./migrations",
});

export interface AuditLog {
  id: number;
  user_id?: string;
  session_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  service_name: string;
  endpoint?: string;
  request_id?: string;
  compliance_relevant: boolean;
  created_at: Date;
}

export interface SecurityLog {
  id: number;
  event_type: string;
  severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  user_id?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  success?: boolean;
  failure_reason?: string;
  metadata?: Record<string, any>;
  service_name: string;
  endpoint?: string;
  request_id?: string;
  created_at: Date;
}

export interface DataRetentionPolicy {
  id: number;
  resource_type: string;
  retention_days: number;
  auto_delete: boolean;
  compliance_requirement?: string;
  created_at: Date;
  updated_at: Date;
}