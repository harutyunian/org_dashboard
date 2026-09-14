package handler

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"test_task/backend/internal/model"
	"test_task/backend/internal/service"
)

// Настройка Upgrader для перевода HTTP в WebSocket протокол
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // В dev режиме разрешаем CORS для подключений с Vite (порт 5173)
	},
}

// WSUpdatePatch представляет структуру патча, рассылаемого клиентам.
type WSUpdatePatch struct {
	ID          string    `json:"id"`
	Headcount   int       `json:"headcount"`
	Budget      float64   `json:"budget"`
	Performance int       `json:"performance"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// WSHandler управляет WebSocket соединениями и фоновыми обновлениями.
type WSHandler struct {
	service service.OrgService
	clients map[*websocket.Conn]bool
	mu      sync.Mutex // Спин-лок для потокобезопасной работы с картой клиентов
}

// NewWSHandler инициализирует обработчик WebSockets и запускает фоновый генератор обновлений.
func NewWSHandler(orgService service.OrgService) *WSHandler {
	h := &WSHandler{
		service: orgService,
		clients: make(map[*websocket.Conn]bool),
	}

	// Запускаем фоновый таймер обновлений в отдельной горутине Go
	go h.startMockUpdates()

	return h
}

// HandleWS — эндпоинт Gin для подключения клиентов по WebSocket.
func (h *WSHandler) HandleWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection to WebSocket: %v", err)
		return
	}

	h.registerClient(conn)

	// Ожидаем чтение сообщений (нужно для отслеживания закрытия сокета клиентом)
	go func() {
		defer func() {
			h.unregisterClient(conn)
			conn.Close()
		}()

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				// Ошибка чтения означает, что клиент отключился
				break
			}
		}
	}()
}

// Регистрация нового сокет-клиента
func (h *WSHandler) registerClient(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
	log.Printf("New WebSocket client connected. Active clients count: %d", len(h.clients))
}

// Удаление отключившегося сокет-клиента
func (h *WSHandler) unregisterClient(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, conn)
	log.Printf("WebSocket client disconnected. Active clients count: %d", len(h.clients))
}

// Рассылка патча всем активным клиентам
func (h *WSHandler) broadcastPatch(patch *WSUpdatePatch) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if len(h.clients) == 0 {
		return
	}

	message, err := json.Marshal(patch)
	if err != nil {
		log.Printf("Failed to marshal WS patch: %v", err)
		return
	}

	for client := range h.clients {
		err := client.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Printf("Failed to send message to client, closing conn: %v", err)
			client.Close()
			delete(h.clients, client)
		}
	}
}

// startMockUpdates запускает фоновый бесконечный цикл, изменяющий случайную команду каждые 5 секунд.
func (h *WSHandler) startMockUpdates() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	for range ticker.C {
		// Проверяем, есть ли активные клиенты. Если нет — экономим ресурсы процессора и СУБД
		h.mu.Lock()
		clientsCount := len(h.clients)
		h.mu.Unlock()

		if clientsCount == 0 {
			continue // Пропускаем итерацию, если никто не смотрит дашборд
		}

		ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
		
		// 1. Получаем все текущие узлы
		nodes, err := h.service.GetOrgTree(ctx)
		if err != nil {
			log.Printf("WS Mock generator: failed to fetch nodes: %v", err)
			cancel()
			continue
		}

		// 2. Отбираем только узлы команд (id начинается на "team_") для реалистичности
		var teams []*model.OrgNode
		for _, n := range nodes {
			if n.ID != "root" && len(n.ID) > 5 && n.ID[:5] == "team_" {
				teams = append(teams, n)
			}
		}

		if len(teams) == 0 {
			cancel()
			continue
		}

		// 3. Выбираем случайную команду
		targetTeam := teams[r.Intn(len(teams))]

		// 4. Генерируем изменения показателей
		// Изменение headcount: -1, 0, или +1 (держим в диапазоне 2 - 12 человек)
		hcDelta := r.Intn(3) - 1 // -1, 0, 1
		newHeadcount := targetTeam.Headcount + hcDelta
		if newHeadcount < 2 {
			newHeadcount = 2
			hcDelta = 0
		} else if newHeadcount > 12 {
			newHeadcount = 12
			hcDelta = 0
		}

		// Изменение бюджета пропорционально людям или случайное (держим в рамках 100k - 500k)
		budgetDelta := float64(hcDelta) * 45000.0 // за каждого человека +/- 45к руб
		if hcDelta == 0 {
			// Если headcount не поменялся, даем микро-колебание бюджета +/- 5000 руб
			budgetDelta = float64(r.Intn(3)-1) * 5000.0
		}
		newBudget := targetTeam.Budget + budgetDelta
		if newBudget < 100000.0 {
			newBudget = 100000.0
		} else if newBudget > 500000.0 {
			newBudget = 500000.0
		}

		// Изменение performance: +/- от 1 до 5 процентов (держим в диапазоне 40% - 100%)
		perfDelta := (r.Intn(10) - 5) // от -5 до +4%
		newPerf := targetTeam.Performance + perfDelta
		if newPerf < 40 {
			newPerf = 40
		} else if newPerf > 100 {
			newPerf = 100
		}

		// 5. Записываем изменения в PostgreSQL
		updatedNode, err := h.service.UpdateNode(ctx, targetTeam.ID, newHeadcount, newBudget, newPerf)
		if err != nil {
			log.Printf("WS Mock generator: failed to update node %s in DB: %v", targetTeam.ID, err)
			cancel()
			continue
		}

		cancel() // Освобождаем контекст

		// 6. Формируем патч и рассылаем клиентам
		patch := &WSUpdatePatch{
			ID:          updatedNode.ID,
			Headcount:   updatedNode.Headcount,
			Budget:      updatedNode.Budget,
			Performance: updatedNode.Performance,
			UpdatedAt:   updatedNode.UpdatedAt,
		}

		log.Printf("Live-Update Broadcast: Node %s (%s) updated. Headcount: %d, Budget: %.0f, Performance: %d%%",
			patch.ID, targetTeam.Name, patch.Headcount, patch.Budget, patch.Performance)

		h.broadcastPatch(patch)
	}
}
