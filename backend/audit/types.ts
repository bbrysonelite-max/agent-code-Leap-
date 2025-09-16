export interface CreateAuditLogRequest {
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
  compliance_relevant?: boolean;
}

export interface CreateSecurityLogRequest {
  event_type: string;
  severity?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
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
}

export interface AuditLogFilter {
  user_id?: string;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  service_name?: string;
  compliance_relevant?: boolean;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

export interface SecurityLogFilter {
  event_type?: string;
  severity?: string;
  user_id?: string;
  success?: boolean;
  service_name?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  total_audit_logs: number;
  total_security_logs: number;
  recent_failed_logins: number;
  compliance_events_today: number;
  data_changes_today: number;
  top_users_by_activity: Array<{
    user_id: string;
    activity_count: number;
  }>;
  security_events_by_severity: Array<{
    severity: string;
    count: number;
  }>;
}