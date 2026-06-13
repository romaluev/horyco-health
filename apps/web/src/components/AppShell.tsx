'use client';

import { useEffect, useState } from 'react';
import { getStartParam } from '@/lib/telegram';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useT } from '@/lib/i18n';
import { BottomNav } from './BottomNav';
import { MenuScreen } from './screens/MenuScreen';
import { DishDetail } from './screens/DishDetail';
import { CartScreen } from './screens/CartScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { ComboDetail } from './screens/ComboDetail';
import { ProfileScreen } from './screens/ProfileScreen';
import { OfferCompositionScreen } from './screens/OfferCompositionScreen';

/** Каркас Mini App: вкладки + нижняя навигация (регистрация — при checkout в CartScreen). */
export function AppShell() {
  const t = useT();
  const client = useAuthStore((s) => s.client);
  const tab = useUiStore((s) => s.tab);
  const detailId = useUiStore((s) => s.detailId);
  const openDetail = useUiStore((s) => s.openDetail);
  const openCombo = useUiStore((s) => s.openCombo);
  const openOfferDetails = useUiStore((s) => s.openOfferDetails);
  const [offerError, setOfferError] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('dish');
    const comboQuery = params.get('combo');
    const offerQuery = params.get('offer');
    const offerDetailsQuery = params.get('offer_details');
    const sp = getStartParam();
    const fromStart = sp.startsWith('dish_') ? sp.slice('dish_'.length) : null;
    const comboStart = sp.startsWith('combo_') ? sp.slice('combo_'.length) : null;
    const id = fromQuery || fromStart;
    if (offerDetailsQuery) {
      openOfferDetails(offerDetailsQuery);
    } else if (id) openDetail(id);
    else if (comboQuery || comboStart) openCombo(comboQuery ?? comboStart!);
    if (offerQuery) {
      void api(`/cart/from-offer/${offerQuery}`, { method: 'POST' })
        .then(() => {
          useUiStore.getState().setTab('cart');
        })
        .catch(() => {
          // Не переключаемся на корзину при ошибке — показываем уведомление.
          setOfferError(true);
        });
    }
  }, [openDetail, openCombo, openOfferDetails]);

  if (!client) return null;

  return (
    <div className="app">
      <div className="screen">
        {offerError && (
          <div className="err" role="alert" style={{ marginBottom: 12 }}>
            {t('error_generic')}
          </div>
        )}
        {tab === 'menu' && <MenuScreen />}
        {tab === 'cart' && <CartScreen />}
        {tab === 'orders' && <OrdersScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </div>
      <BottomNav />
      {detailId && <DishDetail />}
      <ComboDetail />
      <OfferCompositionScreen />
    </div>
  );
}
