import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiRequest } from '../utils/api';
import type { 
  UserDetail, 
  AuthTokens, 
  UserProfile, 
  UserSettings, 
  WCARecord 
} from '../utils/api';

interface AuthState {
  user: UserDetail | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    email?: string;
    password: string;
    password_confirm: string;
    nickname?: string;
    wca_id?: string;
  }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateSettings: (data: Partial<UserSettings>) => Promise<void>;
  fetchWCA: (wcaId: string) => Promise<WCARecord>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      clearError: () => set({ error: null }),

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const tokens = await apiRequest<AuthTokens>('/auth/login/', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
          });

          set({ tokens, isAuthenticated: true });

          // Загружаем данные пользователя
          const user = await apiRequest<UserDetail>('/auth/me/', {}, tokens.access);
          set({ user, isLoading: false });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Ошибка при авторизации';
          set({ error: errorMsg, isLoading: false, isAuthenticated: false, tokens: null, user: null });
          throw err;
        }
      },

      register: async (registerData) => {
        set({ isLoading: true, error: null });
        try {
          const res = await apiRequest<{
            user: UserDetail;
            tokens: AuthTokens;
          }>('/auth/register/', {
            method: 'POST',
            body: JSON.stringify(registerData),
          });

          set({
            user: res.user,
            tokens: res.tokens,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Ошибка при регистрации';
          set({ error: errorMsg, isLoading: false });
          throw err;
        }
      },

      logout: () => {
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          error: null,
        });
      },

      fetchMe: async () => {
        const { tokens } = get();
        if (!tokens?.access) return;

        try {
          const user = await apiRequest<UserDetail>('/auth/me/', {}, tokens.access);
          set({ user, isAuthenticated: true });
        } catch {
          // Если токен протух
          set({ user: null, tokens: null, isAuthenticated: false });
        }
      },

      updateProfile: async (data: Partial<UserProfile>) => {
        const { tokens, user } = get();
        if (!tokens?.access || !user) return;

        set({ isLoading: true, error: null });
        try {
          const updatedProfile = await apiRequest<UserProfile>('/profile/', {
            method: 'PATCH',
            body: JSON.stringify(data),
          }, tokens.access);

          set({
            user: { ...user, profile: updatedProfile },
            isLoading: false,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Ошибка обновления профиля';
          set({ error: errorMsg, isLoading: false });
          throw err;
        }
      },

      updateSettings: async (data: Partial<UserSettings>) => {
        const { tokens, user } = get();
        if (!tokens?.access || !user) return;

        set({ isLoading: true, error: null });
        try {
          const updatedSettings = await apiRequest<UserSettings>('/settings/', {
            method: 'PATCH',
            body: JSON.stringify(data),
          }, tokens.access);

          set({
            user: { ...user, settings: updatedSettings },
            isLoading: false,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Ошибка сохранения настроек';
          set({ error: errorMsg, isLoading: false });
          throw err;
        }
      },

      fetchWCA: async (wcaId: string) => {
        return apiRequest<WCARecord>(`/wca/${encodeURIComponent(wcaId)}/`);
      },
    }),
    {
      name: 'rubiks-auth-storage',
      partialize: (state) => ({
        tokens: state.tokens,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
