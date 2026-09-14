# --- ЭТАП 1: Сборка статических файлов React ---
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем конфиги зависимостей
COPY package*.json ./

# Устанавливаем все зависимости
RUN npm ci

# Копируем исходный код фронтенда
COPY . .

# Собираем продакшн бандл React + Vite
RUN npm run build

# --- ЭТАП 2: Раздача статики через Nginx ---
FROM nginx:stable-alpine

# Копируем скомпилированную статику в веб-папку Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем наш кастомный конфигурационный файл Nginx с gzip и reverse-proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем стандартный HTTP порт
EXPOSE 80

# Запускаем Nginx в фоновом режиме (standard daemon off)
CMD ["nginx", "-g", "daemon off;"]
