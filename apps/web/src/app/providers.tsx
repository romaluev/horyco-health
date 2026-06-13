'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { initTelegram, applyTheme, waitForInitData } from '@/lib/telegram';
import { bootstrapAuth } from '@/lib/auth';
import { bootstrapStaffSession } from '@/lib/staff-auth';
import { Toaster } from '@/components/ui/sonner';

/** Роуты back office / платформы используют стафф/платформенную сессию, не клиентскую. */
function isStaffRoute(pathname: string): boolean {
  return pathname.startsWith('/b') || pathname.startsWith('/platform');
}

/** Клиентские провайдеры: TanStack Query + инициализация Telegram/темы/авторизации. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
        },
      }),
  );

  useEffect(() => {
    applyTheme(); // мгновенная тема (системная), уточнится после готовности SDK
    const staffRoute =
      typeof window !== 'undefined' && isStaffRoute(window.location.pathname);
    void (async () => {
      await waitForInitData(); // дождаться telegram-web-app.js, если мы в Mini App
      initTelegram();
      applyTheme();
      // На /b и /platform не запускаем клиентский bootstrapAuth, чтобы клиентский
      // JWT не подменял стафф/платформенную сессию (race + утечка прав).
      if (staffRoute) {
        await bootstrapStaffSession();
      } else {
        await bootstrapAuth();
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
