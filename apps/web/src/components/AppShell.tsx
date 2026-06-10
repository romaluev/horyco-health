'use client';

import { useEffect } from 'react';
import { getStartParam } from '@/lib/telegram';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { RegistrationForm } from './RegistrationForm';
import { BottomNav } from './BottomNav';
import { MenuScreen } from './screens/MenuScreen';
import { DishDetail } from './screens/DishDetail';
import { CartScreen } from './screens/CartScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AdminScreen } from './screens/AdminScreen';

/** Каркас Mini App: гейт регистрации, затем вкладки + нижняя навигация. */
export function AppShell() {
  const client = useAuthStore((s) => s.client);
  const tab = useUiStore((s) => s.tab);
  const detailId = useUiStore((s) => s.detailId);
  const openDetail = useUiStore((s) => s.openDetail);

  // Deep-link из бота/канала: открыть деталь блюда. Источники:
  //  - web_app кнопка в боте: ?dish=<id> в URL;
  //  - startapp-ссылка под постом в канал: start_param = "dish_<id>".
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromQuery = new URLSearchParams(window.location.search).get('dish');
    const sp = getStartParam();
    const fromStart = sp.startsWith('dish_') ? sp.slice('dish_'.length) : null;
    const id = fromQuery || fromStart;
    if (id) openDetail(id);
  }, [openDetail]);

  if (!client) return null;

  const registered = Boolean(client.phone && client.address);
  if (!registered) {
    return (
      <div className="app">
        <RegistrationForm />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="screen">
        {tab === 'menu' && <MenuScreen />}
        {tab === 'cart' && <CartScreen />}
        {tab === 'orders' && <OrdersScreen />}
        {tab === 'profile' && <ProfileScreen />}
        {tab === 'admin' && <AdminScreen />}
      </div>
      <BottomNav />
      {detailId && <DishDetail />}
    </div>
  );
}
