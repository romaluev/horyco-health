'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { usePlatformSetupStatus } from '@/lib/backoffice-queries';
import { saveStaffToken } from '@/lib/staff-auth';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import type { StaffLoginResponse } from '@/lib/backoffice-queries';

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
        <p className="adm-muted" style={{ marginBottom: 20 }}>
          {t('platform_setup_hint')}
        </p>
        <form onSubmit={(e) => void submit(e)}>
          <div className="adm-field">
            <label htmlFor="setup-name">{t('name')}</label>
            <input id="setup-name" className="adm-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="adm-field">
            <label htmlFor="setup-phone">{t('phone')}</label>
            <input id="setup-phone" className="adm-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className="adm-field">
            <label htmlFor="setup-password">{t('web_password')}</label>
            <input id="setup-password" className="adm-input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="adm-alert adm-alert-error" role="alert">{error}</div>}
          <button className="adm-btn adm-btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {t('platform_setup_submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
