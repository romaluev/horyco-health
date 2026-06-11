'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { jwtKind } from '@/lib/jwt';
import { staffLogin, saveStaffToken } from '@/lib/staff-auth';
import {
  usePlatformMetrics,
  usePlatformBusinesses,
  useCreateBusiness,
  useSuspendBusiness,
  useActivateBusiness,
} from '@/lib/backoffice-queries';
import { useT, type I18nKey } from '@/lib/i18n';

function botStatusBadge(status: string, t: (k: I18nKey) => string) {
  switch (status) {
    case 'webhook':
    case 'polling':
      return { label: t('platform_bot_webhook'), color: 'var(--accent)' };
    case 'error':
    case 'revoked':
      return { label: t('platform_bot_error'), color: 'var(--danger, #e74c3c)' };
    default:
      return { label: t('platform_bot_off'), color: 'var(--muted, #888)' };
  }
}

function PlatformLogin({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const setStaffAuth = useAuthStore((s) => s.setStaffAuth);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await staffLogin(phone, password);
    const slug = res.businesses[0]?.slug ?? 'platform';
    saveStaffToken(res.accessToken, slug);
    setStaffAuth(res.accessToken, res.client, res.businesses, slug);
    onDone();
  };

  return (
    <form onSubmit={(e) => void submit(e)} style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2>{t('platform_login')}</h2>
      <div className="field">
        <label>{t('phone')}</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
      <button className="btn btn-primary btn-block">{t('web_login')}</button>
    </form>
  );
}

export default function PlatformPage() {
  const t = useT();
  const token = useAuthStore((s) => s.token);
  const [authed, setAuthed] = useState(false);
  const [denied, setDenied] = useState(false);
  const { data: metrics } = usePlatformMetrics();
  const { data: businesses } = usePlatformBusinesses();
  const create = useCreateBusiness();
  const suspend = useSuspendBusiness();
  const activate = useActivateBusiness();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    ownerName: '',
    ownerPhone: '',
    ownerPassword: '',
  });

  useEffect(() => {
    if (!token) return;
    // Платформенный доступ только для токенов kind==='platform'; иначе — отказ.
    if (jwtKind(token) !== 'platform') {
      setAuthed(false);
      setDenied(true);
      return;
    }
    api('/platform/metrics', { token })
      .then(() => setAuthed(true))
      .catch(() => setDenied(true));
  }, [token]);

  if (!token || denied) {
    return (
      <div className="app">
        {/* authed выставит эффект после проверки kind==='platform' по новому токену. */}
        <PlatformLogin onDone={() => setDenied(false)} />
        {denied && (
          <div className="err center" role="alert">
            {t('platform_denied')}
          </div>
        )}
      </div>
    );
  }

  if (!authed) return <div className="center">{t('loading')}</div>;

  return (
    <div className="app">
      <div className="screen">
        <h2>{t('platform_title')}</h2>
        {metrics && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row">
              <span>{t('platform_total')}</span>
              <strong>{metrics.totalBusinesses}</strong>
            </div>
            <div className="row">
              <span>{t('platform_active')}</span>
              <strong>{metrics.activeBusinesses}</strong>
            </div>
            <div className="row">
              <span>{t('platform_orders')}</span>
              <strong>{metrics.totalOrders}</strong>
            </div>
            <div className="row">
              <span>{t('platform_gmv')}</span>
              <strong>{metrics.totalGmv}</strong>
            </div>
          </div>
        )}

        {metrics && metrics.businesses.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>{t('platform_gmv_by_biz')}</h3>
            {metrics.businesses.map((b) => (
              <div className="row" key={b.id} style={{ marginBottom: 6 }}>
                <div>
                  <strong>{b.name}</strong>
                  <div className="muted">{b.slug} · {b.orderCount} {t('platform_orders_short')}</div>
                </div>
                <strong>{b.gmv}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <h3>{t('platform_create')}</h3>
          {(
            [
              ['name', 'platform_field_name'],
              ['slug', 'platform_field_slug'],
              ['ownerName', 'platform_field_owner_name'],
              ['ownerPhone', 'platform_field_owner_phone'],
              ['ownerPassword', 'platform_field_owner_password'],
            ] as const
          ).map(([key, labelKey]) => (
            <div className="field" key={key}>
              <label>{t(labelKey)}</label>
              <input
                className="input"
                type={key === 'ownerPassword' ? 'password' : 'text'}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <button
            className="btn btn-primary"
            disabled={create.isPending}
            onClick={() => create.mutate(form)}
          >
            {t('platform_create_btn')}
          </button>
        </div>

        <h3>{t('platform_list')}</h3>
        {businesses?.map((b) => {
          const badge = botStatusBadge(b.botStatus, t);
          return (
          <div className="card" key={b.id} style={{ marginBottom: 8 }}>
            <div className="row">
              <div>
                <strong>{b.name}</strong>
                <div className="muted">
                  {b.slug} · {b.status} · @{b.botUsername ?? '—'}
                </div>
                <span style={{ fontSize: 13, color: badge.color, fontWeight: 600 }}>
                  {badge.label}
                </span>
              </div>
              <div className="seg">
                {b.status === 'active' ? (
                  <button className="btn" onClick={() => suspend.mutate(b.id)}>
                    {t('platform_suspend')}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => activate.mutate(b.id)}>
                    {t('platform_activate')}
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
