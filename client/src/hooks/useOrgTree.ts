import { useQuery } from '@tanstack/react-query';
import { OrgService } from '@/services/OrgService';
import type { OrgNode } from '@/api/types';

/**
 * useOrgTree is a custom hook to fetch and cache flat organizational structure nodes.
 * Utilizes TanStack Query for caching and data invalidation.
 */
export function useOrgTree() {
  return useQuery<OrgNode[], Error>({
    queryKey: ['org-tree'],
    queryFn: async ({ signal }) => {
      return OrgService.getOrgTree(signal);
    },
    staleTime: 5000, // Stale time of 5 seconds as per specifications
    retry: 2,
    refetchOnWindowFocus: true,
  });
}
