'use client';

import { useState } from 'react';
import { staffLogin, saveStaffToken } from '@/lib/staff-auth';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/admin/ui';

interface StaffLoginCardProps {
  titleKey?: string;
  hintKey?: string;
  onSuccess?: () => void;
}

export function StaffLoginCard({
  titleKey = 'bo_login_title',
  hintKey = 'bo_login_hint',
  onSuccess,
}: StaffLoginCardProps) {
  const t = useT();
  const setStaffAuth = useAuthStore((s) => s.setStaffAuth);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await staffLogin(phone, password);
      const slug = res.businesses[0]?.slug ?? 'eatfit';
      saveStaffToken(res.accessToken, slug);
      setStaffAuth(res.accessToken, res.client, res.businesses, slug);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="bg-card w-full max-w-md rounded-xl border p-7 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">{t(titleKey as Parameters<typeof t>[0])}</h1>
        <p className="text-muted-foreground mb-5 text-sm">{t(hintKey as Parameters<typeof t>[0])}</p>
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <Field label={t('phone')} htmlFor="staff-phone">
            <Input
              id="staff-phone"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label={t('web_password')} htmlFor="staff-password">
            <Input
              id="staff-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm" role="alert">
              {error}
            </div>
          )}
          <Button variant="default" className="w-full" disabled={busy} type="submit">
            {t('web_login')}
          </Button>
        </form>
      </div>
    </div>
  );
}
