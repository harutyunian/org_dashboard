import type { OrgNode, TreeNode } from '@/api/types';

/**
 * Возвращает дефолтный набор ID узлов, которые должны быть раскрыты при первой загрузке:
 * Корень (parentId == null) и его прямые дочерние элементы — Дивизионы (parentId == 'root').
 */
export function getDefaultExpandedIds(flatNodes: OrgNode[]): Set<string> {
  const expanded = new Set<string>();
  flatNodes.forEach((node) => {
    if (node.parentId === null || node.parentId === 'root') {
      expanded.add(node.id);
    }
  });
  return expanded;
}

/**
 * Строит иерархическое дерево TreeNode из плоского массива OrgNode за O(N) времени.
 * Состояние раскрытия веток (isExpanded) определяется на основе переданного Set.
 */
export function buildTree(flatNodes: OrgNode[], expandedIds: Set<string>): TreeNode[] {
  const map: { [id: string]: TreeNode } = {};
  const roots: TreeNode[] = [];

  // Шаг 1: Инициализируем каждый узел
  flatNodes.forEach((node) => {
    map[node.id] = {
      ...node,
      children: [],
      isExpanded: expandedIds.has(node.id),
    };
  });

  // Шаг 2: Связываем родительские и дочерние элементы
  flatNodes.forEach((node) => {
    const currentTreeNode = map[node.id];
    if (node.parentId !== null) {
      const parent = map[node.parentId];
      if (parent) {
        parent.children.push(currentTreeNode);
      } else {
        roots.push(currentTreeNode); // Относим к корню, если родитель пропал
      }
    } else {
      roots.push(currentTreeNode); // Узел без parentId — корень дерева
    }
  });

  return roots;
}

/**
 * Возвращает массив ID всех предков (родителей вверх по цепочке) для конкретного узла.
 * Используется для автоматического раскрытия веток дерева при выделении из таблицы.
 */
export function getAncestors(flatNodes: OrgNode[], nodeId: string): string[] {
  const ancestors: string[] = [];
  let currentId: string | null = nodeId;

  while (currentId !== null) {
    const currentNode = flatNodes.find((n) => n.id === currentId);
    if (currentNode && currentNode.parentId !== null) {
      ancestors.push(currentNode.parentId);
      currentId = currentNode.parentId;
    } else {
      break;
    }
  }

  return ancestors;
}
