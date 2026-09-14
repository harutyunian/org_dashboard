import type { TreeNode } from '@/api/types';

// Structure representing the aggregated metrics for each department.
export interface AggregatedMetrics {
  id: string;
  name: string;
  parentId: string | null;
  level: number;                 // Nesting depth level (0 for root, 1 for divisions, etc.)
  totalHeadcount: number;        // Total headcount of this node and all of its descendants
  totalBudget: number;           // Total budget of this node and all of its descendants
  averagePerformance: number;    // Weighted average performance (by headcount) of this node and all of its descendants
}

/**
 * Calculates aggregated metrics for each node of the organizational structure.
 * 
 * Algorithm:
 * - Uses a post-order Depth-First Search (DFS) bottom-up traversal.
 * - This allows parent nodes to aggregate the complete sub-tree results of their children in O(N) time complexity.
 * 
 * Mathematical Formulation for Performance:
 * - Direct average performance across departments of different sizes is mathematically incorrect.
 * - Instead, we compute a weighted average based on headcount:
 *   Average Performance = Sum(Performance_i * Headcount_i) / Sum(Headcount_i)
 *   where 'i' represents the node itself and all of its descendant nodes.
 * 
 * @param tree Hierarchical tree of TreeNode objects
 * @returns Map of aggregated metrics, keyed by node ID
 */
export function computeAllAggregates(tree: TreeNode[]): { [id: string]: AggregatedMetrics } {
  const results: { [id: string]: AggregatedMetrics } = {};

  // Recursive post-order bottom-up tree traversal
  function traverse(node: TreeNode, level: number): {
    headcountSum: number;
    budgetSum: number;
    weightedPerfSum: number;
  } {
    let headcountSum = node.headcount;
    let budgetSum = node.budget;
    
    // Weighted performance of the current node
    let weightedPerfSum = node.performance * node.headcount;

    // Recursively aggregate data from all child branches
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        const childMetrics = traverse(child, level + 1);
        headcountSum += childMetrics.headcountSum;
        budgetSum += childMetrics.budgetSum;
        weightedPerfSum += childMetrics.weightedPerfSum;
      });
    }

    // Weighted average performance math:
    // If total headcount is 0, fallback to node's own performance to prevent division by zero (NaN)
    const averagePerformance = headcountSum > 0 
      ? Math.round(weightedPerfSum / headcountSum) 
      : node.performance;

    // Store computed aggregation results for the current node
    results[node.id] = {
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      level: level,
      totalHeadcount: headcountSum,
      totalBudget: budgetSum,
      averagePerformance: averagePerformance,
    };

    return {
      headcountSum,
      budgetSum,
      weightedPerfSum,
    };
  }

  // Launch traversal for each root node of the tree (starting at level 0)
  tree.forEach((rootNode) => {
    traverse(rootNode, 0);
  });

  return results;
}
