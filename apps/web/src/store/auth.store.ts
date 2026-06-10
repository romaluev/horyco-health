import { create } from 'zustand';
import { ClientDto } from '@/lib/types';

export type AuthStatus = 'idle' | 'loading' | 'authed' | 'web-anon' | 'error';

const TOKEN_KEY = 'eatfit-token';

export function getSavedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* недоступно при пререндере — игнор */
  }
}

interface AuthState {
  token: string | null;
  client: ClientDto | null;
  status: AuthStatus;
  error?: string;
  setAuth: (token: string, client: ClientDto) => void;
  setClient: (client: ClientDto) => void;
  setStatus: (status: AuthStatus, error?: string) => void;
  logout: () => void;
}

/** Сессия: JWT + профиль. Токен персистится (нужен веб-аккаунтам между перезагрузками). */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  client: null,
  status: 'idle',
  setAuth: (token, client) => {
    saveToken(token);
    set({ token, client, status: 'authed', error: undefined });
  },
  setClient: (client) => set({ client }),
  setStatus: (status, error) => set({ status, error }),
  logout: () => {
    saveToken(null);
    set({ token: null, client: null, status: 'web-anon' });
  },
}));

export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}
