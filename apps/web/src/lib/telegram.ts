/**
 * Доступ к Telegram WebApp SDK (window.Telegram.WebApp) и темизация.
 * Скрипт telegram-web-app.js подключён в layout. Вне Telegram WebApp == null.
 */
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  ready(): void;
  expand(): void;
  openTelegramLink(url: string): void;
  onEvent(event: string, cb: () => void): void;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function getInitData(): string {
  return getWebApp()?.initData ?? '';
}

/**
 * start_param Mini App (из ?startapp=... — напр. кнопка «Подробнее» под постом в канал).
 * Берём из SDK; фолбэк — tgWebAppStartParam в URL (hash/query) до инициализации SDK.
 */
export function getStartParam(): string {
  const fromSdk = getWebApp()?.initDataUnsafe?.start_param;
  if (fromSdk) return fromSdk;
  if (typeof window === 'undefined') return '';
  const probe = window.location.hash + '&' + window.location.search;
  const m = probe.match(/[#&?]tgWebAppStartParam=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/** Запущены ли мы внутри Telegram (есть подписанная initData). */
export function isTelegram(): boolean {
  return getInitData().length > 0;
}

/**
 * Похоже ли, что мы открыты как Mini App, даже если SDK ещё не распарсил данные.
 * Telegram кладёт tgWebApp* во фрагмент/квери URL до инициализации telegram-web-app.js.
 */
export function isLikelyTelegram(): boolean {
  if (typeof window === 'undefined') return false;
  if (getInitData().length > 0) return true;
  const probe = window.location.hash + window.location.search;
  return probe.includes('tgWebAppData') || probe.includes('tgWebAppPlatform');
}

/**
 * Дождаться, пока SDK Telegram заполнит initData (скрипт мог ещё не выполниться к моменту
 * первого рендера). Если мы явно НЕ в Telegram — не ждём. Иначе поллим до таймаута.
 */
export function waitForInitData(timeoutMs = 3000): Promise<string> {
  return new Promise((resolve) => {
    const now = getInitData();
    if (now) return resolve(now);
    if (!isLikelyTelegram()) return resolve('');
    const start = Date.now();
    const timer = setInterval(() => {
      const data = getInitData();
      if (data || Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve(data);
      }
    }, 50);
  });
}

export function initTelegram(): void {
  const wa = getWebApp();
  if (!wa) return;
  wa.ready();
  wa.expand();
  wa.onEvent('themeChanged', applyTheme);
}

/** Применить тему: data-theme на <html> + проброс themeParams в CSS-переменные. */
export function applyTheme(): void {
  if (typeof document === 'undefined') return;
  const wa = getWebApp();
  const scheme =
    wa?.colorScheme ??
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = scheme;
  document.documentElement.classList.toggle('dark', scheme === 'dark');

  const tp = wa?.themeParams ?? {};
  for (const [k, v] of Object.entries(tp)) {
    document.documentElement.style.setProperty(`--tg-theme-${k.replace(/_/g, '-')}`, v);
  }
}

export function openTelegram(url: string): void {
  getWebApp()?.openTelegramLink(url);
}

export type HapticKind = 'light' | 'medium' | 'selection' | 'success' | 'error' | 'warning';

/** Telegram haptic feedback (no-op outside Mini App). */
export function haptic(kind: HapticKind = 'light'): void {
  const hf = getWebApp()?.HapticFeedback;
  if (!hf) return;
  switch (kind) {
    case 'light':
      hf.impactOccurred('light');
      break;
    case 'medium':
      hf.impactOccurred('medium');
      break;
    case 'selection':
      hf.selectionChanged();
      break;
    case 'success':
      hf.notificationOccurred('success');
      break;
    case 'error':
      hf.notificationOccurred('error');
      break;
    case 'warning':
      hf.notificationOccurred('warning');
      break;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
