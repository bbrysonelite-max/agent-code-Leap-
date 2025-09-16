import { api } from "encore.dev/api";
import { DB } from "./db";
import { AuditLogFilter, SecurityLogFilter, AuditStats } from "./types";

export const getAuditLogs = api(
  { method: "POST", path: "/audit/logs", expose: true },
  async (filter: AuditLogFilter): Promise<{ logs: any[]; total: number }> => {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.user_id) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      params.push(filter.user_id);
    }
    if (filter.action) {
      whereClause += ` AND action = $${paramIndex++}`;
      params.push(filter.action);
    }
    if (filter.resource_type) {
      whereClause += ` AND resource_type = $${paramIndex++}`;
      params.push(filter.resource_type);
    }
    if (filter.resource_id) {
      whereClause += ` AND resource_id = $${paramIndex++}`;
      params.push(filter.resource_id);
    }
    if (filter.service_name) {
      whereClause += ` AND service_name = $${paramIndex++}`;
      params.push(filter.service_name);
    }
    if (filter.compliance_relevant !== undefined) {
      whereClause += ` AND compliance_relevant = $${paramIndex++}`;
      params.push(filter.compliance_relevant);
    }
    if (filter.start_date) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(filter.start_date);
    }
    if (filter.end_date) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(filter.end_date);
    }

    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
    const logsQuery = `
      SELECT * FROM audit_logs ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const [countResult, logs] = await Promise.all([
      DB.queryRow(countQuery, ...params.slice(0, -2)),
      DB.query(logsQuery, ...params)
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        old_values: log.old_values ? JSON.parse(log.old_values) : null,
        new_values: log.new_values ? JSON.parse(log.new_values) : null
      })),
      total: countResult?.total || 0
    };
  }
);

export const getSecurityLogs = api(
  { method: "POST", path: "/audit/security-logs", expose: true },
  async (filter: SecurityLogFilter): Promise<{ logs: any[]; total: number }> => {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.event_type) {
      whereClause += ` AND event_type = $${paramIndex++}`;
      params.push(filter.event_type);
    }
    if (filter.severity) {
      whereClause += ` AND severity = $${paramIndex++}`;
      params.push(filter.severity);
    }
    if (filter.user_id) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      params.push(filter.user_id);
    }
    if (filter.success !== undefined) {
      whereClause += ` AND success = $${paramIndex++}`;
      params.push(filter.success);
    }
    if (filter.service_name) {
      whereClause += ` AND service_name = $${paramIndex++}`;
      params.push(filter.service_name);
    }
    if (filter.start_date) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(filter.start_date);
    }
    if (filter.end_date) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(filter.end_date);
    }

    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    const countQuery = `SELECT COUNT(*) as total FROM security_logs ${whereClause}`;
    const logsQuery = `
      SELECT * FROM security_logs ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const [countResult, logs] = await Promise.all([
      DB.queryRow(countQuery, ...params.slice(0, -2)),
      DB.query(logsQuery, ...params)
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        metadata: log.metadata ? JSON.parse(log.metadata) : null
      })),
      total: countResult?.total || 0
    };
  }
);

export const getAuditStats = api(
  { method: "GET", path: "/audit/stats", expose: true },
  async (): Promise<AuditStats> => {
    const [
      auditCount,
      securityCount,
      failedLogins,
      complianceEvents,
      dataChanges,
      topUsers,
      securitySeverity
    ] = await Promise.all([
      DB.queryRow`SELECT COUNT(*) as count FROM audit_logs`,
      DB.queryRow`SELECT COUNT(*) as count FROM security_logs`,
      DB.queryRow`
        SELECT COUNT(*) as count FROM security_logs 
        WHERE event_type = 'login' AND success = false 
        AND created_at >= NOW() - INTERVAL '24 hours'
      `,
      DB.queryRow`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE compliance_relevant = true 
        AND created_at >= NOW() - INTERVAL '24 hours'
      `,
      DB.queryRow`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE action IN ('create', 'update', 'delete') 
        AND created_at >= NOW() - INTERVAL '24 hours'
      `,
      DB.query`
        SELECT user_id, COUNT(*) as activity_count 
        FROM audit_logs 
        WHERE user_id IS NOT NULL 
        AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY user_id 
        ORDER BY activity_count DESC 
        LIMIT 10
      `,
      DB.query`
        SELECT severity, COUNT(*) as count 
        FROM security_logs 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY severity 
        ORDER BY 
          CASE severity 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'ERROR' THEN 2 
            WHEN 'WARN' THEN 3 
            WHEN 'INFO' THEN 4 
            WHEN 'DEBUG' THEN 5 
          END
      `
    ]);

    return {
      total_audit_logs: auditCount?.count || 0,
      total_security_logs: securityCount?.count || 0,
      recent_failed_logins: failedLogins?.count || 0,
      compliance_events_today: complianceEvents?.count || 0,
      data_changes_today: dataChanges?.count || 0,
      top_users_by_activity: topUsers.map(u => ({
        user_id: u.user_id,
        activity_count: u.activity_count
      })),
      security_events_by_severity: securitySeverity.map(s => ({
        severity: s.severity,
        count: s.count
      }))
    };
  }
);

export interface ComplianceReport {
  period: string;
  generated_at: Date;
  data_access_events: any[];
  data_modification_events: any[];
  user_deletions: number;
  data_exports: number;
  security_incidents: any[];
  failed_access_attempts: any[];
}

export const getComplianceReport = api(
  { method: "GET", path: "/audit/compliance/:period", expose: true },
  async ({ period }: { period: string }): Promise<ComplianceReport> => {
    const intervals = {
      'day': '24 hours',
      'week': '7 days',
      'month': '30 days',
      'quarter': '90 days',
      'year': '365 days'
    };

    const interval = intervals[period as keyof typeof intervals] || '30 days';

    const [
      dataAccessEvents,
      dataModificationEvents,
      userDeletions,
      dataExports,
      securityIncidents,
      failedAccessAttempts
    ] = await Promise.all([
      DB.query`
        SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as count
        FROM audit_logs 
        WHERE action = 'read' AND compliance_relevant = true
        AND created_at >= NOW() - INTERVAL ${interval}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `,
      DB.query`
        SELECT action, COUNT(*) as count
        FROM audit_logs 
        WHERE action IN ('create', 'update', 'delete') 
        AND compliance_relevant = true
        AND created_at >= NOW() - INTERVAL ${interval}
        GROUP BY action
      `,
      DB.query`
        SELECT COUNT(*) as count
        FROM audit_logs 
        WHERE action = 'gdpr_deletion' 
        AND created_at >= NOW() - INTERVAL ${interval}
      `,
      DB.query`
        SELECT COUNT(*) as count
        FROM audit_logs 
        WHERE action = 'gdpr_export' 
        AND created_at >= NOW() - INTERVAL ${interval}
      `,
      DB.query`
        SELECT event_type, COUNT(*) as count
        FROM security_logs 
        WHERE severity IN ('ERROR', 'CRITICAL')
        AND created_at >= NOW() - INTERVAL ${interval}
        GROUP BY event_type
        ORDER BY count DESC
      `,
      DB.query`
        SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as count
        FROM security_logs 
        WHERE success = false
        AND created_at >= NOW() - INTERVAL ${interval}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `
    ]);

    return {
      period,
      generated_at: new Date(),
      data_access_events: dataAccessEvents,
      data_modification_events: dataModificationEvents,
      user_deletions: userDeletions[0]?.count || 0,
      data_exports: dataExports[0]?.count || 0,
      security_incidents: securityIncidents,
      failed_access_attempts: failedAccessAttempts
    };
  }
);