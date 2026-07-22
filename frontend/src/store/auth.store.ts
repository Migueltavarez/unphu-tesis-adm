import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import { User } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: User, accessToken?: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await authApi.login(email, password);
          Cookies.set('accessToken', data.accessToken, { expires: 7, secure: true, sameSite: 'strict' });
          Cookies.set('refreshToken', data.refreshToken, { expires: 30, secure: true, sameSite: 'strict' });
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        // Revoca el refresh token en el servidor (best-effort) antes de limpiar.
        const refreshToken = Cookies.get('refreshToken');
        authApi.logout(refreshToken).catch(() => {});
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      refreshUser: async () => {
        try {
          const user = await authApi.me();
          set({ user, isAuthenticated: true });
        } catch {
          get().logout();
        }
      },

      setUser: (user, accessToken) => set({
        user,
        isAuthenticated: true,
        ...(accessToken ? { accessToken } : {}),
      }),
    }),
    {
      name: 'unphu-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
