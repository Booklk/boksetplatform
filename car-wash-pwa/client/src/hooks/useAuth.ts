import { create } from 'zustand';
import api from '../lib/api';

export interface User {
  id: number;
  name: string;
  phone: string;
  email?: string;
  role: 'super_admin' | 'vendor_admin' | 'admin' | 'employee' | 'customer';
  vendorId?: number;
  vendor?: {
    id: number;
    nameAr: string;
    slug: string;
    logoUrl?: string;
    primaryColor?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    paymentConfig?: Record<string, unknown> | null;
  };
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  init: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,

  login: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Set api default header
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, token: null });
  },

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) { set({ isLoading: false }); return; }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
