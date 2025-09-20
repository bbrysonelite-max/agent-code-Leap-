import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

export interface RateLimitRule {
  id?: number;
  endpoint: string;
  method: string;
  tier: string;
  windowSeconds: number;
  maxRequests: number;
  burstLimit: number;
  enabled: boolean;
}

export interface UserQuotaConfig {
  id?: number;
  userId: string;
  tier: string;
  dailyQuota: number;
  monthlyQuota: number;
}

export function useRateLimit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all rate limit rules
  const {
    data: rules,
    isLoading: rulesLoading,
    error: rulesError
  } = useQuery({
    queryKey: ['rateLimitRules'],
    queryFn: () => backend.rate_limiting.getRules(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get user quotas
  const {
    data: quotas,
    isLoading: quotasLoading,
    error: quotasError
  } = useQuery({
    queryKey: ['userQuotas'],
    queryFn: () => backend.rate_limiting.getUserQuotas(),
    staleTime: 5 * 60 * 1000,
  });

  // Create rate limit rule
  const createRuleMutation = useMutation({
    mutationFn: (rule: Omit<RateLimitRule, 'id'>) => 
      backend.rate_limiting.createRule(rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateLimitRules'] });
      toast({
        title: 'Rule created',
        description: 'Rate limit rule has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating rule',
        description: error.message || 'Failed to create rate limit rule.',
        variant: 'destructive',
      });
    },
  });

  // Update rate limit rule
  const updateRuleMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number } & Partial<RateLimitRule>) =>
      backend.rate_limiting.updateRule({ id, ...updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateLimitRules'] });
      toast({
        title: 'Rule updated',
        description: 'Rate limit rule has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating rule',
        description: error.message || 'Failed to update rate limit rule.',
        variant: 'destructive',
      });
    },
  });

  // Delete rate limit rule
  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => backend.rate_limiting.deleteRule({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateLimitRules'] });
      toast({
        title: 'Rule deleted',
        description: 'Rate limit rule has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting rule',
        description: error.message || 'Failed to delete rate limit rule.',
        variant: 'destructive',
      });
    },
  });

  // Create user quota
  const createQuotaMutation = useMutation({
    mutationFn: (quota: Omit<UserQuotaConfig, 'id'>) =>
      backend.rate_limiting.createUserQuota(quota),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuotas'] });
      toast({
        title: 'Quota created',
        description: 'User quota has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating quota',
        description: error.message || 'Failed to create user quota.',
        variant: 'destructive',
      });
    },
  });

  // Update user quota
  const updateQuotaMutation = useMutation({
    mutationFn: ({ userId, ...updates }: { userId: string } & Partial<UserQuotaConfig>) =>
      backend.rate_limiting.updateUserQuota({ userId, ...updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuotas'] });
      toast({
        title: 'Quota updated',
        description: 'User quota has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating quota',
        description: error.message || 'Failed to update user quota.',
        variant: 'destructive',
      });
    },
  });

  // Delete user quota
  const deleteQuotaMutation = useMutation({
    mutationFn: (userId: string) => backend.rate_limiting.deleteUserQuota({ userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userQuotas'] });
      toast({
        title: 'Quota deleted',
        description: 'User quota has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting quota',
        description: error.message || 'Failed to delete user quota.',
        variant: 'destructive',
      });
    },
  });

  // Bulk update quotas by tier
  const bulkUpdateQuotasMutation = useMutation({
    mutationFn: ({ tier, dailyQuota, monthlyQuota }: {
      tier: string;
      dailyQuota?: number;
      monthlyQuota?: number;
    }) => backend.rate_limiting.bulkUpdateQuotasByTier({ tier, dailyQuota, monthlyQuota }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userQuotas'] });
      toast({
        title: 'Quotas updated',
        description: `Updated ${data.updated} user quotas successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating quotas',
        description: error.message || 'Failed to update user quotas.',
        variant: 'destructive',
      });
    },
  });

  return {
    // Data
    rules,
    quotas,
    
    // Loading states
    rulesLoading,
    quotasLoading,
    
    // Errors
    rulesError,
    quotasError,
    
    // Rule mutations
    createRule: createRuleMutation.mutate,
    updateRule: updateRuleMutation.mutate,
    deleteRule: deleteRuleMutation.mutate,
    isCreatingRule: createRuleMutation.isPending,
    isUpdatingRule: updateRuleMutation.isPending,
    isDeletingRule: deleteRuleMutation.isPending,
    
    // Quota mutations
    createQuota: createQuotaMutation.mutate,
    updateQuota: updateQuotaMutation.mutate,
    deleteQuota: deleteQuotaMutation.mutate,
    bulkUpdateQuotas: bulkUpdateQuotasMutation.mutate,
    isCreatingQuota: createQuotaMutation.isPending,
    isUpdatingQuota: updateQuotaMutation.isPending,
    isDeletingQuota: deleteQuotaMutation.isPending,
    isBulkUpdating: bulkUpdateQuotasMutation.isPending,
    
    // Utilities
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: ['rateLimitRules'] });
      queryClient.invalidateQueries({ queryKey: ['userQuotas'] });
    },
  };
}

export function useRateLimitAnalytics() {
  const { toast } = useToast();

  // Get analytics data
  const getAnalytics = (params: {
    startDate: string;
    endDate: string;
    endpoint?: string;
    tier?: string;
  }) => {
    return useQuery({
      queryKey: ['rateLimitAnalytics', params],
      queryFn: () => backend.rate_limiting.getAnalytics(params),
      staleTime: 30 * 1000, // 30 seconds
    });
  };

  // Get real-time usage
  const {
    data: realTimeUsage,
    isLoading: realTimeLoading
  } = useQuery({
    queryKey: ['realTimeUsage'],
    queryFn: () => backend.rate_limiting.getRealTimeUsage({ timeWindowMinutes: 5 }),
    refetchInterval: 10 * 1000, // 10 seconds
    staleTime: 5 * 1000, // 5 seconds
  });

  // Get quota usage
  const getQuotaUsage = (userId?: string) => {
    return useQuery({
      queryKey: ['quotaUsage', userId],
      queryFn: () => backend.rate_limiting.getUserQuotaUsage({ userId }),
      refetchInterval: 60 * 1000, // 1 minute
      staleTime: 30 * 1000, // 30 seconds
    });
  };

  // Get health score
  const {
    data: healthScore,
    isLoading: healthLoading
  } = useQuery({
    queryKey: ['healthScore'],
    queryFn: () => backend.rate_limiting.getHealthScore(),
    refetchInterval: 60 * 1000, // 1 minute
    staleTime: 30 * 1000, // 30 seconds
  });

  // Get top violators
  const {
    data: topViolators,
    isLoading: violatorsLoading
  } = useQuery({
    queryKey: ['topViolators'],
    queryFn: () => backend.rate_limiting.getTopViolators({ limit: 10 }),
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Check alerts
  const {
    data: alerts,
    isLoading: alertsLoading
  } = useQuery({
    queryKey: ['rateLimitAlerts'],
    queryFn: () => backend.rate_limiting.checkAlerts(),
    refetchInterval: 30 * 1000, // 30 seconds
    staleTime: 15 * 1000, // 15 seconds
  });

  // Generate analytics manually
  const generateAnalyticsMutation = useMutation({
    mutationFn: (date?: string) => backend.rate_limiting.generateAnalytics({ date }),
    onSuccess: () => {
      toast({
        title: 'Analytics generated',
        description: 'Analytics have been generated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error generating analytics',
        description: error.message || 'Failed to generate analytics.',
        variant: 'destructive',
      });
    },
  });

  return {
    // Data queries
    getAnalytics,
    getQuotaUsage,
    
    // Real-time data
    realTimeUsage,
    realTimeLoading,
    
    // Health monitoring
    healthScore,
    healthLoading,
    
    // Violations
    topViolators,
    violatorsLoading,
    
    // Alerts
    alerts,
    alertsLoading,
    
    // Actions
    generateAnalytics: generateAnalyticsMutation.mutate,
    isGeneratingAnalytics: generateAnalyticsMutation.isPending,
  };
}

export function useRateLimitConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get rules for specific endpoint
  const getRulesByEndpoint = (endpoint: string) => {
    return useQuery({
      queryKey: ['rateLimitRules', endpoint],
      queryFn: () => backend.rate_limiting.getRulesByEndpoint({ endpoint }),
      enabled: !!endpoint,
      staleTime: 5 * 60 * 1000,
    });
  };

  // Get quota for specific user
  const getUserQuota = (userId: string) => {
    return useQuery({
      queryKey: ['userQuota', userId],
      queryFn: () => backend.rate_limiting.getUserQuota({ userId }),
      enabled: !!userId,
      staleTime: 5 * 60 * 1000,
    });
  };

  // Get identifier statistics
  const getIdentifierStats = (identifier: string, endpoint?: string) => {
    return useQuery({
      queryKey: ['identifierStats', identifier, endpoint],
      queryFn: () => backend.rate_limiting.getIdentifierStats({ identifier, endpoint }),
      enabled: !!identifier,
      refetchInterval: 30 * 1000,
      staleTime: 15 * 1000,
    });
  };

  return {
    getRulesByEndpoint,
    getUserQuota,
    getIdentifierStats,
    
    // Utilities
    refresh: (keys?: string[]) => {
      if (keys) {
        keys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      } else {
        queryClient.invalidateQueries();
      }
    },
  };
}