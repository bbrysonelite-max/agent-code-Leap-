import { auditSecurityEvent } from "./logger";

export interface SecurityContext {
  user_id?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
}

export class SecurityLogger {
  private context: SecurityContext;
  private service_name: string;

  constructor(context: SecurityContext, serviceName: string) {
    this.context = context;
    this.service_name = serviceName;
  }

  async logAuthentication(success: boolean, method: string, failureReason?: string): Promise<void> {
    await auditSecurityEvent(
      'authentication',
      success,
      this.context.user_id,
      this.service_name,
      success ? 'INFO' : 'WARN',
      {
        method,
        ip_address: this.context.ip_address,
        user_agent: this.context.user_agent,
        session_id: this.context.session_id
      },
      failureReason
    );
  }

  async logAuthorization(success: boolean, resource: string, action: string, failureReason?: string): Promise<void> {
    await auditSecurityEvent(
      'authorization',
      success,
      this.context.user_id,
      this.service_name,
      success ? 'INFO' : 'WARN',
      {
        resource,
        action,
        ip_address: this.context.ip_address,
        session_id: this.context.session_id
      },
      failureReason
    );
  }

  async logDataAccess(resourceType: string, resourceId: string, action: string): Promise<void> {
    await auditSecurityEvent(
      'data_access',
      true,
      this.context.user_id,
      this.service_name,
      'INFO',
      {
        resource_type: resourceType,
        resource_id: resourceId,
        action,
        ip_address: this.context.ip_address
      }
    );
  }

  async logSensitiveOperation(operation: string, success: boolean, details?: Record<string, any>): Promise<void> {
    await auditSecurityEvent(
      'sensitive_operation',
      success,
      this.context.user_id,
      this.service_name,
      success ? 'INFO' : 'ERROR',
      {
        operation,
        details,
        ip_address: this.context.ip_address,
        session_id: this.context.session_id
      }
    );
  }

  async logSecurityIncident(incident: string, severity: 'WARN' | 'ERROR' | 'CRITICAL', details?: Record<string, any>): Promise<void> {
    await auditSecurityEvent(
      'security_incident',
      false,
      this.context.user_id,
      this.service_name,
      severity,
      {
        incident,
        details,
        ip_address: this.context.ip_address,
        user_agent: this.context.user_agent
      },
      incident
    );
  }

  async logPrivilegeEscalation(attemptedAction: string, currentRole: string): Promise<void> {
    await auditSecurityEvent(
      'privilege_escalation_attempt',
      false,
      this.context.user_id,
      this.service_name,
      'CRITICAL',
      {
        attempted_action: attemptedAction,
        current_role: currentRole,
        ip_address: this.context.ip_address,
        user_agent: this.context.user_agent,
        session_id: this.context.session_id
      },
      `User attempted unauthorized action: ${attemptedAction}`
    );
  }

  async logDataExfiltrationAttempt(dataType: string, volume: number): Promise<void> {
    await auditSecurityEvent(
      'data_exfiltration_attempt',
      false,
      this.context.user_id,
      this.service_name,
      'CRITICAL',
      {
        data_type: dataType,
        volume,
        ip_address: this.context.ip_address,
        user_agent: this.context.user_agent,
        timestamp: new Date().toISOString()
      },
      `Potential data exfiltration: ${dataType}, volume: ${volume}`
    );
  }

  async logRateLimitViolation(endpoint: string, limit: number, current: number): Promise<void> {
    await auditSecurityEvent(
      'rate_limit_violation',
      false,
      this.context.user_id,
      this.service_name,
      'WARN',
      {
        endpoint,
        limit,
        current,
        ip_address: this.context.ip_address,
        user_agent: this.context.user_agent
      },
      `Rate limit exceeded: ${current}/${limit} for ${endpoint}`
    );
  }
}

export function createSecurityLogger(req: any, serviceName: string): SecurityLogger {
  const context: SecurityContext = {
    user_id: req.user?.id,
    session_id: req.session?.id,
    ip_address: req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress,
    user_agent: req.headers?.['user-agent'],
    request_id: req.id || req.headers?.['x-request-id']
  };

  return new SecurityLogger(context, serviceName);
}

export function withSecurityLogging<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  serviceName: string,
  operationType: string = 'api_call'
): T {
  return (async (...args: any[]) => {
    const req = args[0];
    const securityLogger = createSecurityLogger(req, serviceName);
    
    try {
      const result = await handler(...args);
      
      if (operationType === 'authentication' || operationType === 'authorization') {
        await securityLogger.logAuthentication(true, operationType);
      }
      
      return result;
    } catch (error) {
      if (operationType === 'authentication') {
        await securityLogger.logAuthentication(false, operationType, error.message);
      } else if (operationType === 'authorization') {
        await securityLogger.logAuthorization(false, 'unknown', 'unknown', error.message);
      } else {
        await securityLogger.logSecurityIncident(
          `API error in ${serviceName}`,
          'ERROR',
          { error: (error as Error).message, operation: operationType }
        );
      }
      
      throw error;
    }
  }) as T;
}