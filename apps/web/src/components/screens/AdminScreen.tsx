'use client';

import { useState } from 'react';
import { useT, type I18nKey } from '@/lib/i18n';
import { AdminOrders } from '../admin/AdminOrders';
import { AdminMenu } from '../admin/AdminMenu';
import { AdminUsers } from '../admin/AdminUsers';
import { AdminSettings } from '../admin/AdminSettings';

type Sub = 'orders' | 'menu' | 'users' | 'settings';
const SUBS: { sub: Sub; key: I18nKey }[] = [
  { sub: 'orders', key: 'adm_orders' },
  { sub: 'menu', key: 'adm_menu' },
  { sub: 'users', key: 'adm_users' },
  { sub: 'settings', key: 'adm_settings' },
];

/** Админка (FR-F4/F6): под-вкладки заказы / меню / люди / настройки. */
export function AdminScreen() {
  const t = useT();
  const [sub, setSub] = useState<Sub>('orders');

  return (
    <div>
      <h2>{t('nav_admin')}</h2>
      <div className="seg" style={{ marginBottom: 16 }}>
        {SUBS.map((s) => (
          <button key={s.sub} className={sub === s.sub ? 'active' : ''} onClick={() => setSub(s.sub)}>
            {t(s.key)}
          </button>
        ))}
      </div>
      {sub === 'orders' && <AdminOrders />}
      {sub === 'menu' && <AdminMenu />}
      {sub === 'users' && <AdminUsers />}
      {sub === 'settings' && <AdminSettings />}
    </div>
  );
}
