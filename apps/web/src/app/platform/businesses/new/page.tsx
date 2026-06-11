'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCreateBusiness, type CreateBusinessResult } from '@/lib/backoffice-queries';
import { slugifyName } from '@/lib/slugify';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

export default function PlatformCreateBusinessPage() {
  const t = useT();
  const create = useCreateBusiness();
  const [slugTouched, setSlugTouched] = useState(false);
  const [success, setSuccess] = useState<CreateBusinessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    ownerName: '',
    ownerPhone: '',
    ownerPassword: '',
    tzOffsetHours: 5,
    dailyReportHour: 19,
  });

  const onNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: slugTouched ? f.slug : slugifyName(name),
    }));
  };

  const submit = () => {
    setError(null);
    create.mutate(form, {
      onSuccess: (data) => {
        setSuccess(data);
        setForm({
          name: '',
          slug: '',
          ownerName: '',
          ownerPhone: '',
          ownerPassword: '',
          tzOffsetHours: 5,
          dailyReportHour: 19,
        });
        setSlugTouched(false);
      },
      onError: (err) => setError(err instanceof ApiError ? err.message : t('error_generic')),
    });
  };

  if (success) {
    return (
      <div className="adm-card">
        <div className="adm-alert adm-alert-success" role="status">
          {t('platform_create_success')}: <strong>{success.business.name}</strong>
        </div>
        <h3>{t('platform_owner_credentials')}</h3>
        <p>
          {t('phone')}: <strong>{success.owner.phone}</strong>
        </p>
        {success.owner.existingAccount && (
          <p className="adm-muted">{t('platform_existing_owner')}</p>
        )}
        <p>
          {t('platform_copy_login')}:{' '}
          <a href={success.loginUrl} target="_blank" rel="noreferrer">
            {success.loginUrl}
          </a>
        </p>
        <div className="adm-row-actions" style={{ marginTop: 16 }}>
          <Link href="/platform/businesses/" className="adm-btn">
            {t('platform_back_list')}
          </Link>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => setSuccess(null)}>
            {t('platform_create_btn')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-card">
      <h3>{t('platform_create')}</h3>
      {error && <div className="adm-alert adm-alert-error" role="alert">{error}</div>}
      <div className="adm-field">
        <label>{t('platform_field_name')}</label>
        <input className="adm-input" value={form.name} onChange={(e) => onNameChange(e.target.value)} />
      </div>
      <div className="adm-field">
        <label>{t('platform_field_slug')}</label>
        <input
          className="adm-input"
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setForm({ ...form, slug: e.target.value });
          }}
        />
        <p className="adm-muted" style={{ marginTop: 4, fontSize: 13 }}>{t('platform_slug_hint')}</p>
      </div>
      <div className="adm-field">
        <label>{t('platform_field_owner_name')}</label>
        <input className="adm-input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
      </div>
      <div className="adm-field">
        <label>{t('platform_field_owner_phone')}</label>
        <input className="adm-input" inputMode="tel" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} />
      </div>
      <div className="adm-field">
        <label>{t('platform_field_owner_password')}</label>
        <input className="adm-input" type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
      </div>
      <div className="adm-field">
        <label>{t('platform_field_tz')}</label>
        <input className="adm-input" type="number" value={form.tzOffsetHours} onChange={(e) => setForm({ ...form, tzOffsetHours: Number(e.target.value) })} />
      </div>
      <div className="adm-field">
        <label>{t('platform_field_report')}</label>
        <input className="adm-input" type="number" min={0} max={23} value={form.dailyReportHour} onChange={(e) => setForm({ ...form, dailyReportHour: Number(e.target.value) })} />
      </div>
      <button type="button" className="adm-btn adm-btn-primary" disabled={create.isPending} onClick={submit}>
        {t('platform_create_btn')}
      </button>
    </div>
  );
}
