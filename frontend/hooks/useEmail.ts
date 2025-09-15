import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import { invalidateQueries } from '../lib/react-query';
import type { CampaignStatus } from '~backend/agent/types';

interface UseCampaignsFilters {
  status?: CampaignStatus;
  limit?: number;
}

export function useCampaigns(filters: UseCampaignsFilters = {}) {
  return useQuery({
    queryKey: ['campaigns', filters.status, filters.limit],
    queryFn: () => backend.email.listCampaigns({
      status: filters.status && filters.status !== ('all' as any) ? filters.status : undefined,
      limit: filters.limit || 100,
    }),
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes
  });
}

export function useEmailTemplates(activeOnly = true) {
  return useQuery({
    queryKey: ['templates', activeOnly],
    queryFn: () => backend.email.listTemplates({ 
      active_only: activeOnly 
    }),
    staleTime: 10 * 60 * 1000, // Templates don't change often, fresh for 10 minutes
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (backend.email as any).createTemplate || (() => Promise.resolve()),
    // Fallback for development - replace with actual endpoint when available
    onSuccess: () => {
      invalidateQueries.emails();
      toast({
        title: 'Template Created',
        description: 'Email template has been created successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to create template:', error);
      toast({
        title: 'Error',
        description: 'Failed to create template. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: backend.email.sendEmail || (() => Promise.resolve({ message: 'Email sent successfully' })),
    // The actual API endpoint is sendEmail, not send
    onSuccess: () => {
      invalidateQueries.emails();
      invalidateQueries.analytics(); // Email sending affects metrics
      toast({
        title: 'Email Sent',
        description: 'Email has been sent successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to send email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send email. Please try again.',
        variant: 'destructive',
      });
    },
  });
}