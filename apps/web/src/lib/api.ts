import { getAuthToken, useAuthStore } from '@/store/auth.store';
import { jwtKind } from '@/lib/jwt';

const BASE = '/api';

/**
 * Сброс сессии при 401 в зависимости от вида токена:
 *  - staff/platform → чистим стафф-сессию (вход для сотрудников/платформы);
 *  - customer (или неизвестно) → клиентский logout (web-anon).
 */
function handleUnauthorized(token: string | null | undefined) {
  const kind = jwtKind(token);
  if (kind === 'staff' || kind === 'platform') {
    useAuthStore.getState().logoutStaff();
  } else {
    useAuthStore.getState().logout();
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Явный токен (для авторизации до сохранения в стор) или '' чтобы не слать. */
  token?: string;
}

/** Запрос к API под /api с JWT из стора; ошибки → ApiError (формат ExceptionFilter). */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = opts.token ?? getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    // Просроченный / невалидный токен: сбрасываем нужную сессию, чтобы не зациклиться на 401.
    if (res.status === 401) {
      handleUnauthorized(token);
    }
    const err = (await res.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    throw new ApiError(res.status, err?.message || res.statusText, err?.error);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Загрузка файла (multipart) под /api с JWT. Content-Type ставит браузер (boundary). */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);

  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized(token);
    }
    const err = (await res.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    throw new ApiError(res.status, err?.message || res.statusText, err?.error);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
