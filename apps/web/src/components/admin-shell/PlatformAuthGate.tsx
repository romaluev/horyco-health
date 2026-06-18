'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { bootstrapStaffSession } from '@/lib/staff-auth';
import { jwtKind } from '@/lib/jwt';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { StaffLoginCard } from './StaffLoginCard';

interface PlatformAuthGateProps {
  children: ReactNode;
  allowSetup?: boolean;
}

export function PlatformAuthGate({ children, allowSetup = false }: PlatformAuthGateProps) {
  const t = useT();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const client = useAuthStore((s) => s.client);
  const status = useAuthStore((s) => s.status);
  const logoutStaff = useAuthStore((s) => s.logoutStaff);
  const [booted, setBooted] = useState(false);
  const [verified, setVerified] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === 'idle') {
      void bootstrapStaffSession().finally(() => setBooted(true));
    } else {
      setBooted(true);
    }
  }, [status]);

  useEffect(() => {
    void api<{ needsSetup: boolean }>('/platform/setup-status', { token: '' })
      .then((r) => setNeedsSetup(r.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    if (!booted || needsSetup === null) return;
    if (needsSetup && !allowSetup) {
      router.replace('/platform/setup/');
      return;
    }
    if (!token) {
      setVerified(false);
      return;
    }
    const kind = jwtKind(token);
    if (kind !== 'platform') {
      setVerified(false);
      return;
    }
    api('/platform/metrics', { token })
      .then(() => setVerified(true))
      .catch(() => setVerified(false));
  }, [booted, token, needsSetup, allowSetup, router]);

  if (!booted || needsSetup === null || status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      </div>
    );
  }

  if (needsSetup && allowSetup) {
    return <>{children}</>;
  }

  if (!token || jwtKind(token) !== 'platform' || !verified) {
    const kind = jwtKind(token);
    if (token && kind === 'staff' && client) {
      return (
        <div className="flex min-h-svh items-center justify-center p-6">
          <div className="bg-card w-full max-w-md rounded-xl border p-7 shadow-sm">
            <h1 className="mb-2 text-xl font-semibold">{t('platform_denied')}</h1>
            <p className="text-muted-foreground mb-4 text-sm">
              {client.name} — {t('platform_staff_logged_in')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" asChild>
                <Link href="/b/">{t('platform_go_backoffice')}</Link>
              </Button>
              <Button type="button" variant="outline" onClick={() => logoutStaff()}>
                {t('platform_login_different')}
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <StaffLoginCard
        titleKey="platform_login"
        hintKey="platform_login_hint"
      />
    );
  }

  return <>{children}</>;
}
