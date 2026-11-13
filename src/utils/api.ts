// rubiks-cube/src/utils/api.ts

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  nickname: string;
  avatar: string | null;
  bio: string;
  wca_id: string;
  favorite_puzzle: string;
  elo_rating?: number;
  peak_elo?: number;
  duels_won?: number;
  duels_lost?: number;
  win_streak?: number;
  best_win_streak?: number;
  best_single_time?: number | null;
  winrate?: number;
  total_duels?: number;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  cube_sensitivity: number;
  sound_enabled: boolean;
  custom_colors: {
    U: string;
    D: string;
    F: string;
    B: string;
    L: string;
    R: string;
  };
  keybindings: Record<string, string>;
  updated_at: string;
}

export interface UserDetail {
  id: number;
  username: string;
  email: string;
  profile: UserProfile;
  settings: UserSettings;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface WCARecord {
  wca_id: string;
  name: string;
  country: string;
  medals: {
    gold?: number;
    silver?: number;
    bronze?: number;
    total?: number;
  };
  records_333: {
    single: string;
    average: string;
  };
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || errorData.error || JSON.stringify(errorData) || `Ошибка HTTP: ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}
