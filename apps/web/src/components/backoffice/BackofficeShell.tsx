'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { bootstrapStaffSession } from '@/lib/staff-auth';
import { jwtKind } from '@/lib/jwt';
import { useT, type I18nKey } from '@/lib/i18n';
import { StaffLogin } from './StaffLogin';
import { BusinessSwitcher } from './BusinessSwitcher';
import { AdminOrders } from '../admin/AdminOrders';
import { AdminMenu } from '../admin/AdminMenu';
import { AdminUsers } from '../admin/AdminUsers';
import { BackofficeSettings } from './BackofficeSettings';
import { OffersTab } from './OffersTab';
import { ModifiersTab } from './ModifiersTab';
import { DashboardTab } from './DashboardTab';
import { CombosTab } from './CombosTab';

type Tab = 'dashboard' | 'orders' | 'menu' | 'combos' | 'users' | 'offers' | 'modifiers' | 'settings';
const TABS: { tab: Tab; key: I18nKey }[] = [
  { tab: 'dashboard', key: 'dash_title' },
  { tab: 'orders', key: 'adm_orders' },
  { tab: 'menu', key: 'adm_menu' },
  { tab: 'combos', key: 'bo_combos' },
  { tab: 'offers', key: 'bo_offers' },
  { tab: 'modifiers', key: 'bo_modifiers' },
  { tab: 'users', key: 'adm_users' },
  { tab: 'settings', key: 'adm_settings' },
];

export function BackofficeShell() {
  const t = useT();
  const status = useAuthStore((s) => s.status);
  const client = useAuthStore((s) => s.client);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      void bootstrapStaffSession().finally(() => setBooted(true));
    } else {
      setBooted(true);
    }
  }, [status]);

  if (!booted || status === 'loading') {
    return <div className="center">{t('loading')}</div>;
  }

  // Back office доступен только стафф/платформенной сессии — клиентский JWT не пускаем.
  const kind = jwtKind(token);
  if (status !== 'authed' || !client || (kind !== 'staff' && kind !== 'platform')) {
    return <StaffLogin />;
  }

  return (
    <div className="app">
      <div className="screen">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2>{t('bo_title')}</h2>
          <button className="btn" onClick={() => logout()}>
            {t('logout')}
          </button>
        </div>
        <BusinessSwitcher />
        <div className="seg" style={{ marginBottom: 16 }}>
          {TABS.map((item) => (
            <button
              key={item.tab}
              className={tab === item.tab ? 'active' : ''}
              onClick={() => setTab(item.tab)}
            >
              {t(item.key)}
            </button>
          ))}
        </div>
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'orders' && <AdminOrders />}
        {tab === 'menu' && <AdminMenu />}
        {tab === 'combos' && <CombosTab />}
        {tab === 'offers' && <OffersTab />}
        {tab === 'modifiers' && <ModifiersTab />}
        {tab === 'users' && <AdminUsers />}
        {tab === 'settings' && <BackofficeSettings />}
      </div>
    </div>
  );
}
