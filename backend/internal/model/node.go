package model

import "time"

// OrgNode represents a node in the organizational structure.
type OrgNode struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	ParentID    *string   `json:"parentId" db:"parent_id"`
	Headcount   int       `json:"headcount" db:"headcount"`
	Budget      float64   `json:"budget" db:"budget"`
	Performance int       `json:"performance" db:"performance"` // Score from 0 to 100
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}
