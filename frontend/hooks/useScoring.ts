import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import type { ProspectScore, PriorityRecommendation, ScoreAnalysisRequest, TopProspectsRequest } from '~backend/scoring/types';

export function useProspectScore(prospectId: string) {
  return useQuery({
    queryKey: ['prospect-score', prospectId],
    queryFn: async () => {
      const response = await backend.scoring.getProspectScore({ prospectId });
      return response.prospect;
    },
    enabled: !!prospectId,
  });
}

export function useTopProspects(params: TopProspectsRequest = {}) {
  return useQuery({
    queryKey: ['top-prospects', params],
    queryFn: async () => {
      const response = await backend.scoring.getTopProspects(params);
      return response.prospects;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useScoreProspect() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: ScoreAnalysisRequest) => 
      backend.scoring.scoreProspect(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prospect-score', data.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['top-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

export function useBulkScoreProspects() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (prospectIds: string[]) => {
      const response = await backend.scoring.bulkScoreProspects({ prospectIds });
      return response.scores;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['top-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}