import React from 'react';
import type { TreeNode } from '@/api/types';
import styles from './TreeView.module.scss';

interface TreeViewProps {
  tree: TreeNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onToggleNode: (id: string) => void;
  recentUpdates: { [id: string]: boolean }; // Пропс отслеживания live-обновлений
}

interface TreeNodeItemProps {
  node: TreeNode;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onToggleNode: (id: string) => void;
  recentUpdates: { [id: string]: boolean };
}

// Рекурсивный вспомогательный компонент для рендеринга каждого элемента дерева
const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  selectedNodeId,
  onSelectNode,
  onToggleNode,
  recentUpdates,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedNodeId;
  const isFlashing = recentUpdates[node.id] === true; // Проверяем, изменился ли узел по сокету

  // Динамический выбор класса стиля на основе performance
  let perfStyleClass = styles.perfWarning;
  if (node.performance >= 80) {
    perfStyleClass = styles.perfGood;
  } else if (node.performance < 50) {
    perfStyleClass = styles.perfDanger;
  }

  const handleRowClick = () => {
    onSelectNode(node.id);
  };

  const handleArrowClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Исключаем срабатывание клика по всей строке при нажатии на стрелку
    onToggleNode(node.id);
  };

  return (
    <li className={styles.treeItem}>
      {/* Добавляем styles.rowFlash, если идет live-обновление */}
      <div
        className={`${styles.nodeRow} ${isSelected ? styles.nodeRowSelected : ''} ${isFlashing ? styles.rowFlash : ''}`}
        onClick={handleRowClick}
      >
        {/* Кнопка раскрытия ветки (стрелочка) */}
        {hasChildren ? (
          <button
            type="button"
            className={`${styles.expanderArrow} ${node.isExpanded ? styles.arrowExpanded : ''}`}
            onClick={handleArrowClick}
            aria-label={node.isExpanded ? 'Свернуть' : 'Развернуть'}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ▶
          </button>
        ) : (
          <div className={styles.noChildrenSpacer} />
        )}

        {/* Название и мета-информация (кол-во людей и перформанс) */}
        <div className={styles.nodeContent}>
          <span className={styles.nodeName}>{node.name}</span>
          <div className={styles.nodeMeta}>
            <span className={styles.headcountBadge}>
              👥 {node.headcount}
            </span>
            <div className={`${styles.performanceIndicator} ${perfStyleClass}`}>
              <span className={styles.dot} />
              <span className={styles.perfBadge}>{node.performance}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Рекурсивный вызов TreeNodeItem для дочерних веток с поддержкой плавной CSS-анимации (Шаг 3 ТЗ) */}
      {hasChildren && (
        <div className={`${styles.childrenWrapper} ${node.isExpanded ? styles.childrenExpanded : ''}`}>
          <ul className={styles.childrenContainer}>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.id}
                node={child}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                onToggleNode={onToggleNode}
                recentUpdates={recentUpdates}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
};

// Экспортируемый основной компонент дерева
export const TreeView: React.FC<TreeViewProps> = ({
  tree,
  selectedNodeId,
  onSelectNode,
  onToggleNode,
  recentUpdates,
}) => {
  return (
    <div className={styles.treeContainer}>
      <ul className={styles.treeList}>
        {tree.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onToggleNode={onToggleNode}
            recentUpdates={recentUpdates}
          />
        ))}
      </ul>
    </div>
  );
};
