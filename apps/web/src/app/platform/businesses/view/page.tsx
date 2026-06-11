'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  usePlatformBusiness,
  usePlatformBusinessHealth,
  useUpdatePlatformBusiness,
} from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';

function BusinessViewInner() {
  const t = useT();
  const params = useSearchParams();
  const id = params.get('id');
  const { data: business } = usePlatformBusiness(id);
  const { data: health } = usePlatformBusinessHealth(id);
  const update = useUpdatePlatformBusiness();
  const [name, setName] = useState('');
  const [tz, setTz] = useState(5);
  const [hour, setHour] = useState(19);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (business && !initialized) {
      setName(business.name);
      setInitialized(true);
    }
  }, [business, initialized]);

  if (!id) {
    return <div className="adm-alert adm-alert-error">{t('error_generic')}</div>;
  }

  if (!business) {
    return <p className="adm-muted">{t('loading')}</p>;
  }

  return (
    <>
      <Link href="/platform/businesses/" className="adm-btn adm-btn-sm" style={{ marginBottom: 16 }}>
        {t('platform_back_list')}
      </Link>
      <div className="adm-card">
        <h3>{business.name}</h3>
        <p className="adm-muted">{business.slug} · {business.status}</p>
        {health && (
          <p style={{ marginTop: 8 }}>
            {t('platform_health')}:{' '}
            <span className={`adm-badge ${health.connected ? 'adm-badge-ok' : 'adm-badge-muted'}`}>
              {health.botStatus} {health.connected ? '(connected)' : ''}
            </span>
            {health.botUsername && <span className="adm-muted"> @{health.botUsername}</span>}
          </p>
        )}
      </div>
      <div className="adm-card">
        <h3>{t('platform_edit_business')}</h3>
        <div className="adm-field">
          <label>{t('platform_field_name')}</label>
          <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="adm-field">
          <label>{t('platform_field_tz')}</label>
          <input className="adm-input" type="number" value={tz} onChange={(e) => setTz(Number(e.target.value))} />
        </div>
        <div className="adm-field">
          <label>{t('platform_field_report')}</label>
          <input className="adm-input" type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
        </div>
        <button
          type="button"
          className="adm-btn adm-btn-primary"
          disabled={update.isPending}
          onClick={() => update.mutate({ id, name, tzOffsetHours: tz, dailyReportHour: hour })}
        >
          {t('platform_save')}
        </button>
      </div>
    </>
  );
}

export default function PlatformBusinessViewPage() {
  const t = useT();
  return (
    <Suspense fallback={<p className="adm-muted">{t('loading')}</p>}>
      <BusinessViewInner />
    </Suspense>
  );
}
