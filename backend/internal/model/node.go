package model

import "time"

// OrgNode представляет собой узел организационной структуры компании.
// Это может быть дивизион, отдел или конкретная команда.
type OrgNode struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	ParentID    *string   `json:"parentId" db:"parent_id"` // Указатель для поддержки NULL значений в БД
	Headcount   int       `json:"headcount" db:"headcount"`
	Budget      float64   `json:"budget" db:"budget"` // Храним бюджет как float64
	Performance int       `json:"performance" db:"performance"` // Метрика эффективности от 0 до 100
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}
