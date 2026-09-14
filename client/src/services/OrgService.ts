import { apiClient } from '@/api/client';
import type { OrgNode } from '@/api/types';

/**
 * Validates the API response structure to ensure runtime safety.
 * Throws an error if any invalid data is detected.
 */
function validateOrgNodes(data: unknown): OrgNode[] {
  if (!Array.isArray(data)) {
    throw new Error('API response is not an array');
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item at index ${i} is not an object`);
    }

    const node = item as Record<string, unknown>;

    if (typeof node.id !== 'string' || !node.id) {
      throw new Error(`Item at index ${i} has an invalid or missing "id"`);
    }
    if (typeof node.name !== 'string' || !node.name) {
      throw new Error(`Item with id "${node.id}" has an invalid or missing "name"`);
    }
    if ('parentId' in node && node.parentId !== null && typeof node.parentId !== 'string') {
      throw new Error(`Item with id "${node.id}" has an invalid "parentId" (must be string or null)`);
    }
    if (typeof node.headcount !== 'number' || isNaN(node.headcount) || node.headcount < 0) {
      throw new Error(`Item with id "${node.id}" has an invalid "headcount"`);
    }
    if (typeof node.budget !== 'number' || isNaN(node.budget) || node.budget < 0) {
      throw new Error(`Item with id "${node.id}" has an invalid "budget"`);
    }
    if (typeof node.performance !== 'number' || isNaN(node.performance) || node.performance < 0 || node.performance > 100) {
      throw new Error(`Item with id "${node.id}" has an invalid "performance" (must be between 0 and 100)`);
    }
    if (typeof node.updatedAt !== 'string' || !node.updatedAt) {
      throw new Error(`Item with id "${node.id}" has an invalid or missing "updatedAt"`);
    }
  }

  return data as OrgNode[];
}

// Service to encapsulate API communication for organizational structure.
export class OrgService {
  /**
   * Fetches the flat organizational structure nodes from the backend.
   * @param signal AbortSignal to cancel the request on component unmount
   * @returns Array of flat OrgNode objects
   */
  static async getOrgTree(signal?: AbortSignal): Promise<OrgNode[]> {
    const response = await apiClient.get<unknown>('/api/org-tree', { signal });
    return validateOrgNodes(response.data);
  }
}
