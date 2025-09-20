import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import { useToast } from '@/components/ui/use-toast';
import type {
  Dashboard,
  Report,
  DashboardWidget,
  ReportExecution,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  CreateReportRequest,
  UpdateReportRequest,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  ExportRequest,
  DrillDownRequest
} from '~backend/reporting/types';

export function useReporting() {
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dashboards
  const {
    data: dashboards = [],
    isLoading: dashboardsLoading,
    error: dashboardsError
  } = useQuery({
    queryKey: ['dashboards'],
    queryFn: () => backend.reporting.listDashboards(),
  });

  const {
    data: widgets = [],
    isLoading: widgetsLoading,
    error: widgetsError
  } = useQuery({
    queryKey: ['widgets', currentDashboard?.id],
    queryFn: () => currentDashboard ? backend.reporting.listWidgets({ dashboardId: currentDashboard.id }) : Promise.resolve([]),
    enabled: !!currentDashboard?.id,
  });

  // Reports
  const {
    data: reports = [],
    isLoading: reportsLoading,
    error: reportsError
  } = useQuery({
    queryKey: ['reports'],
    queryFn: () => backend.reporting.listReports(),
  });

  const {
    data: scheduledReports = [],
    isLoading: scheduledReportsLoading,
    error: scheduledReportsError
  } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: () => backend.reporting.listScheduledReports(),
  });

  const {
    data: reportExecutions = [],
    isLoading: executionsLoading,
    error: executionsError
  } = useQuery({
    queryKey: ['reportExecutions'],
    queryFn: () => [],
    enabled: false, // Only fetch when explicitly called
  });

  // Mutations
  const createDashboardMutation = useMutation({
    mutationFn: (data: CreateDashboardRequest) => backend.reporting.createDashboard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast({
        title: 'Success',
        description: 'Dashboard created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create dashboard',
        variant: 'destructive',
      });
      console.error('Create dashboard error:', error);
    },
  });

  const updateDashboardMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateDashboardRequest) => 
      backend.reporting.updateDashboard({ id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast({
        title: 'Success',
        description: 'Dashboard updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update dashboard',
        variant: 'destructive',
      });
      console.error('Update dashboard error:', error);
    },
  });

  const deleteDashboardMutation = useMutation({
    mutationFn: (id: string) => backend.reporting.removeDashboard({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      if (currentDashboard?.id) {
        setCurrentDashboard(null);
      }
      toast({
        title: 'Success',
        description: 'Dashboard deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete dashboard',
        variant: 'destructive',
      });
      console.error('Delete dashboard error:', error);
    },
  });

  const createReportMutation = useMutation({
    mutationFn: (data: CreateReportRequest) => backend.reporting.createReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      toast({
        title: 'Success',
        description: 'Report created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create report',
        variant: 'destructive',
      });
      console.error('Create report error:', error);
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: (id: string) => backend.reporting.generateReport({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({
        title: 'Success',
        description: 'Report generated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      });
      console.error('Generate report error:', error);
    },
  });

  const createWidgetMutation = useMutation({
    mutationFn: (data: CreateWidgetRequest) => backend.reporting.createWidget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', currentDashboard?.id] });
      toast({
        title: 'Success',
        description: 'Widget created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create widget',
        variant: 'destructive',
      });
      console.error('Create widget error:', error);
    },
  });

  const updateWidgetMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateWidgetRequest) => 
      backend.reporting.updateWidget({ id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', currentDashboard?.id] });
      toast({
        title: 'Success',
        description: 'Widget updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update widget',
        variant: 'destructive',
      });
      console.error('Update widget error:', error);
    },
  });

  const deleteWidgetMutation = useMutation({
    mutationFn: (id: string) => backend.reporting.removeWidget({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', currentDashboard?.id] });
      toast({
        title: 'Success',
        description: 'Widget deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete widget',
        variant: 'destructive',
      });
      console.error('Delete widget error:', error);
    },
  });

  const exportReportMutation = useMutation({
    mutationFn: (data: ExportRequest) => backend.reporting.downloadReport(data),
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to export report',
        variant: 'destructive',
      });
      console.error('Export report error:', error);
    },
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => 
      backend.reporting.toggleReportSchedule({ id, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      toast({
        title: 'Success',
        description: 'Schedule updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update schedule',
        variant: 'destructive',
      });
      console.error('Toggle schedule error:', error);
    },
  });

  // Helper functions
  const loadDashboards = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboards'] });
  }, [queryClient]);

  const selectDashboard = useCallback((dashboardId: string) => {
    const dashboard = dashboards.find(d => d.id === dashboardId);
    if (dashboard) {
      setCurrentDashboard(dashboard);
    }
  }, [dashboards]);

  const loadWidgets = useCallback((dashboardId: string) => {
    queryClient.invalidateQueries({ queryKey: ['widgets', dashboardId] });
  }, [queryClient]);

  const loadScheduledReports = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
  }, [queryClient]);

  const loadReportExecutions = useCallback(async (reportId: string) => {
    try {
      const executions = await backend.reporting.getReportExecutions({ id: reportId });
      queryClient.setQueryData(['reportExecutions'], executions);
    } catch (error) {
      console.error('Failed to load report executions:', error);
      throw error;
    }
  }, [queryClient]);

  const getWidgetData = useCallback(async (widgetId: string) => {
    try {
      return await backend.reporting.getData({ id: widgetId });
    } catch (error) {
      console.error('Failed to get widget data:', error);
      throw error;
    }
  }, []);

  const drillDown = useCallback(async (request: DrillDownRequest) => {
    try {
      return await backend.reporting.drillDown(request);
    } catch (error) {
      console.error('Failed to drill down:', error);
      throw error;
    }
  }, []);

  const getMetricSummary = useCallback(async (params: {
    data_source: string;
    date_range?: any;
    filters?: any;
  }) => {
    try {
      return await backend.reporting.getMetricSummary(params);
    } catch (error) {
      console.error('Failed to get metric summary:', error);
      throw error;
    }
  }, []);

  // API functions
  const createDashboard = useCallback((data: CreateDashboardRequest) => {
    return createDashboardMutation.mutateAsync(data);
  }, [createDashboardMutation]);

  const updateDashboard = useCallback((id: string, data: UpdateDashboardRequest) => {
    return updateDashboardMutation.mutateAsync({ id, ...data });
  }, [updateDashboardMutation]);

  const deleteDashboard = useCallback((id: string) => {
    return deleteDashboardMutation.mutateAsync(id);
  }, [deleteDashboardMutation]);

  const createReport = useCallback((data: CreateReportRequest) => {
    return createReportMutation.mutateAsync(data);
  }, [createReportMutation]);

  const generateReport = useCallback((id: string) => {
    return generateReportMutation.mutateAsync(id);
  }, [generateReportMutation]);

  const createWidget = useCallback((data: CreateWidgetRequest) => {
    return createWidgetMutation.mutateAsync(data);
  }, [createWidgetMutation]);

  const updateWidget = useCallback((id: string, data: UpdateWidgetRequest) => {
    return updateWidgetMutation.mutateAsync({ id, ...data });
  }, [updateWidgetMutation]);

  const deleteWidget = useCallback((id: string) => {
    return deleteWidgetMutation.mutateAsync(id);
  }, [deleteWidgetMutation]);

  const exportReport = useCallback((data: ExportRequest) => {
    return exportReportMutation.mutateAsync(data);
  }, [exportReportMutation]);

  const toggleReportSchedule = useCallback((id: string, enabled: boolean) => {
    return toggleScheduleMutation.mutateAsync({ id, enabled });
  }, [toggleScheduleMutation]);

  const loading = dashboardsLoading || reportsLoading || scheduledReportsLoading;
  const error = dashboardsError || reportsError || scheduledReportsError;

  return {
    // Data
    dashboards,
    currentDashboard,
    widgets,
    reports,
    scheduledReports,
    reportExecutions,
    
    // Loading states
    loading,
    dashboardsLoading,
    widgetsLoading,
    reportsLoading,
    scheduledReportsLoading,
    executionsLoading,
    
    // Errors
    error,
    dashboardsError,
    widgetsError,
    reportsError,
    scheduledReportsError,
    executionsError,
    
    // Actions
    loadDashboards,
    selectDashboard,
    loadWidgets,
    loadScheduledReports,
    loadReportExecutions,
    
    // CRUD operations
    createDashboard,
    updateDashboard,
    deleteDashboard,
    createReport,
    generateReport,
    createWidget,
    updateWidget,
    deleteWidget,
    exportReport,
    toggleReportSchedule,
    
    // Data fetching
    getWidgetData,
    drillDown,
    getMetricSummary,
    
    // Mutation states
    isCreatingDashboard: createDashboardMutation.isPending,
    isUpdatingDashboard: updateDashboardMutation.isPending,
    isDeletingDashboard: deleteDashboardMutation.isPending,
    isCreatingReport: createReportMutation.isPending,
    isGeneratingReport: generateReportMutation.isPending,
    isCreatingWidget: createWidgetMutation.isPending,
    isUpdatingWidget: updateWidgetMutation.isPending,
    isDeletingWidget: deleteWidgetMutation.isPending,
    isExportingReport: exportReportMutation.isPending,
    isTogglingSchedule: toggleScheduleMutation.isPending,
  };
}