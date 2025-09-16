import { useQuery } from '@tanstack/react-query';
import { useBackend } from './useBackend';

export function useMetrics() {
  const backend = useBackend();
  
  return useQuery({
    queryKey: ['metrics'],
    queryFn: () => backend.analytics.getMetrics({}),
    staleTime: 30 * 1000, // Fresh for 30 seconds (metrics change frequently)
    refetchInterval: 60 * 1000, // Background refetch every minute
  });
}