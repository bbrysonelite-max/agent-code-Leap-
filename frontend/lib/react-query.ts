import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Create persister for offline support
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'nuscan-query-cache',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

// Global error handler for queries
const queryCache = new QueryCache({
  onError: (error, query) => {
    console.error('Query error:', error, 'Query key:', query.queryKey);
    // Only show error toasts for background refetches that the user didn't initiate
    if (query.state.fetchStatus === 'idle') {
      // Error happened during background refetch
      // We could show a subtle notification here if needed
    }
  },
});

// Global error handler for mutations
const mutationCache = new MutationCache({
  onError: (error, variables, context, mutation) => {
    console.error('Mutation error:', error, 'Variables:', variables);
  },
});

// Create optimized QueryClient
export const queryClient: any = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      // Cache data for 10 minutes
      staleTime: 10 * 60 * 1000,
      // Keep in cache for 15 minutes
      gcTime: 15 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Background refetching
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Network error handling
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry mutations once on network errors
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      retryDelay: 1000,
      networkMode: 'offlineFirst',
    },
  },
});

// Configure persistence
persistQueryClient({
  queryClient,
  persister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  buster: 'nuscan-v1', // Change this to clear cache on app updates
});

// Cache invalidation helpers
export const invalidateQueries = {
  // Invalidate all prospect-related queries
  prospects: () => {
    queryClient.invalidateQueries({ queryKey: ['prospects'] });
    queryClient.invalidateQueries({ queryKey: ['recent-prospects'] });
    queryClient.invalidateQueries({ queryKey: ['prospects-all'] });
  },
  
  // Invalidate all agent-related queries
  agents: () => {
    queryClient.invalidateQueries({ queryKey: ['agents'] });
  },
  
  // Invalidate all email-related queries
  emails: () => {
    queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  },
  
  // Invalidate all analytics-related queries
  analytics: () => {
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
  },
  
  // Invalidate all Salesforce-related queries
  salesforce: () => {
    queryClient.invalidateQueries({ queryKey: ['salesforce'] });
    queryClient.invalidateQueries({ queryKey: ['field-mappings'] });
    queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
  },
  
  // Invalidate all data (useful for logout or major updates)
  all: () => {
    queryClient.clear();
  },
};

// Optimistic update helpers
export const optimisticUpdates = {
  // Update prospect in cache immediately
  updateProspect: (prospectId: number, updates: any) => {
    queryClient.setQueryData(['prospects'], (old: any) => {
      if (!old) return old;
      const prospects = old.prospects || old.data || [];
      return {
        ...old,
        prospects: prospects.map((p: any) => 
          p.id === prospectId ? { ...p, ...updates } : p
        ),
      };
    });
  },
  
  // Add new prospect to cache immediately
  addProspect: (newProspect: any) => {
    queryClient.setQueryData(['prospects'], (old: any) => {
      if (!old) return { prospects: [newProspect], total: 1 };
      const prospects = old.prospects || old.data || [];
      return {
        ...old,
        prospects: [newProspect, ...prospects],
        total: (old.total || 0) + 1,
      };
    });
  },
  
  // Update agent status in cache immediately
  updateAgentStatus: (agentId: string, status: string) => {
    queryClient.setQueryData(['agents'], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        agents: old.agents.map((agent: any) =>
          agent.id === agentId ? { ...agent, status } : agent
        ),
      };
    });
  },
};

// Prefetch helpers for better UX
export const prefetchQueries = {
  // Prefetch prospects when user hovers over prospects nav
  prospects: () => {
    queryClient.prefetchQuery({
      queryKey: ['prospects'],
      queryFn: () => import('~backend/client').then(m => m.default.prospect.list({})),
      staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    });
  },
  
  // Prefetch agents for dashboard
  agents: () => {
    queryClient.prefetchQuery({
      queryKey: ['agents'],
      queryFn: () => import('~backend/client').then(m => m.default.agent.list()),
      staleTime: 5 * 60 * 1000,
    });
  },
  
  // Prefetch analytics for dashboard
  analytics: () => {
    queryClient.prefetchQuery({
      queryKey: ['metrics'],
      queryFn: () => import('~backend/client').then(m => m.default.analytics.getMetrics({})),
      staleTime: 30 * 1000, // Analytics change frequently
    });
  },
};

// Network status utilities
export const networkUtils = {
  // Check if we're online
  isOnline: () => navigator.onLine,
  
  // Get failed queries that can be retried when online
  getFailedQueries: () => {
    return queryClient.getQueryCache().getAll().filter(
      (query: any) => query.state.status === 'error' && query.state.fetchStatus === 'idle'
    );
  },
  
  // Retry all failed queries (useful when coming back online)
  retryFailedQueries: () => {
    queryClient.getQueryCache().getAll().forEach((query: any) => {
      if (query.state.status === 'error') {
        query.fetch();
      }
    });
  },
};

// Listen for online/offline events
window.addEventListener('online', () => {
  networkUtils.retryFailedQueries();
});

window.addEventListener('offline', () => {
  console.log('App is now offline');
});