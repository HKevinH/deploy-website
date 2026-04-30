import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, User } from './api';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (email, password) => {
        const { data } = await authApi.login(email, password);
        localStorage.setItem('paas_token', data.token);
        set({ user: data.user, token: data.token });
      },

      register: async (email, password) => {
        const { data } = await authApi.register(email, password);
        localStorage.setItem('paas_token', data.token);
        set({ user: data.user, token: data.token });
      },

      logout: () => {
        localStorage.removeItem('paas_token');
        set({ user: null, token: null });
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'paas-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);
