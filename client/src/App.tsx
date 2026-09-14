import { useState, useEffect, useMemo } from 'react';
import { useOrgTree } from '@/hooks/useOrgTree';
import { useAggregatedData } from '@/hooks/useAggregatedData';
import { useOrgWebSocket } from '@/hooks/useOrgWebSocket';
import { buildTree, getDefaultExpandedIds, getAncestors } from '@/utils/tree';
import { TreeView } from '@/components/TreeView/TreeView';
import { TableView } from '@/components/TableView/TableView';
import styles from './App.module.scss';

function App() {
  const { data: flatNodes, isLoading, error, refetch } = useOrgTree();

  // 1. Инициализируем WebSockets клиент (Live-подключение)
  const { status: wsStatus, lastUpdatedNode } = useOrgWebSocket();

  // Состояние недавно измененных по сокету узлов для анимации вспышки
  const [recentUpdates, setRecentUpdates] = useState<{ [id: string]: boolean }>({});

  // Эффект управления вспышкой изменений (держим ровно 1.5 секунды)
  useEffect(() => {
    if (lastUpdatedNode) {
      const { id } = lastUpdatedNode;
      
      // Добавляем узел в список мигающих
      setRecentUpdates((prev) => ({ ...prev, [id]: true }));

      // Через 1.5 секунды убираем, плавно завершая анимацию
      const timer = setTimeout(() => {
        setRecentUpdates((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [lastUpdatedNode]);

  // Рассчитываем суммарные агрегированные показатели O(N)
  const aggregates = useAggregatedData(flatNodes);

  // Состояния интерфейса
  const [activeView, setActiveView] = useState<'tree' | 'table'>('tree'); // Для экранов < 1280px
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [isInitialExpandedSet, setIsInitialExpandedSet] = useState(false);

  // Инициализируем дефолтно раскрытые ветки при первой загрузке
  useEffect(() => {
    if (flatNodes && flatNodes.length > 0 && !isInitialExpandedSet) {
      setExpandedNodeIds(getDefaultExpandedIds(flatNodes));
      setIsInitialExpandedSet(true);
    }
  }, [flatNodes, isInitialExpandedSet]);

  // Сборка дерева для интерактивного отображения слева
  const tree = useMemo(() => {
    if (!flatNodes) return [];
    return buildTree(flatNodes, expandedNodeIds);
  }, [flatNodes, expandedNodeIds]);

  // Умный обработчик выделения узла (Дерево или Таблица)
  const handleSelectNode = (id: string) => {
    setSelectedNodeId(id);

    // Если узел выбран, автоматически находим всех его предков
    // и раскрываем их, чтобы выбранный узел гарантированно был виден в дереве!
    if (flatNodes) {
      const ancestors = getAncestors(flatNodes, id);
      if (ancestors.length > 0) {
        setExpandedNodeIds((prev) => {
          const next = new Set(prev);
          ancestors.forEach((ancId) => next.add(ancId));
          return next;
        });
      }
    }
  };

  // Обработчик раскрытия/сворачивания веток вручную
  const handleToggleNode = (id: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Получаем агрегированные данные выбранного узла
  const selectedAggregatedNode = useMemo(() => {
    if (!selectedNodeId || !aggregates[selectedNodeId]) return null;
    return aggregates[selectedNodeId];
  }, [selectedNodeId, aggregates]);

  // 1. СОСТОЯНИЕ ЗАГРУЗКИ
  if (isLoading) {
    return (
      <div className={styles.centerContainer}>
        <div className={styles.spinner} />
        <p style={{ fontWeight: 500, color: '#475569' }}>Загрузка организационной структуры...</p>
      </div>
    );
  }

  // 2. СОСТОЯНИЕ ОШИБКИ
  if (error) {
    return (
      <div className={styles.centerContainer}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>⚠️</div>
          <h2>Ошибка подключения</h2>
          <p>Не удалось загрузить данные с сервера. Убедитесь, что бэкенд на Go запущен на порту 8080, а PostgreSQL активен.</p>
          <button type="button" className={styles.retryBtn} onClick={() => refetch()}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // 3. СОСТОЯНИЕ ПУСТОЙ БАЗЫ ДАННЫХ
  if (!flatNodes || flatNodes.length === 0) {
    return (
      <div className={styles.centerContainer}>
        <div className={styles.errorCard} style={{ borderColor: '#cbd5e1' }}>
          <div className={styles.errorIcon} style={{ color: '#94a3b8' }}>📁</div>
          <h2>База данных пуста</h2>
          <p>Сервер успешно ответил, но орг-структура компании не найдена.</p>
          <button type="button" className={styles.retryBtn} onClick={() => refetch()}>
            Обновить
          </button>
        </div>
      </div>
    );
  }

  // Рендеринг индикатора сетевого WebSocket соединения
  const renderConnectionStatus = () => {
    switch (wsStatus) {
      case 'connected':
        return (
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
            В сети (Live)
          </span>
        );
      case 'connecting':
        return (
          <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
            Подключение...
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
            Вне сети
          </span>
        );
    }
  };

  // Форматирование бюджета (12 345 678 руб.)
  const formatBudget = (value: number) => {
    const formatted = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return `${formatted} руб.`;
  };

  // Класс для подсветки эффективности
  const getPerformanceClass = (perf: number) => {
    if (perf >= 80) return styles.perfGood;
    if (perf < 50) return styles.perfDanger;
    return styles.perfWarning;
  };

  // Текст типа узла по его ID
  const getNodeTypeString = (id: string) => {
    if (id === 'root') return 'Корпоративный центр';
    if (id.startsWith('div_')) return 'Дивизион компании';
    if (id.startsWith('dept_')) return 'Функциональный отдел';
    if (id.startsWith('team_')) return 'Рабочая команда';
    return 'Подразделение';
  };

  return (
    <div className={styles.appContainer}>
      {/* Шапка дашборда */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>📊</span>
          <h1>Staff Pulse</h1>
        </div>
        <div className={styles.stats}>
          {renderConnectionStatus()}
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span>Всего подразделений: <strong>{flatNodes.length}</strong></span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span>База данных: <strong style={{ color: '#1e40af' }}>PostgreSQL</strong></span>
        </div>
      </header>

      {/* Переключатель вкладок «Дерево / Таблица» (показывается только на экранах < 1280px) */}
      <div className={styles.viewToggleContainer}>
        <div className={styles.segmentedControl}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${activeView === 'tree' ? styles.toggleBtnActive : ''}`}
            onClick={() => setActiveView('tree')}
          >
            🌳 Иерархия (Дерево)
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${activeView === 'table' ? styles.toggleBtnActive : ''}`}
            onClick={() => setActiveView('table')}
          >
            📊 Analytics (Таблица)
          </button>
        </div>
      </div>

      {/* Основной контент дашборда */}
      <main className={styles.mainContent}>
        {/* А: МАКЕТ SPLIT-VIEW (Показывается при ширине >= 1280px, выводит обе колонки рядом) */}
        <div className={styles.splitViewLayout}>
          {/* Левая колонка: Интерактивное Дерево */}
          <div>
            <h2 className={styles.columnTitle}>🌳 Дерево орг-структуры</h2>
            <TreeView
              tree={tree}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onToggleNode={handleToggleNode}
              recentUpdates={recentUpdates}
            />
          </div>

          {/* Правая колонка: Аналитическая Таблица */}
          <div>
            <h2 className={styles.columnTitle}>📊 Аналитическая таблица с агрегацией</h2>
            <TableView
              flatNodes={flatNodes}
              aggregates={aggregates}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              recentUpdates={recentUpdates}
            />
          </div>
        </div>

        {/* Б: МОБИЛЬНЫЙ МАКЕТ (Показывается при ширине < 1280px, выводит только выбранную вкладку) */}
        <div className={styles.mobileLayout}>
          {activeView === 'tree' ? (
            <div>
              <h2 className={styles.columnTitle}>🌳 Дерево орг-структуры</h2>
              <TreeView
                tree={tree}
                selectedNodeId={selectedNodeId}
                onSelectNode={handleSelectNode}
                onToggleNode={handleToggleNode}
                recentUpdates={recentUpdates}
              />
            </div>
          ) : (
            <div>
              <h2 className={styles.columnTitle}>📊 Аналитическая таблица с агрегацией</h2>
              <TableView
                flatNodes={flatNodes}
                aggregates={aggregates}
                selectedNodeId={selectedNodeId}
                onSelectNode={handleSelectNode}
                recentUpdates={recentUpdates}
              />
            </div>
          )}
        </div>

        {/* НИЖНЯЯ ПАНЕЛЬ: Детальная информация по выбранному узлу с агрегированными показателями */}
        <div className={styles.detailsAndSidebar}>
          <h2 className={styles.columnTitle}>📋 Детальные агрегированные показатели</h2>
          {selectedAggregatedNode ? (
            <div className={styles.detailCard}>
              <div className={styles.detailHeader}>
                <span className={styles.nodeType}>{getNodeTypeString(selectedAggregatedNode.id)}</span>
                <h2>{selectedAggregatedNode.name}</h2>
              </div>

              <div className={styles.metricsGrid}>
                {/* Метрика 1: Суммарный штат */}
                <div className={styles.metricItem}>
                  <div className={styles.metricIcon}>👥</div>
                  <div className={styles.metricContent}>
                    <span className={styles.label}>Штат подразделения + всех потомков</span>
                    <span className={styles.value}>{selectedAggregatedNode.totalHeadcount} человек</span>
                  </div>
                </div>

                {/* Метрика 2: Суммарный бюджет */}
                <div className={styles.metricItem}>
                  <div className={styles.metricIcon}>💵</div>
                  <div className={styles.metricContent}>
                    <span className={styles.label}>Бюджет суммарный (с потомками)</span>
                    <span className={styles.value}>{formatBudget(selectedAggregatedNode.totalBudget)}</span>
                  </div>
                </div>

                {/* Метрика 3: Взвешенная эффективность */}
                <div className={styles.metricItem}>
                  <div className={styles.metricIcon}>📈</div>
                  <div className={styles.metricContent}>
                    <span className={styles.label}>Взвешенная эффективность (с потомками)</span>
                    <span className={`${styles.value} ${getPerformanceClass(selectedAggregatedNode.averagePerformance)}`}>
                      {selectedAggregatedNode.averagePerformance}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.placeholderCard}>
              <div className={styles.placeholderIcon}>🖱️</div>
              <h3>Подразделение не выбрано</h3>
              <p>
                Кликните на любое подразделение в Дереве или Таблице выше, чтобы увидеть детальную статистику сотрудников, бюджетов и средневзвешенной эффективности с учетом всех дочерних команд.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
