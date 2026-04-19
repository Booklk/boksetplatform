import axios from 'axios';
import { captureError } from './sentry';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    // Report 5xx server errors to Sentry
    if (err.response?.status >= 500) {
      captureError(err, {
        url: err.config?.url,
        method: err.config?.method,
        status: err.response?.status,
      });
    }
    return Promise.reject(err);
  }
);

export default api;
