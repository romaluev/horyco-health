'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminUsers, useDeposit, useWithdraw } from '@/lib/admin-queries';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';

export function AdminUsers() {
  const t = useT();
  const [q, setQ] = useState('');
  const { data: users } = useAdminUsers(q);
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  return (
    <div>
      <div className="adm-alert adm-alert-info" style={{ marginBottom: 16 }}>
        {t('adm_staff_manage_hint')}{' '}
        <Link href="/b/settings/">{t('bo_staff')}</Link>
      </div>
      <input
        className="adm-input"
        placeholder={t('adm_search_user')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {users?.map((u) => (
        <div className="adm-card" key={u.id}>
          <div className="row">
            <strong>{u.name}</strong>
            <span className="adm-muted">
              {formatMoney(u.balance)} {t('currency')}
            </span>
          </div>
          <div className="adm-muted" style={{ fontSize: 13, marginBottom: 8 }}>
            {(u.phone ?? '—') + ' · ' + (u.username ? '@' + u.username : u.telegramId)}
          </div>

          <div className="adm-row-actions">
            <input
              className="adm-input"
              inputMode="numeric"
              placeholder={t('adm_amount')}
              value={amounts[u.id] ?? ''}
              onChange={(e) => setAmounts({ ...amounts, [u.id]: e.target.value })}
              style={{ flex: 1, minWidth: 120 }}
            />
            <button
              type="button"
              className="adm-btn adm-btn-primary adm-btn-sm"
              disabled={deposit.isPending || !Number(amounts[u.id])}
              onClick={() =>
                deposit.mutate(
                  { clientId: u.id, amount: Number(amounts[u.id]) },
                  { onSuccess: () => setAmounts({ ...amounts, [u.id]: '' }) },
                )
              }
            >
              {t('adm_deposit')}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-sm"
              disabled={withdraw.isPending || !Number(amounts[u.id])}
              onClick={() =>
                withdraw.mutate(
                  { clientId: u.id, amount: Number(amounts[u.id]) },
                  { onSuccess: () => setAmounts({ ...amounts, [u.id]: '' }) },
                )
              }
            >
              {t('adm_withdraw')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
