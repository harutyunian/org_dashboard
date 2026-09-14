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

  // Initialize WebSockets connection for real-time updates
  const { status: wsStatus, lastUpdatedNode } = useOrgWebSocket();

  // State for flashing newly updated nodes
  const [recentUpdates, setRecentUpdates] = useState<{ [id: string]: boolean }>({});

  // Control update animation flash duration (exactly 1.5 seconds)
  useEffect(() => {
    if (lastUpdatedNode) {
      const { id } = lastUpdatedNode;
      
      const flashTimer = setTimeout(() => {
        setRecentUpdates((prev) => ({ ...prev, [id]: true }));
      }, 0);

      const timer = setTimeout(() => {
        setRecentUpdates((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 1500);

      return () => {
        clearTimeout(flashTimer);
        clearTimeout(timer);
      };
    }
  }, [lastUpdatedNode]);

  // Compute high-performance aggregated metrics O(N)
  const aggregates = useAggregatedData(flatNodes);

  // UI state
  const [activeView, setActiveView] = useState<'tree' | 'table'>('tree');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [isInitialExpandedSet, setIsInitialExpandedSet] = useState(false);

  // Initialize default expanded branches on load
  useEffect(() => {
    if (flatNodes && flatNodes.length > 0 && !isInitialExpandedSet) {
      const timer = setTimeout(() => {
        setExpandedNodeIds(getDefaultExpandedIds(flatNodes));
        setIsInitialExpandedSet(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [flatNodes, isInitialExpandedSet]);

  // Rebuild the hierarchical tree for left-panel view
  const tree = useMemo(() => {
    if (!flatNodes) return [];
    return buildTree(flatNodes, expandedNodeIds);
  }, [flatNodes, expandedNodeIds]);

  // Handle node selection (from either Tree or Table view)
  const handleSelectNode = (id: string) => {
    setSelectedNodeId(id);

    // Expand all ancestors programmatically to make sure the selected node is visible in the tree
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

  // Toggle tree node expansion manually
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

  // Retrieve metrics of the currently selected node
  const selectedAggregatedNode = useMemo(() => {
    if (!selectedNodeId || !aggregates[selectedNodeId]) return null;
    return aggregates[selectedNodeId];
  }, [selectedNodeId, aggregates]);

  // 1. LOADING STATE
  if (isLoading) {
    return (
      <div className={styles.centerContainer}>
        <div className={styles.spinner} />
        <p style={{ fontWeight: 500, color: '#475569' }}>Loading organizational structure...</p>
      </div>
    );
  }

  // 2. ERROR STATE
  if (error) {
    return (
      <div className={styles.centerContainer}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>⚠️</div>
          <h2>Connection Error</h2>
          <p>Failed to retrieve data from server. Please ensure the Go backend and PostgreSQL database are active.</p>
          <button type="button" className={styles.retryBtn} onClick={() => refetch()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // 3. EMPTY DATABASE STATE
  if (!flatNodes || flatNodes.length === 0) {
    return (
      <div className={styles.centerContainer}>
        <div className={styles.errorCard} style={{ borderColor: '#cbd5e1' }}>
          <div className={styles.errorIcon} style={{ color: '#94a3b8' }}>📁</div>
          <h2>No Data Found</h2>
          <p>The server responded successfully, but the organizational structure is empty.</p>
          <button type="button" className={styles.retryBtn} onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Render network connection badge
  const renderConnectionStatus = () => {
    switch (wsStatus) {
      case 'connected':
        return (
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
            Live
          </span>
        );
      case 'connecting':
        return (
          <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
            Connecting...
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
            Offline
          </span>
        );
    }
  };

  const formatBudget = (value: number) => {
    const formatted = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
    return `${formatted} руб.`;
  };

  const getPerformanceClass = (perf: number) => {
    if (perf >= 80) return styles.perfGood;
    if (perf < 50) return styles.perfDanger;
    return styles.perfWarning;
  };

  const getNodeTypeString = (id: string) => {
    if (id === 'root') return 'Corporate Headquarters';
    if (id.startsWith('div_')) return 'Company Division';
    if (id.startsWith('dept_')) return 'Functional Department';
    if (id.startsWith('team_')) return 'Team';
    return 'Unit';
  };

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>📊</span>
          <h1>Staff Pulse</h1>
        </div>
        <div className={styles.stats}>
          {renderConnectionStatus()}
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span>Total Units: <strong>{flatNodes.length}</strong></span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span>Database: <strong style={{ color: '#1e40af' }}>PostgreSQL</strong></span>
        </div>
      </header>

      {/* Tabs segment switcher (displayed on screens < 1280px) */}
      <div className={styles.viewToggleContainer}>
        <div className={styles.segmentedControl}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${activeView === 'tree' ? styles.toggleBtnActive : ''}`}
            onClick={() => setActiveView('tree')}
          >
            🌳 Hierarchy (Tree)
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${activeView === 'table' ? styles.toggleBtnActive : ''}`}
            onClick={() => setActiveView('table')}
          >
            📊 Analytics (Table)
          </button>
        </div>
      </div>

      <main className={styles.mainContent}>
        {/* DESKTOP SPLIT-VIEW LAYOUT (displayed on screens >= 1280px) */}
        <div className={styles.splitViewLayout}>
          <div>
            <h2 className={styles.columnTitle}>🌳 Org-Structure Tree</h2>
            <TreeView
              tree={tree}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onToggleNode={handleToggleNode}
              recentUpdates={recentUpdates}
            />
          </div>

          <div>
            <h2 className={styles.columnTitle}>📊 Analytical Metrics Table</h2>
            <TableView
              flatNodes={flatNodes}
              aggregates={aggregates}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              recentUpdates={recentUpdates}
            />
          </div>
        </div>

        {/* MOBILE SINGLE-COLUMN TABS LAYOUT (displayed on screens < 1280px) */}
        <div className={styles.mobileLayout}>
          {activeView === 'tree' ? (
            <div>
              <h2 className={styles.columnTitle}>🌳 Org-Structure Tree</h2>
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
              <h2 className={styles.columnTitle}>📊 Analytical Metrics Table</h2>
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

        {/* BOTTOM METRICS DETAIL PANEL */}
        <div className={styles.detailsAndSidebar}>
          <h2 className={styles.columnTitle}>📋 Detailed Aggregated Metrics</h2>
          {selectedAggregatedNode ? (
            <div className={styles.detailCard}>
              <div className={styles.detailHeader}>
                <span className={styles.nodeType}>{getNodeTypeString(selectedAggregatedNode.id)}</span>
                <h2>{selectedAggregatedNode.name}</h2>
              </div>

              <div className={styles.metricsGrid}>
                <div className={styles.metricItem}>
                  <div className={styles.metricIcon}>👥</div>
                  <div className={styles.metricContent}>
                    <span className={styles.label}>Headcount (Subtree cumulative)</span>
                    <span className={styles.value}>{selectedAggregatedNode.totalHeadcount} people</span>
                  </div>
                </div>

                <div className={styles.metricItem}>
                  <div className={styles.metricIcon}>💵</div>
                  <div className={styles.metricContent}>
                    <span className={styles.label}>Budget (Subtree cumulative)</span>
                    <span className={styles.value}>{formatBudget(selectedAggregatedNode.totalBudget)}</span>
                  </div>
                </div>

                <div className={styles.metricItem}>
                  <div className={styles.metricIcon}>📈</div>
                  <div className={styles.metricContent}>
                    <span className={styles.label}>Weighted Efficiency (Subtree cumulative)</span>
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
              <h3>No Unit Selected</h3>
              <p>
                Click any organizational unit in the Tree or Table view above to see detailed aggregated stats representing personnel headcount, budgets, and weighted performance calculated dynamically with all descendant nodes.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;