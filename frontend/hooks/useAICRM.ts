import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import type { 
  Lead, 
  Contact, 
  Deal, 
  Activity, 
  CreateLeadRequest,
  CreateContactRequest,
  CreateDealRequest,
  CreateActivityRequest,
  NextBestAction,
  AIInsight,
  ConversationAnalysis,
  PipelineAnalytics
} from '~backend/ai_crm/types';

export function useLeads(filters?: {
  status?: string;
  priority?: string;
  assigned_to?: string;
  min_score?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['ai-crm', 'leads', filters],
    queryFn: () => backend.ai_crm.listLeads(filters || {})
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['ai-crm', 'leads', id],
    queryFn: () => backend.ai_crm.getLead({ id }),
    enabled: !!id
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateLeadRequest) => backend.ai_crm.createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'leads'] });
    }
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<CreateLeadRequest>) => 
      backend.ai_crm.updateLead({ id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'leads', id] });
    }
  });
}

export function useContacts(filters?: {
  type?: string;
  company?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['ai-crm', 'contacts', filters],
    queryFn: () => backend.ai_crm.listContacts(filters || {})
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ['ai-crm', 'contacts', id],
    queryFn: () => backend.ai_crm.getContact({ id }),
    enabled: !!id
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateContactRequest) => backend.ai_crm.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'contacts'] });
    }
  });
}

export function useDeals(filters?: {
  stage?: string;
  assigned_to?: string;
  min_value?: number;
  max_value?: number;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['ai-crm', 'deals', filters],
    queryFn: () => backend.ai_crm.listDeals(filters || {})
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['ai-crm', 'deals', id],
    queryFn: () => backend.ai_crm.getDeal({ id }),
    enabled: !!id
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateDealRequest) => backend.ai_crm.createDeal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'deals'] });
    }
  });
}

export function useUpdateDeal(id: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<CreateDealRequest>) => 
      backend.ai_crm.updateDeal({ id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'deals'] });
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'deals', id] });
    }
  });
}

export function useActivities(filters?: {
  contact_id?: string;
  deal_id?: string;
  lead_id?: string;
  type?: string;
  sentiment?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['ai-crm', 'activities', filters],
    queryFn: () => backend.ai_crm.listActivities(filters || {})
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateActivityRequest) => backend.ai_crm.createActivity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'activities'] });
    }
  });
}

export function useAIInsights(filters?: {
  entity_type?: 'lead' | 'contact' | 'deal' | 'activity';
  entity_id?: string;
  insight_type?: string;
  limit?: number;
  only_actionable?: boolean;
}) {
  return useQuery({
    queryKey: ['ai-crm', 'insights', filters],
    queryFn: () => backend.ai_crm.getAIInsights(filters || {})
  });
}

export function useDashboardInsights() {
  return useQuery({
    queryKey: ['ai-crm', 'insights', 'dashboard'],
    queryFn: () => backend.ai_crm.getDashboardInsights({})
  });
}

export function useMarkInsightActedUpon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => backend.ai_crm.markInsightActedUpon({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'insights'] });
    }
  });
}

export function useScoreLead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => backend.ai_crm.scoreLeadWithAI({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'leads'] });
    }
  });
}

export function useGenerateRecommendations() {
  return useMutation({
    mutationFn: ({ entity_type, entity_id }: { 
      entity_type: 'lead' | 'contact' | 'deal'; 
      entity_id: string; 
    }) => backend.ai_crm.generateRecommendations({ entity_type, entity_id })
  });
}

export function useAnalyzeConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { activity_id: string; transcript?: string; context?: string }) =>
      backend.ai_crm.analyzeConversation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-crm', 'activities'] });
    }
  });
}

export function usePipelineAnalytics() {
  return useQuery({
    queryKey: ['ai-crm', 'analytics', 'pipeline'],
    queryFn: () => backend.ai_crm.getPipelineAnalytics()
  });
}

export function useActivityAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['ai-crm', 'analytics', 'activities', days],
    queryFn: () => backend.ai_crm.getActivityAnalytics({ days })
  });
}

export function useTopPerformers(limit: number = 10) {
  return useQuery({
    queryKey: ['ai-crm', 'analytics', 'top-performers', limit],
    queryFn: () => backend.ai_crm.getTopPerformers({ limit })
  });
}

export function useTopScoredLeads(minScore: number = 70, limit: number = 20) {
  return useQuery({
    queryKey: ['ai-crm', 'leads', 'top-scored', minScore, limit],
    queryFn: () => backend.ai_crm.getTopScoredLeads({ minScore, limit })
  });
}

export function useDealsPipeline() {
  return useQuery({
    queryKey: ['ai-crm', 'deals', 'pipeline'],
    queryFn: () => backend.ai_crm.getDealsPipeline()
  });
}

export function useDealsAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['ai-crm', 'deals', 'analytics', days],
    queryFn: () => backend.ai_crm.getDealsAnalytics({ days })
  });
}

export function useUpcomingActivities(days: number = 7, limit: number = 20) {
  return useQuery({
    queryKey: ['ai-crm', 'activities', 'upcoming', days, limit],
    queryFn: () => backend.ai_crm.getUpcomingActivities({ days, limit })
  });
}

export function useOverdueActivities(limit: number = 20) {
  return useQuery({
    queryKey: ['ai-crm', 'activities', 'overdue', limit],
    queryFn: () => backend.ai_crm.getOverdueActivities({ limit })
  });
}