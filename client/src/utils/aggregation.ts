import type { TreeNode } from '@/api/types';

// Описываем структуру агрегированных метрик для каждого подразделения
export interface AggregatedMetrics {
  id: string;
  name: string;
  parentId: string | null;
  level: number;                 // Уровень вложенности (0 для корня, 1 для дивизионов...)
  totalHeadcount: number;        // headcount узла + всех потомков
  totalBudget: number;           // budget узла + всех потомков
  averagePerformance: number;    // Взвешенная по headcount эффективность узла и потомков
}

/**
 * Рассчитывает агрегированные показатели для каждого узла орг-структуры за один проход O(N).
 * @param tree Иерархическое дерево TreeNode
 * @returns Карта агрегированных данных, где ключ — ID узла, а значение — AggregatedMetrics
 */
export function computeAllAggregates(tree: TreeNode[]): { [id: string]: AggregatedMetrics } {
  const results: { [id: string]: AggregatedMetrics } = {};

  // Рекурсивный DFS обход дерева снизу вверх
  function traverse(node: TreeNode, level: number): {
    headcountSum: number;
    budgetSum: number;
    weightedPerfSum: number;
  } {
    let headcountSum = node.headcount;
    let budgetSum = node.budget;
    
    // Взвешенное значение эффективности текущего узла
    let weightedPerfSum = node.performance * node.headcount;

    // Рекурсивно собираем данные со всех дочерних веток
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        const childMetrics = traverse(child, level + 1);
        headcountSum += childMetrics.headcountSum;
        budgetSum += childMetrics.budgetSum;
        weightedPerfSum += childMetrics.weightedPerfSum;
      });
    }

    // Вычисляем среднюю взвешенную эффективность. 
    // Если общий headcount равен 0, то используем эффективность самого узла во избежание NaN
    const averagePerformance = headcountSum > 0 
      ? Math.round(weightedPerfSum / headcountSum) 
      : node.performance;

    // Сохраняем агрегированные метрики для текущего узла
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

  // Запускаем DFS обход для каждого корневого узла дерева (уровень 0)
  tree.forEach((rootNode) => {
    traverse(rootNode, 0);
  });

  return results;
}
