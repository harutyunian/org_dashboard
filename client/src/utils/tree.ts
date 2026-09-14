import type { OrgNode, TreeNode } from '@/api/types';

/**
 * Returns a default set of node IDs that should be expanded on initial load:
 * Root (parentId === null) and its immediate children (parentId === 'root').
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
 * Builds a hierarchical tree structure from a flat array of nodes in O(N) time complexity.
 * Branch expansion state is determined by the provided Set of expanded IDs.
 */
export function buildTree(flatNodes: OrgNode[], expandedIds: Set<string>): TreeNode[] {
  const map: { [id: string]: TreeNode } = {};
  const roots: TreeNode[] = [];

  // Initialize lookup map
  flatNodes.forEach((node) => {
    map[node.id] = {
      ...node,
      children: [],
      isExpanded: expandedIds.has(node.id),
    };
  });

  // Build tree relationships
  flatNodes.forEach((node) => {
    const currentTreeNode = map[node.id];
    if (node.parentId !== null) {
      const parent = map[node.parentId];
      if (parent) {
        parent.children.push(currentTreeNode);
      } else {
        roots.push(currentTreeNode); // Fallback to root if parent is not found
      }
    } else {
      roots.push(currentTreeNode); // Nodes without a parentId are treated as tree roots
    }
  });

  return roots;
}

/**
 * Returns an array of ancestor IDs for a given node.
 * Used to auto-expand parent branches when selecting nodes from the table.
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
