import { useMemo } from 'react';
import type { OrgNode } from '@/api/types';
import { buildTree } from '@/utils/tree';
import { computeAllAggregates } from '@/utils/aggregation';
import type { AggregatedMetrics } from '@/utils/aggregation';

/**
 * useAggregatedData — кастомный хук для мемоизированного расчета
 * суммарных показателей орг-структуры компании.
 */
export function useAggregatedData(flatNodes: OrgNode[] | undefined): { [id: string]: AggregatedMetrics } {
  return useMemo(() => {
    if (!flatNodes || flatNodes.length === 0) return {};

    // Для расчета агрегатов строим дерево.
    // Нам не важно состояние раскрытия веток UI для математических расчетов,
    // поэтому передаем пустой Set.
    const dummyExpanded = new Set<string>();
    const fullTree = buildTree(flatNodes, dummyExpanded);

    // Рассчитываем и возвращаем карту агрегатов O(N)
    return computeAllAggregates(fullTree);
  }, [flatNodes]);
}
export type { AggregatedMetrics };
