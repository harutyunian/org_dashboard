// OrgNode represents the flat node structure received from the API.
export interface OrgNode {
  id: string;
  name: string;
  parentId: string | null; // null for the root node
  headcount: number;
  budget: number;
  performance: number; // Performance metric ranging from 0 to 100
  updatedAt: string; // ISO datetime string
}

// TreeNode represents a hierarchical tree node constructed on the client.
export interface TreeNode extends OrgNode {
  children: TreeNode[];
  isExpanded?: boolean; // Interactive state indicating whether the node branch is expanded
}
