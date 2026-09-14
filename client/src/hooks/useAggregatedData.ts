import { useMemo } from 'react';
import type { OrgNode } from '@/api/types';
import { buildTree } from '@/utils/tree';
import { computeAllAggregates } from '@/utils/aggregation';
import type { AggregatedMetrics } from '@/utils/aggregation';

/**
 * Custom hook for memoized computation of aggregated organizational metrics.
 */
export function useAggregatedData(flatNodes: OrgNode[] | undefined): { [id: string]: AggregatedMetrics } {
  return useMemo(() => {
    if (!flatNodes || flatNodes.length === 0) return {};

    // Build tree structure to compute hierarchical aggregations.
    // UI expansion state does not affect mathematical computations, so pass an empty Set.
    const dummyExpanded = new Set<string>();
    const fullTree = buildTree(flatNodes, dummyExpanded);

    // Calculate and return the aggregation map in O(N) time complexity.
    return computeAllAggregates(fullTree);
  }, [flatNodes]);
}
export type { AggregatedMetrics };
