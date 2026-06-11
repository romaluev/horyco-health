import { Language } from '@eatfit/shared';
import { api } from './api';
import { getBizSlug } from './biz';
import { waitForInitData, isLikelyTelegram } from './telegram';
import { useAuthStore, getSavedToken } from '@/store/auth.store';
import { AuthResponse, ClientDto } from './types';

/**
 * Старт сессии:
 *  - в Telegram (есть initData) → JWT через /api/auth/telegram (требует ?biz=);
 *  - вне Telegram → пробуем сохранённый веб-токен (валидируем через /me);
 *  - иначе → статус web-anon (показываем вход/регистрацию на сайте).
 */
export async function bootstrapAuth(): Promise<void> {
  const store = useAuthStore.getState();
  const biz = getBizSlug();
  const initData = await waitForInitData();

  if (initData || isLikelyTelegram()) {
    if (!biz) {
      store.setStatus('missing-biz');
      return;
    }
  }

  if (initData) {
    store.setStatus('loading');
    try {
      const res = await api<AuthResponse>('/auth/telegram', {
        method: 'POST',
        body: { initData, biz },
        token: '',
      });
      store.setAuth(res.accessToken, res.client);
    } catch (e) {
      store.setStatus('error', (e as Error).message);
    }
    return;
  }

  const saved = getSavedToken(biz);
  if (saved) {
    store.setStatus('loading');
    try {
      const client = await api<ClientDto>('/me', { token: saved });
      store.setAuth(saved, client);
      return;
    } catch {
      store.logout();
    }
  }
  store.setStatus('web-anon');
}

export interface WebRegisterInput {
  name: string;
  phone: string;
  password: string;
  address?: string;
  language?: Language;
}

export async function webLogin(phone: string, password: string): Promise<void> {
  const biz = getBizSlug();
  const res = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: biz ? { phone, password, biz } : { phone, password },
    token: '',
  });
  useAuthStore.getState().setAuth(res.accessToken, res.client);
}

export async function webRegister(input: WebRegisterInput): Promise<void> {
  const biz = getBizSlug();
  const res = await api<AuthResponse>('/auth/register', {
    method: 'POST',
    body: biz ? { ...input, biz } : input,
    token: '',
  });
  useAuthStore.getState().setAuth(res.accessToken, res.client);
}
