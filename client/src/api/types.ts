// OrgNode представляет собой структуру плоского узла, получаемую из API.
export interface OrgNode {
  id: string;
  name: string;
  parentId: string | null; // null для корневого узла
  headcount: number;
  budget: number;
  performance: number; // Метрика эффективности от 0 до 100
  updatedAt: string; // ISO дата-время
}

// TreeNode описывает узел иерархического дерева, собираемого на клиенте.
export interface TreeNode extends OrgNode {
  children: TreeNode[];
  isExpanded?: boolean; // Флаг интерактивного состояния раскрытия ветки
}
