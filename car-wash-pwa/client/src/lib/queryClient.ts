import api from './api';

// Generic API request wrapper for TanStack Query
export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: unknown
): Promise<T> {
  const res = await api.request<T>({ method, url, data });
  return res.data;
}
