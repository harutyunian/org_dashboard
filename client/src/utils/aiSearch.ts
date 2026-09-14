import type { AggregatedMetrics } from '@/hooks/useAggregatedData';

export interface ParsedFilter {
  field: 'totalBudget' | 'totalHeadcount' | 'averagePerformance';
  operator: '>' | '<' | '>=' | '<=' | '=';
  value: number;
  rawQuery: string;
}

/**
 * Парсит строку поиска на естественном языке в структурированные фильтры.
 * Возвращает объект ParsedFilter или null, если структура не распознана (тогда нужен fallback на текстовый поиск).
 */
export function parseAISearch(query: string): ParsedFilter | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;

  // 1. Регулярные выражения для распознавания категорий
  const budgetRegex = /(бюджет|budget|деньги|money)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)\s*(k|к|м|m|тыс|млн)?/i;
  const performanceRegex = /(эффективность|performance|perf|кпд)\s*(>=|<=|>|<|=)\s*(\d+)/i;
  const headcountRegex = /(штат|люди|сотрудники|people|headcount|чел)\s*(>=|<=|>|<|=)\s*(\d+)/i;

  // Функция перевода строковых суффиксов в множители чисел (например, 500k -> 500000)
  const parseNumericValue = (valStr: string, suffix?: string): number => {
    const base = parseFloat(valStr);
    if (!suffix) return base;
    
    if (suffix === 'k' || suffix === 'к' || suffix === 'тыс') {
      return base * 1000;
    }
    if (suffix === 'm' || suffix === 'м' || suffix === 'млн') {
      return base * 1000000;
    }
    return base;
  };

  // 2. Пробуем сопоставить БЮДЖЕТ
  const budgetMatch = trimmed.match(budgetRegex);
  if (budgetMatch) {
    const operator = budgetMatch[2] as ParsedFilter['operator'];
    const rawVal = budgetMatch[3];
    const suffix = budgetMatch[4];
    return {
      field: 'totalBudget',
      operator,
      value: parseNumericValue(rawVal, suffix),
      rawQuery: query,
    };
  }

  // 3. Пробуем сопоставить ЭФФЕКТИВНОСТЬ
  const perfMatch = trimmed.match(performanceRegex);
  if (perfMatch) {
    const operator = perfMatch[2] as ParsedFilter['operator'];
    const value = parseInt(perfMatch[3], 10);
    return {
      field: 'averagePerformance',
      operator,
      value,
      rawQuery: query,
    };
  }

  // 4. Пробуем сопоставить ЧИСЛЕННОСТЬ ШТАТА
  const hcMatch = trimmed.match(headcountRegex);
  if (hcMatch) {
    const operator = hcMatch[2] as ParsedFilter['operator'];
    const value = parseInt(hcMatch[3], 10);
    return {
      field: 'totalHeadcount',
      operator,
      value,
      rawQuery: query,
    };
  }

  return null; // Ничего не подошло, уходим в обычный текстовый поиск
}

/**
 * Применяет распарсенный фильтр к конкретной строке таблицы.
 */
export function applyParsedFilter(item: AggregatedMetrics, filter: ParsedFilter): boolean {
  const itemValue = item[filter.field];
  const filterValue = filter.value;

  switch (filter.operator) {
    case '>':
      return itemValue > filterValue;
    case '<':
      return itemValue < filterValue;
    case '>=':
      return itemValue >= filterValue;
    case '<=':
      return itemValue <= filterValue;
    case '=':
      return itemValue === filterValue;
    default:
      return false;
  }
}
