import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@/api/types';
import { computeAllAggregates } from './aggregation';

describe('Алгоритм агрегации показателей орг-структуры (computeAllAggregates)', () => {
  it('должен правильно обрабатывать узел без дочерних элементов (лист дерева)', () => {
    // Подразделение без потомков
    const mockTree: TreeNode[] = [
      {
        id: 'team_single',
        name: 'Команда А',
        parentId: null,
        headcount: 5,
        budget: 150000.0,
        performance: 90,
        updatedAt: '2026-09-14T00:00:00Z',
        children: [],
        isExpanded: false,
      },
    ];

    const aggregates = computeAllAggregates(mockTree);

    expect(aggregates['team_single']).toBeDefined();
    expect(aggregates['team_single'].totalHeadcount).toBe(5);
    expect(aggregates['team_single'].totalBudget).toBe(150000.0);
    expect(aggregates['team_single'].averagePerformance).toBe(90);
    expect(aggregates['team_single'].level).toBe(0);
  });

  it('должен правильно суммировать показатели и рассчитывать взвешенную по headcount эффективность', () => {
    // Наша расчетная иерархическая структура
    const mockTree: TreeNode[] = [
      {
        id: 'root',
        name: 'Главный Офис',
        parentId: null,
        headcount: 10,
        budget: 100000.0,
        performance: 80,
        updatedAt: '2026-09-14T00:00:00Z',
        isExpanded: true,
        children: [
          {
            id: 'child1',
            name: 'Отдел А',
            parentId: 'root',
            headcount: 5,
            budget: 50000.0,
            performance: 90,
            updatedAt: '2026-09-14T00:00:00Z',
            children: [],
            isExpanded: false,
          },
          {
            id: 'child2',
            name: 'Отдел Б',
            parentId: 'root',
            headcount: 15,
            budget: 150000.0,
            performance: 70,
            updatedAt: '2026-09-14T00:00:00Z',
            children: [],
            isExpanded: false,
          },
        ],
      },
    ];

    const aggregates = computeAllAggregates(mockTree);

    // 1. Проверяем дочерний узел 1 (должен быть равен самому себе)
    expect(aggregates['child1'].totalHeadcount).toBe(5);
    expect(aggregates['child1'].totalBudget).toBe(50000.0);
    expect(aggregates['child1'].averagePerformance).toBe(90);
    expect(aggregates['child1'].level).toBe(1);

    // 2. Проверяем дочерний узел 2 (должен быть равен самому себе)
    expect(aggregates['child2'].totalHeadcount).toBe(15);
    expect(aggregates['child2'].totalBudget).toBe(150000.0);
    expect(aggregates['child2'].averagePerformance).toBe(70);
    expect(aggregates['child2'].level).toBe(1);

    // 3. Проверяем корневой узел (суммирование и взвешенная эффективность)
    // headcount: 10 + 5 + 15 = 30
    // budget: 100k + 50k + 150k = 300k
    // weighted perf: (10*80 + 5*90 + 15*70) / 30 = (800 + 450 + 1050) / 30 = 2300/30 = 76.66% -> округляется до 77%
    expect(aggregates['root'].totalHeadcount).toBe(30);
    expect(aggregates['root'].totalBudget).toBe(300000.0);
    expect(aggregates['root'].averagePerformance).toBe(77);
    expect(aggregates['root'].level).toBe(0);
  });

  it('должен корректно обрабатывать узлы с headcount = 0 для предотвращения NaN (деления на ноль)', () => {
    const mockTree: TreeNode[] = [
      {
        id: 'root_zero',
        name: 'Пустой отдел',
        parentId: null,
        headcount: 0,
        budget: 0.0,
        performance: 85,
        updatedAt: '2026-09-14T00:00:00Z',
        isExpanded: true,
        children: [
          {
            id: 'child_zero',
            name: 'Пустая команда',
            parentId: 'root_zero',
            headcount: 0,
            budget: 0.0,
            performance: 95,
            updatedAt: '2026-09-14T00:00:00Z',
            children: [],
            isExpanded: false,
          },
        ],
      },
    ];

    const aggregates = computeAllAggregates(mockTree);

    // Не должно быть NaN! Должно вернуться собственное значение перформанса
    expect(aggregates['root_zero'].totalHeadcount).toBe(0);
    expect(aggregates['root_zero'].totalBudget).toBe(0.0);
    expect(aggregates['root_zero'].averagePerformance).toBe(85);
  });
});
