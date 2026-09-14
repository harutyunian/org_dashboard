package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq" // Драйвер PostgreSQL

	"test_task/backend/internal/handler"
	"test_task/backend/internal/repository"
	"test_task/backend/internal/service"
)

func main() {
	// 1. Считываем переменные окружения для подключения к БД (или используем дефолтные для локального запуска)
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPass := getEnv("DB_PASSWORD", "1234")
	dbName := getEnv("DB_NAME", "test_task")
	dbSSL := getEnv("DB_SSLMODE", "disable")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPass, dbName, dbSSL)

	log.Printf("Connecting to PostgreSQL at %s:%s...", dbHost, dbPort)

	// 2. Подключение к БД с механизмом повторных попыток (Retry Logic)
	var db *sql.DB
	var err error
	maxRetries := 5
	for i := 1; i <= maxRetries; i++ {
		db, err = sql.Open("postgres", connStr)
		if err == nil {
			// Проверяем реальное соединение через Ping
			err = db.Ping()
			if err == nil {
				break
			}
		}

		log.Printf("[Attempt %d/%d] Postgres is not ready yet, retrying in 2 seconds... Error: %v", i, maxRetries, err)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatalf("Could not connect to PostgreSQL after %d attempts: %v", maxRetries, err)
	}
	defer db.Close()

	log.Println("Successfully connected to PostgreSQL database!")

	// Настройки пула соединений (Best Practices для Go)
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	// 3. Инициализация слоев
	repo := repository.NewPostgresRepository(db)
	orgService := service.NewOrgService(repo, db)

	// 4. Запуск авто-миграции схемы и сид-генератора
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := orgService.InitSchema(ctx); err != nil {
		log.Fatalf("Failed to initialize DB schema: %v", err)
	}

	if err := orgService.SeedDataIfEmpty(ctx); err != nil {
		log.Fatalf("Failed to seed initial data: %v", err)
	}

	// 5. Настройка роутера Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	// Логирование и восстановление при паниках
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS Middleware (ручная чистая реализация)
	r.Use(corsMiddleware())

	// Настройка WebSocket сервера
	wsHandler := handler.NewWSHandler(orgService)
	r.GET("/ws", wsHandler.HandleWS)

	// Настройка роутов API
	r.GET("/api/org-tree", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		nodes, err := orgService.GetOrgTree(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, nodes)
	})

	// Системный роут проверки здоровья (Health Check)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Запуск HTTP сервера
	port := getEnv("PORT", "8080")
	log.Printf("Server starting on port %s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to run HTTP server: %v", err)
	}
}

// Вспомогательная функция для чтения env-переменных
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// corsMiddleware возвращает обработчик, который настраивает CORS заголовки.
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*") // В dev-режиме разрешаем всё, либо можно http://localhost:5173
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
