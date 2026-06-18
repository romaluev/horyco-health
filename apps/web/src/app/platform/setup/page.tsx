'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { usePlatformSetupStatus } from '@/lib/backoffice-queries';
import { saveStaffToken } from '@/lib/staff-auth';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import type { StaffLoginResponse } from '@/lib/backoffice-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/admin/ui';

export default function PlatformSetupPage() {
  const t = useT();
  const router = useRouter();
  const { data: status } = usePlatformSetupStatus();
  const setStaffAuth = useAuthStore((s) => s.setStaffAuth);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status && !status.needsSetup) {
      router.replace('/platform/');
    }
  }, [status, router]);

  if (!status) {
    return (
      <div className="adm-root adm-login-page">
        <p className="adm-muted">{t('loading')}</p>
      </div>
    );
  }

  if (!status.needsSetup) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<StaffLoginResponse>('/platform/setup', {
        method: 'POST',
        body: { name, phone, password },
        token: '',
      });
      const slug = res.businesses[0]?.slug ?? 'platform';
      saveStaffToken(res.accessToken, slug);
      setStaffAuth(res.accessToken, res.client, res.businesses, slug);
      router.replace('/platform/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-root adm-login-page">
      <div className="adm-login-card">
        <h1>{t('platform_setup_title')}</h1>
        <p className="adm-muted mb-5">{t('platform_setup_hint')}</p>
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <Field label={t('name')} htmlFor="setup-name">
            <Input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label={t('phone')} htmlFor="setup-phone">
            <Input
              id="setup-phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
          <Field label={t('web_password')} htmlFor="setup-password">
            <Input
              id="setup-password"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && (
            <div className="adm-alert adm-alert-error" role="alert">
              {error}
            </div>
          )}
          <Button variant="default" className="w-full" disabled={busy} type="submit">
            {t('platform_setup_submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
