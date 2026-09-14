import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { OrgNode } from '@/api/types';
import type { AggregatedMetrics } from '@/hooks/useAggregatedData';
import { useDebounce } from '@/hooks/useDebounce';
import { parseAISearch, applyParsedFilter } from '@/utils/aiSearch';
import type { ParsedFilter } from '@/utils/aiSearch';
import styles from './TableView.module.scss';

interface TableViewProps {
  flatNodes: OrgNode[];
  aggregates: { [id: string]: AggregatedMetrics };
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  recentUpdates: { [id: string]: boolean };
}

type SortField = 'name' | 'level' | 'totalHeadcount' | 'totalBudget' | 'averagePerformance';
type SortOrder = 'asc' | 'desc';

export const TableView: React.FC<TableViewProps> = ({
  aggregates,
  selectedNodeId,
  onSelectNode,
  recentUpdates,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);

  // Состояние сортировки
  const [sortField, setSortField] = useState<SortField>('level');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Клавиатурная навигация: индекс сфокусированной строки
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const tableRef = useRef<HTMLDivElement>(null);

  // Превращаем карту агрегатов в плоский массив для отображения и фильтрации
  const dataList = useMemo(() => {
    return Object.values(aggregates);
  }, [aggregates]);

  // Вычисляем, применился ли умный AI-фильтр на основе поискового запроса
  const activeAIFilter = useMemo(() => {
    return parseAISearch(debouncedSearch);
  }, [debouncedSearch]);

  // Фильтрация данных по названию ИЛИ умному AI-фильтру с учетом дебаунса
  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return dataList;

    // Если распарсился умный фильтр, применяем его
    if (activeAIFilter) {
      return dataList.filter((item) => applyParsedFilter(item, activeAIFilter));
    }

    // Иначе откатываемся на стандартный текстовый поиск по названию
    const lowerSearch = debouncedSearch.toLowerCase();
    return dataList.filter((item) => item.name.toLowerCase().includes(lowerSearch));
  }, [dataList, debouncedSearch, activeAIFilter]);

  // Сортировка отфильтрованных данных
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      return 0;
    });
    return sorted;
  }, [filteredData, sortField, sortOrder]);

  // Синхронизируем клавиатурный фокус с внешним выделением
  useEffect(() => {
    if (selectedNodeId) {
      const index = sortedData.findIndex((item) => item.id === selectedNodeId);
      if (index !== -1) {
        const timer = setTimeout(() => {
          setFocusedIndex(index);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedNodeId, sortedData]);

  // Сбрасываем фокус при изменении фильтрации
  useEffect(() => {
    const timer = setTimeout(() => {
      setFocusedIndex(-1);
    }, 0);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  // Обработчик нажатия клавиш для навигации
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sortedData.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.min(prev + 1, sortedData.length - 1);
          scrollToRow(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          scrollToRow(next);
          return next;
        });
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        scrollToRow(0);
        break;
      case 'End': {
        e.preventDefault();
        const lastIdx = sortedData.length - 1;
        setFocusedIndex(lastIdx);
        scrollToRow(lastIdx);
        break;
      }
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < sortedData.length) {
          onSelectNode(sortedData[focusedIndex].id);
        }
        break;
      default:
        break;
    }
  };

  // Вспомогательная функция прокрутки таблицы
  const scrollToRow = (index: number) => {
    const tableWrapper = tableRef.current;
    if (!tableWrapper) return;

    const rows = tableWrapper.querySelectorAll('tbody tr');
    const targetRow = rows[index] as HTMLElement;

    if (targetRow) {
      const wrapperTop = tableWrapper.scrollTop;
      const wrapperBottom = wrapperTop + tableWrapper.clientHeight;
      const rowTop = targetRow.offsetTop;
      const rowBottom = rowTop + targetRow.clientHeight;

      if (rowTop < wrapperTop) {
        tableWrapper.scrollTop = rowTop;
      } else if (rowBottom > wrapperBottom) {
        tableWrapper.scrollTop = rowBottom - tableWrapper.clientHeight;
      }
    }
  };

  // Обработчик одиночного клика — сортировка по выбранной колонке (Шаг 2 ТЗ)
  const handleSortClick = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Обработчик двойного клика — обратное направление сортировки (Шаг 2 ТЗ)
  const handleSortDoubleClick = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Возвращает понятный текст уровня вложенности
  const getLevelLabel = (level: number) => {
    switch (level) {
      case 0:
        return 'Корень';
      case 1:
        return 'Дивизион';
      case 2:
        return 'Отдел';
      case 3:
        return 'Команда';
      default:
        return `Уровень ${level}`;
    }
  };

  // Форматирование бюджета строго по ТЗ: 12 345 678 руб.
  const formatBudget = (value: number) => {
    const formatted = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return `${formatted} руб.`;
  };

  // Текст подсказки примененного умного AI-фильтра
  const renderAIFilterBadge = (filter: ParsedFilter) => {
    let fieldText = 'Бюджет';
    let valueText = filter.value.toString();

    if (filter.field === 'averagePerformance') {
      fieldText = 'Эффективность';
      valueText = `${filter.value}%`;
    } else if (filter.field === 'totalHeadcount') {
      fieldText = 'Численность персонала';
      valueText = `${filter.value} чел.`;
    } else if (filter.field === 'totalBudget') {
      fieldText = 'Бюджет суммарный';
      valueText = formatBudget(filter.value);
    }

    return (
      <div style={{
        fontSize: '12px',
        color: '#2563eb',
        backgroundColor: '#eff6ff',
        padding: '6px 12px',
        borderRadius: '6px',
        border: '1px solid #bfdbfe',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 500,
        marginTop: '4px'
      }}>
        <span>💡 Применен умный фильтр: <strong>{fieldText} {filter.operator} {valueText}</strong></span>
      </div>
    );
  };

  // Стиль для перформанса
  const getPerfClassAndDot = (perf: number) => {
    if (perf >= 80) return { textClass: styles.perfGood, dotClass: styles.dotGood, text: 'Высокая' };
    if (perf < 50) return { textClass: styles.perfDanger, dotClass: styles.dotDanger, text: 'Низкая' };
    return { textClass: styles.perfWarning, dotClass: styles.dotWarning, text: 'Средняя' };
  };

  return (
    <div className={styles.tableContainer}>
      {/* Контролы таблицы */}
      <div className={styles.tableControls}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder='Поиск ("отдел разработки" или "бюджет > 500k", "perf >= 80")'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.rowsCount}>
          Найдено записей: <strong>{filteredData.length}</strong>
        </div>
      </div>

      {/* Выводим бейдж примененного AI-фильтра, если он распознан */}
      {activeAIFilter && renderAIFilterBadge(activeAIFilter)}

      {/* Сама аналитическая таблица с поддержкой фокуса клавиатуры */}
      <div
        ref={tableRef}
        className={styles.responsiveTableWrapper}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Аналитическая таблица"
        style={{ outline: 'none' }}
      >
        <table className={styles.analyticsTable}>
          <thead>
            <tr>
              <th
                className={styles.th}
                onClick={() => handleSortClick('name')}
                onDoubleClick={() => handleSortDoubleClick('name')}
                title="Одинарный клик — сортировка, двойной клик — реверс"
              >
                Подразделение
                {sortField === 'name' && (
                  <span className={styles.sortIndicator}>{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th
                className={styles.th}
                onClick={() => handleSortClick('level')}
                onDoubleClick={() => handleSortDoubleClick('level')}
                title="Одинарный клик — сортировка, двойной клик — реверс"
              >
                Уровень
                {sortField === 'level' && (
                  <span className={styles.sortIndicator}>{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th
                className={styles.th}
                onClick={() => handleSortClick('totalHeadcount')}
                onDoubleClick={() => handleSortDoubleClick('totalHeadcount')}
                title="Одинарный клик — сортировка, двойной клик — реверс"
              >
                Всего сотрудников
                {sortField === 'totalHeadcount' && (
                  <span className={styles.sortIndicator}>{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th
                className={styles.th}
                onClick={() => handleSortClick('totalBudget')}
                onDoubleClick={() => handleSortDoubleClick('totalBudget')}
                title="Одинарный клик — сортировка, двойной клик — реверс"
              >
                Бюджет суммарный
                {sortField === 'totalBudget' && (
                  <span className={styles.sortIndicator}>{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th
                className={styles.th}
                onClick={() => handleSortClick('averagePerformance')}
                onDoubleClick={() => handleSortDoubleClick('averagePerformance')}
                title="Одинарный клик — сортировка, двойной клик — реверс"
              >
                Средняя эффективность
                {sortField === 'averagePerformance' && (
                  <span className={styles.sortIndicator}>{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length > 0 ? (
              sortedData.map((row, idx) => {
                const isSelected = row.id === selectedNodeId;
                const isFocused = idx === focusedIndex;
                const isFlashing = recentUpdates[row.id] === true;
                const { textClass, text } = getPerfClassAndDot(row.averagePerformance);

                return (
                  <tr
                    key={row.id}
                    className={`${styles.tr} ${isSelected ? styles.trSelected : ''} ${isFocused ? styles.trFocused : ''} ${isFlashing ? styles.rowFlash : ''}`}
                    onClick={() => onSelectNode(row.id)}
                  >
                    <td className={styles.td} style={{ fontWeight: 500 }}>
                      {row.name}
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.levelBadge} ${styles[`level${Math.min(row.level, 3)}`]}`}>
                        {getLevelLabel(row.level)}
                      </span>
                    </td>
                    <td className={styles.td} style={{ fontWeight: 600 }}>
                      {row.totalHeadcount} чел.
                    </td>
                    <td className={styles.td}>{formatBudget(row.totalBudget)}</td>
                    <td className={styles.td}>
                      <div className={`${styles.perfIndicator} ${textClass}`}>
                        <span className={`${styles.dot} ${styles[`dot${row.averagePerformance >= 80 ? 'Good' : row.averagePerformance < 50 ? 'Danger' : 'Warning'}`]}`} />
                        <span>
                          {row.averagePerformance}% ({text})
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className={styles.noResults}>
                  Подразделений, соответствующих запросу «{debouncedSearch}», не найдено.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
