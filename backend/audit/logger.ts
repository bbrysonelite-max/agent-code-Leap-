import { api } from "encore.dev/api";
import { DB, AuditLog, SecurityLog } from "./db";
import { CreateAuditLogRequest, CreateSecurityLogRequest } from "./types";

export const logAuditEvent = api(
  { method: "POST", path: "/audit/log", expose: true },
  async (req: CreateAuditLogRequest): Promise<{ success: boolean }> => {
    try {
      await DB.exec`
        INSERT INTO audit_logs (
          user_id, session_id, action, resource_type, resource_id,
          old_values, new_values, ip_address, user_agent, service_name,
          endpoint, request_id, compliance_relevant
        ) VALUES (
          ${req.user_id}, ${req.session_id}, ${req.action}, ${req.resource_type}, ${req.resource_id},
          ${JSON.stringify(req.old_values)}, ${JSON.stringify(req.new_values)}, 
          ${req.ip_address}, ${req.user_agent}, ${req.service_name},
          ${req.endpoint}, ${req.request_id}, ${req.compliance_relevant || false}
        )
      `;
      
      return { success: true };
    } catch (error) {
      console.error("Failed to log audit event:", error);
      return { success: false };
    }
  }
);

export const logSecurityEvent = api(
  { method: "POST", path: "/audit/security", expose: true },
  async (req: CreateSecurityLogRequest): Promise<{ success: boolean }> => {
    try {
      await DB.exec`
        INSERT INTO security_logs (
          event_type, severity, user_id, session_id, ip_address,
          user_agent, success, failure_reason, metadata, service_name,
          endpoint, request_id
        ) VALUES (
          ${req.event_type}, ${req.severity || 'INFO'}, ${req.user_id}, ${req.session_id}, ${req.ip_address},
          ${req.user_agent}, ${req.success}, ${req.failure_reason}, 
          ${JSON.stringify(req.metadata)}, ${req.service_name}, ${req.endpoint}, ${req.request_id}
        )
      `;
      
      return { success: true };
    } catch (error) {
      console.error("Failed to log security event:", error);
      return { success: false };
    }
  }
);

// Helper function for other services to use
export async function auditDataChange(
  action: string,
  resourceType: string,
  resourceId: string,
  oldValues: Record<string, any> | null,
  newValues: Record<string, any> | null,
  userId?: string,
  serviceName: string = "unknown",
  complianceRelevant: boolean = false
): Promise<void> {
  try {
    await logAuditEvent({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues || undefined,
      new_values: newValues || undefined,
      service_name: serviceName,
      compliance_relevant: complianceRelevant
    });
  } catch (error) {
    console.error("Failed to audit data change:", error);
  }
}

export async function auditSecurityEvent(
  eventType: string,
  success: boolean,
  userId?: string,
  serviceName: string = "unknown",
  severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' = 'INFO',
  metadata?: Record<string, any>,
  failureReason?: string
): Promise<void> {
  try {
    await logSecurityEvent({
      event_type: eventType,
      severity,
      user_id: userId,
      success,
      failure_reason: failureReason,
      metadata,
      service_name: serviceName
    });
  } catch (error) {
    console.error("Failed to audit security event:", error);
  }
}