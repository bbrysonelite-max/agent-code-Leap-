import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import type { 
  AuditLogFilter, 
  SecurityLogFilter
} from '~backend/audit/types';
import type { 
  CreateGDPRRequest,
  UserDataSummary 
} from '~backend/gdpr/types';

export const useCompliance = () => {
  const queryClient = useQueryClient();
  const [auditFilter, setAuditFilter] = useState<AuditLogFilter>({
    limit: 50,
    offset: 0
  });
  const [securityFilter, setSecurityFilter] = useState<SecurityLogFilter>({
    limit: 50,
    offset: 0
  });

  const auditLogsQuery = useQuery({
    queryKey: ['audit-logs', auditFilter],
    queryFn: () => backend.audit.getAuditLogs(auditFilter)
  });

  const securityLogsQuery = useQuery({
    queryKey: ['security-logs', securityFilter],
    queryFn: () => backend.audit.getSecurityLogs(securityFilter)
  });

  const auditStatsQuery = useQuery({
    queryKey: ['audit-stats'],
    queryFn: () => backend.audit.getAuditStats(),
    refetchInterval: 30000
  });

  const gdprRequestMutation = useMutation({
    mutationFn: (request: CreateGDPRRequest) => {
      if (request.request_type === 'export') {
        return backend.gdpr.requestDataExport(request);
      } else if (request.request_type === 'delete') {
        return backend.gdpr.requestDataDeletion(request);
      }
      throw new Error('Unsupported request type');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] });
    }
  });

  const updateAuditFilter = useCallback((newFilter: Partial<AuditLogFilter>) => {
    setAuditFilter(prev => ({ ...prev, ...newFilter, offset: 0 }));
  }, []);

  const updateSecurityFilter = useCallback((newFilter: Partial<SecurityLogFilter>) => {
    setSecurityFilter(prev => ({ ...prev, ...newFilter, offset: 0 }));
  }, []);

  const loadMoreAuditLogs = useCallback(() => {
    setAuditFilter(prev => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 50)
    }));
  }, []);

  const loadMoreSecurityLogs = useCallback(() => {
    setSecurityFilter(prev => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 50)
    }));
  }, []);

  return {
    auditLogs: auditLogsQuery.data?.logs || [],
    auditTotal: auditLogsQuery.data?.total || 0,
    securityLogs: securityLogsQuery.data?.logs || [],
    securityTotal: securityLogsQuery.data?.total || 0,
    auditStats: auditStatsQuery.data,
    isLoading: auditLogsQuery.isLoading || securityLogsQuery.isLoading,
    auditFilter,
    securityFilter,
    updateAuditFilter,
    updateSecurityFilter,
    loadMoreAuditLogs,
    loadMoreSecurityLogs,
    requestGDPRAction: gdprRequestMutation.mutate,
    isRequestingGDPR: gdprRequestMutation.isPending
  };
};

export const useGDPRData = (userId: string) => {
  const dataSummaryQuery = useQuery({
    queryKey: ['gdpr-data-summary', userId],
    queryFn: () => backend.gdpr.getUserDataSummary({ user_id: userId }),
    enabled: !!userId
  });

  return {
    dataSummary: dataSummaryQuery.data,
    isLoading: dataSummaryQuery.isLoading,
    refetch: dataSummaryQuery.refetch
  };
};

export const useComplianceReport = (period: string) => {
  return useQuery({
    queryKey: ['compliance-report', period],
    queryFn: () => backend.audit.getComplianceReport({ period }),
    enabled: !!period
  });
};