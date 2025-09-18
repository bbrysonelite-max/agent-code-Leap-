import { useQuery } from '@tanstack/react-query';
import backend from '~backend/client';
import type { ClientConfiguration } from '~backend/client/types';

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await backend.client.list({});
      return response.clients;
    },
  });
}