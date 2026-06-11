'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useT, type I18nKey } from '@/lib/i18n';
import { PLATFORM_NAV, type PlatformNavItem } from '@/lib/admin-nav';
import { PlatformAuthGate } from './PlatformAuthGate';

interface PlatformShellProps {
  children: ReactNode;
  titleKey: I18nKey;
}

function PlatformNav({ items, pathname, onNavigate }: { items: PlatformNavItem[]; pathname: string; onNavigate?: () => void }) {
  const t = useT();
  return (
    <nav className="adm-nav" aria-label="Platform">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === '/platform/'
            ? pathname === '/platform/' || pathname === '/platform'
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`adm-nav-link${active ? ' active' : ''}`}
            onClick={onNavigate}
          >
            <Icon size={18} aria-hidden />
            {t(item.labelKey as I18nKey)}
          </Link>
        );
      })}
    </nav>
  );
}

export function PlatformShell({ children, titleKey }: PlatformShellProps) {
  const t = useT();
  const pathname = usePathname();
  const client = useAuthStore((s) => s.client);
  const logout = useAuthStore((s) => s.logout);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const sidebar = (
    <>
      <div className="adm-sidebar-brand">
        Horyco
        <span>{t('platform_title')}</span>
      </div>
      <PlatformNav items={PLATFORM_NAV} pathname={pathname} />
      <div style={{ padding: '8px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/b/" className="adm-nav-link">
          <ExternalLink size={18} aria-hidden />
          {t('platform_go_backoffice')}
        </Link>
        <button type="button" className="adm-nav-link adm-btn-ghost" onClick={() => logout()} style={{ border: 'none', width: '100%', cursor: 'pointer' }}>
          <LogOut size={18} aria-hidden />
          {t('logout')}
        </button>
      </div>
    </>
  );

  return (
    <PlatformAuthGate>
      <div className="adm-root">
        <div className="adm-layout">
          <aside className="adm-sidebar">{sidebar}</aside>
          <div className="adm-main">
            <header className="adm-topbar">
              <button type="button" className="adm-menu-btn" aria-label={t('adm_open_menu')} onClick={() => setDrawerOpen(true)}>
                <Menu size={22} />
              </button>
              <h1 className="adm-topbar-title">{t(titleKey)}</h1>
              <div className="adm-topbar-actions">
                <span className="adm-muted" style={{ fontSize: 13 }}>{client?.name}</span>
              </div>
            </header>
            <main className="adm-content" id="main-content">
              {children}
            </main>
          </div>
        </div>
        {drawerOpen && (
          <>
            <div className="adm-drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden />
            <div className="adm-drawer" role="dialog" aria-modal="true">
              <div className="adm-topbar">
                <span className="adm-topbar-title">Menu</span>
                <button type="button" className="adm-menu-btn" onClick={() => setDrawerOpen(false)}>
                  <X size={22} />
                </button>
              </div>
              {sidebar}
            </div>
          </>
        )}
      </div>
    </PlatformAuthGate>
  );
}
