import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';

export function useHubSpotConnections() {
  return useQuery({
    queryKey: ['hubspot-connections'],
    queryFn: async () => {
      return backend.hubspot.listConnections();
    }
  });
}

export function useHubSpotConnection(id: string) {
  return useQuery({
    queryKey: ['hubspot-connection', id],
    queryFn: async () => {
      return backend.hubspot.getConnection({ id });
    },
    enabled: !!id
  });
}

export function useCreateHubSpotConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      return backend.hubspot.createConnection(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-connections'] });
    }
  });
}

export function useUpdateHubSpotConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & any) => {
      return backend.hubspot.updateConnection({ id, ...data });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-connections'] });
      queryClient.invalidateQueries({ queryKey: ['hubspot-connection', variables.id] });
    }
  });
}

export function useDeleteHubSpotConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return backend.hubspot.deleteConnection({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hubspot-connections'] });
    }
  });
}

export function useTestHubSpotConnection() {
  return useMutation({
    mutationFn: async (id: string) => {
      return backend.hubspot.testConnection({ id });
    }
  });
}

export function useSyncHubSpotContacts() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      return backend.hubspot.syncContacts({ connectionId });
    }
  });
}

export function useSyncHubSpotDeals() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      return backend.hubspot.syncDeals({ connectionId });
    }
  });
}

export function useAutomationRules() {
  return useQuery({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      return backend.hubspot.listAutomationRules();
    }
  });
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      return backend.hubspot.createAutomationRule(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
  });
}

export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & any) => {
      return backend.hubspot.updateAutomationRule({ id, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return backend.hubspot.deleteAutomationRule({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
  });
}

export function useCreateDefaultAutomationRules() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      return backend.hubspot.createDefaultAutomationRules();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    }
  });
}

export function useExecuteAIAction() {
  return useMutation({
    mutationFn: async (data: any) => {
      return backend.hubspot.executeAIAction(data);
    }
  });
}

export function useSyncLogs(connectionId: string, limit?: number) {
  return useQuery({
    queryKey: ['sync-logs', connectionId, limit],
    queryFn: async () => {
      return backend.hubspot.getSyncLogs({ connectionId, limit });
    },
    enabled: !!connectionId
  });
}

export function useSyncStats(connectionId: string) {
  return useQuery({
    queryKey: ['sync-stats', connectionId],
    queryFn: async () => {
      return backend.hubspot.getSyncStats({ connectionId });
    },
    enabled: !!connectionId
  });
}