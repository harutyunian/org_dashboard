package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"
	"test_task/backend/internal/model"
)

// Repository описывает интерфейс взаимодействия со слоем хранения данных.
// Любая СУБД должна реализовывать эти методы.
type Repository interface {
	GetAllNodes(ctx context.Context) ([]*model.OrgNode, error)
	GetNodeByID(ctx context.Context, id string) (*model.OrgNode, error)
	UpdateNode(ctx context.Context, id string, headcount int, budget float64, performance int) (*model.OrgNode, error)
	SeedNodes(ctx context.Context, nodes []*model.OrgNode) error
	IsEmpty(ctx context.Context) (bool, error)
}

// PostgresRepository — реализация интерфейса Repository для работы с СУБД PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

// NewPostgresRepository инициализирует новый экземпляр репозитория PostgreSQL.
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// GetAllNodes возвращает плоский массив всех узлов орг-структуры из БД.
func (r *PostgresRepository) GetAllNodes(ctx context.Context) ([]*model.OrgNode, error) {
	query := `
		SELECT id, name, parent_id, headcount, budget, performance, updated_at 
		FROM org_nodes
		ORDER BY id ASC`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query all nodes: %w", err)
	}
	defer rows.Close()

	var nodes []*model.OrgNode
	for rows.Next() {
		var node model.OrgNode
		err := rows.Scan(
			&node.ID,
			&node.Name,
			&node.ParentID, // Автоматически замаппит NULL в nil-указатель
			&node.Headcount,
			&node.Budget,
			&node.Performance,
			&node.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan node row: %w", err)
		}
		nodes = append(nodes, &node)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	return nodes, nil
}

// GetNodeByID получает конкретный узел по его уникальному ID.
func (r *PostgresRepository) GetNodeByID(ctx context.Context, id string) (*model.OrgNode, error) {
	query := `
		SELECT id, name, parent_id, headcount, budget, performance, updated_at 
		FROM org_nodes 
		WHERE id = $1`

	row := r.db.QueryRowContext(ctx, query, id)

	var node model.OrgNode
	err := row.Scan(
		&node.ID,
		&node.Name,
		&node.ParentID,
		&node.Headcount,
		&node.Budget,
		&node.Performance,
		&node.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("node not found with id %s", id)
	} else if err != nil {
		return nil, fmt.Errorf("failed to scan node by id: %w", err)
	}

	return &node, nil
}

// UpdateNode обновляет показатели узла и возвращает обновленное состояние.
// Это понадобится для Live-обновлений (Шаг 3).
func (r *PostgresRepository) UpdateNode(ctx context.Context, id string, headcount int, budget float64, performance int) (*model.OrgNode, error) {
	query := `
		UPDATE org_nodes
		SET headcount = $1, budget = $2, performance = $3, updated_at = $4
		WHERE id = $5
		RETURNING id, name, parent_id, headcount, budget, performance, updated_at`

	now := time.Now()
	row := r.db.QueryRowContext(ctx, query, headcount, budget, performance, now, id)

	var node model.OrgNode
	err := row.Scan(
		&node.ID,
		&node.Name,
		&node.ParentID,
		&node.Headcount,
		&node.Budget,
		&node.Performance,
		&node.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("node not found for update with id %s", id)
	} else if err != nil {
		return nil, fmt.Errorf("failed to update node and scan returning values: %w", err)
	}

	return &node, nil
}

// IsEmpty проверяет, пуста ли таблица org_nodes.
func (r *PostgresRepository) IsEmpty(ctx context.Context) (bool, error) {
	var count int
	query := "SELECT COUNT(*) FROM org_nodes"
	err := r.db.QueryRowContext(ctx, query).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to count nodes: %w", err)
	}
	return count == 0, nil
}

// SeedNodes наполняет базу данных начальным набором узлов (mock-данными) в рамках транзакции.
func (r *PostgresRepository) SeedNodes(ctx context.Context, nodes []*model.OrgNode) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	query := `
		INSERT INTO org_nodes (id, name, parent_id, headcount, budget, performance, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	stmt, err := tx.PrepareContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, node := range nodes {
		_, err := stmt.ExecContext(
			ctx,
			node.ID,
			node.Name,
			node.ParentID,
			node.Headcount,
			node.Budget,
			node.Performance,
			node.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to execute insert for node %s: %w", node.ID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
