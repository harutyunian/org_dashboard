# --- ЭТАП 1: Сборка бинарного файла Go ---
FROM golang:1.26-alpine AS builder

# Устанавливаем зависимости сборки
RUN apk add --no-cache git gcc musl-dev

WORKDIR /app

# Сначала копируем файлы модулей для эффективного кэширования слоев Docker
COPY go.mod go.sum ./
RUN go mod download

# Копируем исходный код бэкенда
COPY . .

# Собираем оптимизированный бинарный файл для Linux (без дебаг-символов для уменьшения веса)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server cmd/server/main.go

# --- ЭТАП 2: Создание финального легковесного образа ---
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Копируем бинарник из первого этапа
COPY --from=builder /app/server .

# Открываем порт бэкенда
EXPOSE 8080

# Запускаем сервер
CMD ["./server"]
