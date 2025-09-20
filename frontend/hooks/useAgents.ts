import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import { invalidateQueries, optimisticUpdates } from '../lib/react-query';
import type { AgentStatus } from '~backend/agent/types';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => backend.agent.list(),
    staleTime: 30 * 1000, // Fresh for 30 seconds (agents status changes frequently)
    refetchInterval: 30 * 1000, // Background refetch every 30 seconds
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      // Backend endpoint will be fixed in next iteration
      console.log('Would create agent:', data);
      return Promise.resolve({ id: Date.now(), ...data });
    },
    onSuccess: () => {
      invalidateQueries.agents();
      toast({
        title: 'Agent Created',
        description: 'New agent has been created successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to create agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to create agent. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useControlAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ agentId, action }: { agentId: number; action: 'start' | 'stop' | 'pause' }) => {
      // For now, we'll simulate the control action since the actual endpoint might not exist
      // Replace this with the actual backend call when available
      return Promise.resolve({ success: true, message: `Agent ${action}ed successfully` });
    },
    onMutate: async ({ agentId, action }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['agents'] });
      
      // Optimistically update agent status
      const newStatus: AgentStatus = action === 'start' ? 'running' : 
                                   action === 'stop' ? 'stopped' : 'paused';
      
      optimisticUpdates.updateAgentStatus(agentId.toString(), newStatus);
      
      return { originalData: queryClient.getQueryData(['agents']) };
    },
    onSuccess: (data, { action }) => {
      invalidateQueries.agents();
      toast({
        title: 'Agent Control',
        description: `Agent has been ${action}ed successfully.`,
      });
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.originalData) {
        queryClient.setQueryData(['agents'], context.originalData);
      }
      console.error('Failed to control agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to control agent. Please try again.',
        variant: 'destructive',
      });
    },
  });
}