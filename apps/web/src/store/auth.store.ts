import { create } from 'zustand';
import { ClientDto } from '@/lib/types';
import { getBizSlug } from '@/lib/biz';
import { StaffBusiness } from '@/lib/backoffice-queries';
import { persistStaffSession } from '@/lib/staff-auth';

export type AuthStatus = 'idle' | 'loading' | 'authed' | 'web-anon' | 'missing-biz' | 'error';

const TOKEN_PREFIX = 'eatfit-token';

function tokenKey(slug?: string | null): string {
  return slug ? `${TOKEN_PREFIX}:${slug}` : TOKEN_PREFIX;
}

export function getSavedToken(slug?: string | null): string | null {
  try {
    const key = tokenKey(slug ?? getBizSlug());
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveToken(token: string | null, slug?: string | null) {
  try {
    const key = tokenKey(slug ?? getBizSlug());
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    /* недоступно при пререндере — игнор */
  }
}

interface AuthState {
  token: string | null;
  client: ClientDto | null;
  status: AuthStatus;
  error?: string;
  staffBusinesses: StaffBusiness[];
  activeBusinessSlug: string | null;
  setAuth: (token: string, client: ClientDto) => void;
  setStaffAuth: (token: string, client: ClientDto, businesses: StaffBusiness[], slug: string) => void;
  setClient: (client: ClientDto) => void;
  setStatus: (status: AuthStatus, error?: string) => void;
  logout: () => void;
}

/** Сессия: JWT + профиль. Токен персистится per-biz (eatfit-token:<slug>). */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  client: null,
  status: 'idle',
  staffBusinesses: [],
  activeBusinessSlug: null,
  setAuth: (token, client) => {
    saveToken(token);
    set({ token, client, status: 'authed', error: undefined, staffBusinesses: [], activeBusinessSlug: null });
  },
  setStaffAuth: (token, client, businesses, slug) => {
    persistStaffSession(token, businesses, slug);
    set({
      token,
      client,
      status: 'authed',
      error: undefined,
      staffBusinesses: businesses,
      activeBusinessSlug: slug,
    });
  },
  setClient: (client) => set({ client }),
  setStatus: (status, error) => set({ status, error }),
  logout: () => {
    saveToken(null);
    set({
      token: null,
      client: null,
      status: 'web-anon',
      staffBusinesses: [],
      activeBusinessSlug: null,
    });
  },
}));

export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}
