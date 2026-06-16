'use client';

import {
  ClipboardList,
  ShoppingBag,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import { useUiStore, type Tab } from '@/store/ui.store';
import { useCart } from '@/lib/queries';
import { useT, type I18nKey } from '@/lib/i18n';
import { haptic } from '@/lib/telegram';

const ITEMS: { tab: Tab; key: I18nKey; Icon: typeof UtensilsCrossed }[] = [
  { tab: 'menu', key: 'nav_menu', Icon: UtensilsCrossed },
  { tab: 'cart', key: 'nav_cart', Icon: ShoppingBag },
  { tab: 'orders', key: 'nav_orders', Icon: ClipboardList },
  { tab: 'profile', key: 'nav_profile', Icon: User },
];

export function BottomNav() {
  const t = useT();
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  const { data: cart } = useCart();
  const count = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  const go = (next: Tab) => {
    if (next !== tab) haptic('selection');
    setTab(next);
  };

  return (
    <nav className="nav" aria-label={t('nav_menu')}>
      {ITEMS.map(({ tab: itemTab, key, Icon }) => {
        const active = tab === itemTab;
        const label = t(key);
        return (
          <button
            key={itemTab}
            type="button"
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            onClick={() => go(itemTab)}
          >
            <span className="ico" aria-hidden>
              <Icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              {itemTab === 'cart' && count > 0 ? (
                <span className="badge" aria-label={`${count}`}>
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </span>
            <span className="nav-label-wrap">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
