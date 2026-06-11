'use client';

import { useAuthStore } from '@/store/auth.store';
import { bootstrapAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { isLikelyTelegram } from '@/lib/telegram';
import { WebAuth } from './WebAuth';

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: 24,
        textAlign: 'center',
        color: 'var(--hint)',
      }}
    >
      {children}
    </div>
  );
}

/** Гейт сессии: пока нет JWT — показывает статус (загрузка / вне Telegram / ошибка). */
export function AppGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const t = useT();

  if (status === 'idle' || status === 'loading') return <Center>{t('loading')}</Center>;
  if (status === 'missing-biz' || (status === 'web-anon' && isLikelyTelegram())) {
    return (
      <Center>
        <div style={{ fontSize: 18, color: 'var(--text)' }}>{t('missing_biz')}</div>
        <div>{t('missing_biz_hint')}</div>
      </Center>
    );
  }
  if (status === 'web-anon') return <WebAuth />;
  if (status === 'error') {
    return (
      <Center>
        <div>{t('error_generic')}</div>
        <button className="btn" onClick={() => void bootstrapAuth()}>
          {t('retry')}
        </button>
      </Center>
    );
  }
  return <>{children}</>;
}
