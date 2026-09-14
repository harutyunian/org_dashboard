import { describe, it, expect } from 'vitest';
import { parseAISearch, applyParsedFilter } from './aiSearch';
import type { AggregatedMetrics } from '@/hooks/useAggregatedData';

describe('AI-Search Парсер Естественного Языка (parseAISearch)', () => {
  it('должен правильно парсить фильтры БЮДЖЕТА с суффиксами k/к и m/м/млн', () => {
    // 500k -> 500 000
    const filter1 = parseAISearch('бюджет > 500k');
    expect(filter1).not.toBeNull();
    expect(filter1!.field).toBe('totalBudget');
    expect(filter1!.operator).toBe('>');
    expect(filter1!.value).toBe(500000);

    // 1.5м -> 1 500 000
    const filter2 = parseAISearch('budget <= 1.5м');
    expect(filter2).not.toBeNull();
    expect(filter2!.field).toBe('totalBudget');
    expect(filter2!.operator).toBe('<=');
    expect(filter2!.value).toBe(1500000);

    // 3 млн -> 3 000 000
    const filter3 = parseAISearch('деньги = 3млн');
    expect(filter3).not.toBeNull();
    expect(filter3!.field).toBe('totalBudget');
    expect(filter3!.operator).toBe('=');
    expect(filter3!.value).toBe(3000000);
  });

  it('должен правильно парсить фильтры ЭФФЕКТИВНОСТИ (performance/perf)', () => {
    const filter1 = parseAISearch('эффективность < 80');
    expect(filter1).not.toBeNull();
    expect(filter1!.field).toBe('averagePerformance');
    expect(filter1!.operator).toBe('<');
    expect(filter1!.value).toBe(80);

    const filter2 = parseAISearch('perf >= 95');
    expect(filter2).not.toBeNull();
    expect(filter2!.field).toBe('averagePerformance');
    expect(filter2!.operator).toBe('>=');
    expect(filter2!.value).toBe(95);
  });

  it('должен правильно парсить фильтры ЧИСЛЕННОСТИ ШТАТА (люди/штат/чел)', () => {
    const filter1 = parseAISearch('штат > 20');
    expect(filter1).not.toBeNull();
    expect(filter1!.field).toBe('totalHeadcount');
    expect(filter1!.operator).toBe('>');
    expect(filter1!.value).toBe(20);

    const filter2 = parseAISearch('люди <= 5');
    expect(filter2).not.toBeNull();
    expect(filter2!.field).toBe('totalHeadcount');
    expect(filter2!.operator).toBe('<=');
    expect(filter2!.value).toBe(5);
  });

  it('должен возвращать null для обычного текстового поиска', () => {
    const filter1 = parseAISearch('Отдел Разработки');
    expect(filter1).toBeNull();

    const filter2 = parseAISearch('Группа компаний');
    expect(filter2).toBeNull();
  });

  it('должен правильно применять распарсенный фильтр к строке AggregatedMetrics', () => {
    const mockItem: AggregatedMetrics = {
      id: 'dept_test',
      name: 'Тестовый отдел',
      parentId: 'root',
      level: 2,
      totalHeadcount: 15,
      totalBudget: 850000,
      averagePerformance: 75,
    };

    // Тест 1: Бюджет > 500k -> true
    const filterBudget = parseAISearch('бюджет > 500k')!;
    expect(applyParsedFilter(mockItem, filterBudget)).toBe(true);

    // Тест 2: Штат < 10 -> false
    const filterHC = parseAISearch('штат < 10')!;
    expect(applyParsedFilter(mockItem, filterHC)).toBe(false);

    // Тест 3: Эффективность >= 75 -> true
    const filterPerf = parseAISearch('perf >= 75')!;
    expect(applyParsedFilter(mockItem, filterPerf)).toBe(true);
  });
});
