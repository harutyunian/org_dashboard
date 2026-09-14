package service

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"time"
	"test_task/backend/internal/model"
	"test_task/backend/internal/repository"
)

// OrgService описывает интерфейс бизнес-логики управления орг-структурой.
type OrgService interface {
	InitSchema(ctx context.Context) error
	SeedDataIfEmpty(ctx context.Context) error
	GetOrgTree(ctx context.Context) ([]*model.OrgNode, error)
	UpdateNode(ctx context.Context, id string, headcount int, budget float64, performance int) (*model.OrgNode, error)
}

// OrgServiceImpl — реализация интерфейса OrgService.
type OrgServiceImpl struct {
	repo repository.Repository
	db   *sql.DB // Нужен напрямую для выполнения авто-миграции схемы таблицы
}

// NewOrgService инициализирует новый сервис орг-структуры.
func NewOrgService(repo repository.Repository, db *sql.DB) *OrgServiceImpl {
	return &OrgServiceImpl{
		repo: repo,
		db:   db,
	}
}

// InitSchema создает таблицу org_nodes, если она отсутствует в БД.
func (s *OrgServiceImpl) InitSchema(ctx context.Context) error {
	query := `
	CREATE TABLE IF NOT EXISTS org_nodes (
		id VARCHAR(50) PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		parent_id VARCHAR(50) REFERENCES org_nodes(id) ON DELETE SET NULL,
		headcount INT NOT NULL DEFAULT 0,
		budget NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
		performance INT NOT NULL CHECK (performance >= 0 AND performance <= 100),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_org_nodes_parent_id ON org_nodes(parent_id);
	`
	_, err := s.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to initialize db schema: %w", err)
	}
	return nil
}

// GetOrgTree возвращает плоский массив всех узлов орг-структуры.
func (s *OrgServiceImpl) GetOrgTree(ctx context.Context) ([]*model.OrgNode, error) {
	return s.repo.GetAllNodes(ctx)
}

// UpdateNode обновляет показатели узла.
func (s *OrgServiceImpl) UpdateNode(ctx context.Context, id string, headcount int, budget float64, performance int) (*model.OrgNode, error) {
	return s.repo.UpdateNode(ctx, id, headcount, budget, performance)
}

// SeedDataIfEmpty проверяет наполненность БД и генерирует 42 реалистичных узла в иерархии.
func (s *OrgServiceImpl) SeedDataIfEmpty(ctx context.Context) error {
	empty, err := s.repo.IsEmpty(ctx)
	if err != nil {
		return fmt.Errorf("failed to check if db is empty: %w", err)
	}

	if !empty {
		return nil // БД уже наполнена, пропускаем сидинг
	}

	fmt.Println("Database is empty. Generating mock organizational structure...")

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	now := time.Now()

	// 1. Корень орг-структуры (Level 0)
	root := &model.OrgNode{
		ID:          "root",
		Name:        "Группа Компаний ПУЛЬС",
		ParentID:    nil,
		Headcount:   25, // Штаб-квартира
		Budget:      5000000.00,
		Performance: 88,
		UpdatedAt:   now,
	}

	var nodes []*model.OrgNode
	nodes = append(nodes, root)

	// Вспомогательная функция генерации случайных чисел в диапазоне
	randBetween := func(min, max int) int {
		return r.Intn(max-min+1) + min
	}

	// 2. Дивизионы (Level 1) — 3 дивизиона
	divisions := []struct {
		id   string
		name string
	}{
		{"div_eng", "Дивизион Разработки и Технологий"},
		{"div_prod", "Дивизион Продуктов и UI/UX"},
		{"div_mkt", "Дивизион Маркетинга и Продаж"},
	}

	for _, div := range divisions {
		nodes = append(nodes, &model.OrgNode{
			ID:          div.id,
			Name:        div.name,
			ParentID:    &root.ID,
			Headcount:   randBetween(8, 15),
			Budget:      float64(randBetween(2000000, 4000000)),
			Performance: randBetween(75, 95),
			UpdatedAt:   now,
		})
	}

	// 3. Отделы (Level 2) — привязаны к дивизионам (всего 9 отделов)
	departments := map[string][]struct {
		id   string
		name string
	}{
		"div_eng": {
			{"dept_backend", "Отдел Бэкенд-разработки"},
			{"dept_frontend", "Отдел Фронтенд-разработки"},
			{"dept_qa", "Отдел Контроля Качества"},
			{"dept_devops", "Отдел Инфраструктуры и DevOps"},
		},
		"div_prod": {
			{"dept_pm", "Отдел Управления Продуктами"},
			{"dept_design", "Отдел UI/UX Дизайна"},
			{"dept_research", "Отдел Исследований Пользователей"},
		},
		"div_mkt": {
			{"dept_sales", "Отдел Продаж B2B"},
			{"dept_marketing", "Отдел Цифрового Маркетинга"},
		},
	}

	// 4. Команды (Level 3) — привязаны к отделам (всего 29 команд)
	teams := map[string][]struct {
		id   string
		name string
	}{
		// Разработка
		"dept_backend": {
			{"team_be_core", "Команда Ядра API"},
			{"team_be_data", "Команда Обработки Данных"},
			{"team_be_billing", "Команда Биллинга и Оплат"},
			{"team_be_auth", "Команда Безопасности и Авторизации"},
		},
		"dept_frontend": {
			{"team_fe_dash", "Команда Дашбордов"},
			{"team_fe_landing", "Команда Промо-страниц"},
			{"team_fe_system", "Команда Дизайн-системы"},
		},
		"dept_qa": {
			{"team_qa_auto", "Группа Автотестирования Go/JS"},
			{"team_qa_manual", "Группа Ручного Тестирования"},
			{"team_qa_load", "Группа Нагрузочного Тестирования"},
		},
		"dept_devops": {
			{"team_devops_k8s", "Группа Kubernetes и Cloud"},
			{"team_devops_cicd", "Группа CI/CD Автоматизации"},
		},
		// Продукт и Дизайн
		"dept_pm": {
			{"team_pm_growth", "Команда Роста и Метрик (Growth)"},
			{"team_pm_core", "Команда Основного Продукта"},
			{"team_pm_b2b", "Команда PM B2B-продуктов"},
		},
		"dept_design": {
			{"team_design_visual", "Группа Визуального Стиля"},
			{"team_design_ux", "Группа UX-Проектирования"},
			{"team_design_research", "Группа Прототипирования"},
		},
		"dept_research": {
			{"team_res_interviews", "Группа Глубинных Интервью"},
			{"team_res_analytics", "Группа Количественной Аналитики"},
		},
		// Маркетинг и Продажи
		"dept_sales": {
			{"team_sales_enterprise", "Группа Крупных Клиентов (Enterprise)"},
			{"team_sales_smb", "Группа Среднего и Малого Бизнеса"},
			{"team_sales_support", "Группа Пресейл Поддержки"},
			{"team_sales_success", "Команда Успеха Клиентов (Customer Success)"},
		},
		"dept_marketing": {
			{"team_mkt_seo", "Группа Поискового Маркетинга (SEO)"},
			{"team_mkt_paid", "Группа Таргетированной Рекламы"},
			{"team_mkt_pr", "Группа Связей с Общественностью (PR)"},
			{"team_mkt_content", "Группа Контент-маркетинга"},
			{"team_mkt_copy", "Группа Копирайтинга"},
		},
	}

	// Генерируем отделы
	for divID, depts := range departments {
		for _, dept := range depts {
			nodes = append(nodes, &model.OrgNode{
				ID:          dept.id,
				Name:        dept.name,
				ParentID:    &divID,
				Headcount:   randBetween(4, 10),
				Budget:      float64(randBetween(800000, 1800000)),
				Performance: randBetween(60, 95),
				UpdatedAt:   now,
			})

			// Генерируем команды для текущего отдела
			if list, ok := teams[dept.id]; ok {
				for _, team := range list {
					nodes = append(nodes, &model.OrgNode{
						ID:          team.id,
						Name:        team.name,
						ParentID:    &dept.id,
						Headcount:   randBetween(3, 8),
						Budget:      float64(randBetween(150000, 450000)),
						Performance: randBetween(40, 100), // Команды имеют более широкий разброс эффективности
						UpdatedAt:   now,
					})
				}
			}
		}
	}

	// Общее число сгенерированных узлов:
	// 1 (Корень) + 3 (Дивизиона) + 9 (Отделов) + 29 (Команд) = 42 узла.
	// Это идеально соответствует ТЗ ("Минимум 40 узлов, не менее трех уровней вложенности")
	err = s.repo.SeedNodes(ctx, nodes)
	if err != nil {
		return fmt.Errorf("failed to seed organization nodes: %w", err)
	}

	fmt.Printf("Seeding complete. Successfully generated %d organization nodes!\n", len(nodes))
	return nil
}
