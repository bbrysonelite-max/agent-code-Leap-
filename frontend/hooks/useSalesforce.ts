import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import { invalidateQueries } from '../lib/react-query';

export function useSalesforceConnections() {
  return useQuery({
    queryKey: ['salesforce', 'connections'],
    queryFn: () => backend.salesforce.listConnections(),
    staleTime: 5 * 60 * 1000, // Fresh for 5 minutes
  });
}

export function useFieldMappings() {
  return useQuery({
    queryKey: ['field-mappings'],
    queryFn: () => (backend.salesforce as any).getFieldMappings ? (backend.salesforce as any).getFieldMappings() : Promise.resolve([]),
    staleTime: 10 * 60 * 1000, // Field mappings don't change often
  });
}

export function useSyncLogs() {
  return useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => (backend.salesforce as any).getSyncLogs ? (backend.salesforce as any).getSyncLogs() : Promise.resolve([]),
    staleTime: 30 * 1000, // Fresh for 30 seconds (sync status changes frequently)
    refetchInterval: 30 * 1000, // Background refetch every 30 seconds
  });
}

export function useCreateConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: backend.salesforce.createConnection,
    onSuccess: () => {
      invalidateQueries.salesforce();
      toast({
        title: 'Connection Created',
        description: 'Salesforce connection has been created successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to create Salesforce connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to create Salesforce connection. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateFieldMappings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (backend.salesforce as any).updateFieldMapping || (() => Promise.resolve()),
    onSuccess: () => {
      invalidateQueries.salesforce();
      toast({
        title: 'Field Mappings Updated',
        description: 'Field mappings have been updated successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to update field mappings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update field mappings. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useSyncData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (backend.salesforce as any).syncData || (() => Promise.resolve()),
    onSuccess: () => {
      invalidateQueries.salesforce();
      invalidateQueries.prospects(); // Sync might update prospects
      toast({
        title: 'Sync Started',
        description: 'Data synchronization has been initiated.',
      });
    },
    onError: (error) => {
      console.error('Failed to sync data:', error);
      toast({
        title: 'Error',
        description: 'Failed to start data sync. Please try again.',
        variant: 'destructive',
      });
    },
  });
}