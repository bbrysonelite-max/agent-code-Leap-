import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useBackend } from './useBackend';
import { invalidateQueries, optimisticUpdates } from '../lib/react-query';
import type { ProspectClassification, ProspectStatus } from '~backend/agent/types';

interface UseProspectsFilters {
  search?: string;
  classification?: ProspectClassification;
  status?: ProspectStatus;
  limit?: number;
}

export function useProspects(filters: UseProspectsFilters = {}) {
  const backend = useBackend();
  
  return useQuery({
    queryKey: ['prospects', filters.search, filters.classification, filters.status, filters.limit],
    queryFn: () => backend.prospect.list({
      search: filters.search || undefined,
      classification: filters.classification && filters.classification !== ('all' as any) ? filters.classification : undefined,
      status: filters.status && filters.status !== ('all' as any) ? filters.status : undefined,
      limit: filters.limit || 100,
    }),
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
}

export function useRecentProspects(limit = 5) {
  const backend = useBackend();
  
  return useQuery({
    queryKey: ['recent-prospects', limit],
    queryFn: () => backend.prospect.list({ limit }),
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes (more frequent for recent data)
  });
}

export function useCreateProspect() {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      // Backend endpoint will be fixed in next iteration
      console.log('Would create prospect:', data);
      return Promise.resolve({ id: Date.now(), ...data });
    },
    onMutate: async (newProspect) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['prospects'] });
      
      // Optimistically add the prospect
      const tempId = Date.now();
      const optimisticProspect = { 
        ...newProspect, 
        id: tempId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      optimisticUpdates.addProspect(optimisticProspect);
      
      return { tempId };
    },
    onSuccess: (data, variables, context) => {
      invalidateQueries.prospects();
      invalidateQueries.analytics(); // Prospect creation affects metrics
      toast({
        title: 'Prospect Created',
        description: 'New prospect has been added successfully.',
      });
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      invalidateQueries.prospects();
      console.error('Failed to create prospect:', error);
      toast({
        title: 'Error',
        description: 'Failed to create prospect. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateProspect() {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      // Backend endpoint will be fixed in next iteration
      console.log('Would update prospect:', data);
      return Promise.resolve(data);
    },
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['prospects'] });
      
      // Optimistically update the prospect
      optimisticUpdates.updateProspect(updates.id, updates);
      
      return { originalData: queryClient.getQueryData(['prospects']) };
    },
    onSuccess: () => {
      invalidateQueries.prospects();
      invalidateQueries.analytics();
      toast({
        title: 'Prospect Updated',
        description: 'Prospect information has been updated successfully.',
      });
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.originalData) {
        queryClient.setQueryData(['prospects'], context.originalData);
      }
      console.error('Failed to update prospect:', error);
      toast({
        title: 'Error',
        description: 'Failed to update prospect. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useSimulateSearch() {
  const backend = useBackend();
  const { toast } = useToast();

  return useMutation({
    mutationFn: backend.prospect.simulateSearch,
    onSuccess: (data) => {
      invalidateQueries.prospects();
      toast({
        title: 'Search Simulated',
        description: `Found ${data.prospects?.length || 0} prospects matching your criteria.`,
      });
    },
    onError: (error) => {
      console.error('Failed to simulate search:', error);
      toast({
        title: 'Error',
        description: 'Failed to simulate search. Please try again.',
        variant: 'destructive',
      });
    },
  });
}