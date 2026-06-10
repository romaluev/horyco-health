'use client';

import { useState } from 'react';
import { Role } from '@eatfit/shared';
import { useAdminUsers, useChangeRole, useDeposit, useWithdraw } from '@/lib/admin-queries';
import { useT, type I18nKey } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';

const ROLES: { role: Role; key: I18nKey }[] = [
  { role: Role.Client, key: 'role_client' },
  { role: Role.Cook, key: 'role_cook' },
  { role: Role.Courier, key: 'role_courier' },
  { role: Role.Admin, key: 'role_admin' },
];

export function AdminUsers() {
  const t = useT();
  const [q, setQ] = useState('');
  const { data: users } = useAdminUsers(q);
  const changeRole = useChangeRole();
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  return (
    <div>
      <input
        className="input"
        placeholder={t('adm_search_user')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {users?.map((u) => (
        <div className="card" key={u.id}>
          <div className="row">
            <strong>{u.name}</strong>
            <span className="muted">
              {formatMoney(u.balance)} {t('currency')}
            </span>
          </div>
          <div className="dish-desc">
            {(u.phone ?? '—') + ' · ' + (u.username ? '@' + u.username : u.telegramId)}
          </div>

          <div className="seg" style={{ margin: '8px 0' }}>
            {ROLES.map((r) => (
              <button
                key={r.role}
                className={u.role === r.role ? 'active' : ''}
                disabled={changeRole.isPending}
                onClick={() => changeRole.mutate({ id: u.id, role: r.role })}
              >
                {t(r.key)}
              </button>
            ))}
          </div>

          <div className="row">
            <input
              className="input"
              inputMode="numeric"
              placeholder={t('adm_amount')}
              value={amounts[u.id] ?? ''}
              onChange={(e) => setAmounts({ ...amounts, [u.id]: e.target.value })}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
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
              className="btn"
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
