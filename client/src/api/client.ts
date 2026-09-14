import axios from 'axios';

// Динамически вычисляем базовый URL API:
// В dev-режиме Vite (порт 5173) бьем напрямую в Go-сервер на http://localhost:8080.
// В продакшене используем относительный путь, чтобы запросы шли через Nginx-прокси.
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return window.location.port === '5173' ? 'http://localhost:8080' : '';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000, // Таймаут запроса 10 секунд для надежности работы сети
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для логирования ошибок в консоль разработчика (удобно для дебага)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error details:', {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
    });
    return Promise.reject(error);
  }
);
