'use client';

import { useState } from 'react';
import { staffLogin, switchBusiness } from '@/lib/staff-auth';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

export function StaffLogin() {
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
      const slug = res.businesses[0]?.slug;
      if (!slug) {
        setError(t('bo_no_business'));
        return;
      }
      setStaffAuth(res.accessToken, res.client, res.businesses, slug);
    } catch (err) {
      setError((err as ApiError).status === 401 ? t('web_auth_failed') : t('error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen" style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <h2>{t('bo_login_title')}</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        {t('bo_login_hint')}
      </p>
      <form onSubmit={(e) => void submit(e)}>
        <div className="field">
          <label>{t('phone')}</label>
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('web_password')}</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <div className="err" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {t('web_login')}
        </button>
      </form>
    </div>
  );
}
