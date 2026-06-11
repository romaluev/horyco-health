'use client';

import { useState } from 'react';
import { staffLogin, saveStaffToken } from '@/lib/staff-auth';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

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
    <div className="adm-login-page adm-root">
      <div className="adm-login-card">
        <h1>{t(titleKey as Parameters<typeof t>[0])}</h1>
        <p className="adm-muted" style={{ marginBottom: 20 }}>
          {t(hintKey as Parameters<typeof t>[0])}
        </p>
        <form onSubmit={(e) => void submit(e)}>
          <div className="adm-field">
            <label htmlFor="staff-phone">{t('phone')}</label>
            <input
              id="staff-phone"
              className="adm-input"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="adm-field">
            <label htmlFor="staff-password">{t('web_password')}</label>
            <input
              id="staff-password"
              className="adm-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="adm-alert adm-alert-error" role="alert">
              {error}
            </div>
          )}
          <button className="adm-btn adm-btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {t('web_login')}
          </button>
        </form>
      </div>
    </div>
  );
}
