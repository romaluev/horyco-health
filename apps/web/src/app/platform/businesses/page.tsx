'use client';

import Link from 'next/link';
import { usePlatformBusinesses, useSuspendBusiness, useActivateBusiness } from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';

function botBadge(status: string, t: ReturnType<typeof useT>) {
  switch (status) {
    case 'webhook':
    case 'polling':
      return { label: t('platform_bot_webhook'), cls: 'adm-badge-ok' };
    case 'error':
    case 'revoked':
      return { label: t('platform_bot_error'), cls: 'adm-badge-warn' };
    default:
      return { label: t('platform_bot_off'), cls: 'adm-badge-muted' };
  }
}

export default function PlatformBusinessesPage() {
  const t = useT();
  const { data: businesses } = usePlatformBusinesses(true);
  const suspend = useSuspendBusiness();
  const activate = useActivateBusiness();

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link href="/platform/businesses/new/" className="adm-btn adm-btn-primary">
          {t('platform_create_btn')}
        </Link>
      </div>

      <div className="adm-card">
        <h3>{t('platform_list')}</h3>
        {!businesses?.length && <p className="adm-muted">{t('menu_empty')}</p>}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>{t('platform_field_name')}</th>
                <th>Status</th>
                <th>Bot</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {businesses?.map((b) => {
                const badge = botBadge(b.botStatus, t);
                return (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/platform/businesses/view/?id=${b.id}`} style={{ fontWeight: 600 }}>
                        {b.name}
                      </Link>
                      <div className="adm-muted">{b.slug} · @{b.botUsername ?? '—'}</div>
                    </td>
                    <td>
                      <span className={`adm-badge ${b.status === 'active' ? 'adm-badge-ok' : 'adm-badge-muted'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <span className={`adm-badge ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        {b.status === 'active' ? (
                          <button type="button" className="adm-btn adm-btn-sm adm-btn-danger" disabled={suspend.isPending} onClick={() => suspend.mutate(b.id)}>
                            {t('platform_suspend')}
                          </button>
                        ) : (
                          <button type="button" className="adm-btn adm-btn-sm adm-btn-primary" disabled={activate.isPending} onClick={() => activate.mutate(b.id)}>
                            {t('platform_activate')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
