import axios from 'axios';

// Dynamically compute API base URL:
// In Vite dev mode (port 5173), direct requests to the Go backend on http://localhost:8080.
// In production, use a relative path to route requests through the Nginx reverse proxy.
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return window.location.port === '5173' ? 'http://localhost:8080' : '';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to log response errors for easier debugging
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
