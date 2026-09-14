import { apiClient } from '@/api/client';
import type { OrgNode } from '@/api/types';

// OrgService инкапсулирует логику сетевого взаимодействия для организационной структуры.
export class OrgService {
  /**
   * Получает плоский массив узлов орг-структуры с бэкенда.
   * @param signal AbortSignal для возможности отмены запроса при размонтировании компонента
   * @returns Массив плоских узлов OrgNode
   */
  static async getOrgTree(signal?: AbortSignal): Promise<OrgNode[]> {
    const response = await apiClient.get<OrgNode[]>('/api/org-tree', { signal });
    return response.data;
  }
}
