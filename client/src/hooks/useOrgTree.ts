import { useQuery } from '@tanstack/react-query';
import { OrgService } from '@/services/OrgService';
import type { OrgNode } from '@/api/types';

/**
 * useOrgTree — кастомный хук для получения и кэширования плоского дерева орг-структуры.
 * Использует TanStack Query для продвинутого кэширования и инвалидации данных.
 */
export function useOrgTree() {
  return useQuery<OrgNode[], Error>({
    queryKey: ['org-tree'],
    queryFn: async ({ signal }) => {
      // Передаем signal из React Query в наш сервис для автоматической отмены запроса
      return OrgService.getOrgTree(signal);
    },
    // Жесткое требование ТЗ: stale time 5 секунд
    staleTime: 5000,
    // Настройки отказоустойчивости: делать до 2 повторных попыток при сбое сети
    retry: 2,
    // Фоновое обновление при повторном фокусе на окно браузера
    refetchOnWindowFocus: true,
  });
}
