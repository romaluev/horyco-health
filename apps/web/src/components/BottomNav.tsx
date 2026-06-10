'use client';

import { Role } from '@eatfit/shared';
import { useUiStore, type Tab } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import { useCart } from '@/lib/queries';
import { useT, type I18nKey } from '@/lib/i18n';

const ITEMS: { tab: Tab; key: I18nKey; ico: string }[] = [
  { tab: 'menu', key: 'nav_menu', ico: '🍽' },
  { tab: 'cart', key: 'nav_cart', ico: '🛒' },
  { tab: 'orders', key: 'nav_orders', ico: '📦' },
  { tab: 'profile', key: 'nav_profile', ico: '👤' },
];

export function BottomNav() {
  const t = useT();
  const tab = useUiStore((s) => s.tab);
  const setTab = useUiStore((s) => s.setTab);
  const isAdmin = useAuthStore((s) => s.client?.role === Role.Admin);
  const { data: cart } = useCart();
  const count = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  const items = isAdmin
    ? [...ITEMS, { tab: 'admin' as Tab, key: 'nav_admin' as I18nKey, ico: '⚙️' }]
    : ITEMS;

  return (
    <nav className="nav">
      {items.map((it) => (
        <button
          key={it.tab}
          className={tab === it.tab ? 'active' : ''}
          onClick={() => setTab(it.tab)}
        >
          <span className="ico">{it.ico}</span>
          <span>
            {t(it.key)}
            {it.tab === 'cart' && count > 0 ? <span className="badge">{count}</span> : null}
          </span>
        </button>
      ))}
    </nav>
  );
}
