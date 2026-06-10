'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { initTelegram, applyTheme, waitForInitData } from '@/lib/telegram';
import { bootstrapAuth } from '@/lib/auth';

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
    void (async () => {
      await waitForInitData(); // дождаться telegram-web-app.js, если мы в Mini App
      initTelegram();
      applyTheme();
      await bootstrapAuth();
    })();
  }, []);

  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
