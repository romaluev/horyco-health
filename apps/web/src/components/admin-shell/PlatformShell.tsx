'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useT, type I18nKey } from '@/lib/i18n';
import { PLATFORM_NAV, type PlatformNavItem } from '@/lib/admin-nav';
import { PlatformAuthGate } from './PlatformAuthGate';
import { Button } from '@/components/ui/button';
import { CommandPalette, useCommandPalette } from '@/components/admin/ui/CommandPalette';
import { FluidProviders } from './FluidProviders';
import { cn } from '@/lib/utils';

interface PlatformShellProps {
  children: ReactNode;
  titleKey: I18nKey;
}

function PlatformNav({
  items,
  pathname,
  onNavigate,
}: {
  items: PlatformNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
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
            className={cn('adm-nav-link', active && 'active')}
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
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const sidebar = (
    <>
      <div className="adm-sidebar-brand">
        Horyco
        <span>{t('platform_title')}</span>
      </div>
      <PlatformNav items={PLATFORM_NAV} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      <div className="adm-sidebar-footer">
        <Link href="/b/" className="adm-nav-link">
          <ExternalLink size={18} aria-hidden />
          {t('platform_go_backoffice')}
        </Link>
        <button type="button" className="adm-nav-link adm-sidebar-logout" onClick={() => logout()}>
          <LogOut size={18} aria-hidden />
          {t('logout')}
        </button>
      </div>
    </>
  );

  const cmdNav = PLATFORM_NAV.map((item) => ({
    id: item.id,
    href: item.href,
    labelKey: item.labelKey,
    icon: item.icon,
  }));

  return (
    <PlatformAuthGate>
      <FluidProviders>
      <div className="adm-root">
        <div className="adm-layout">
          <aside className="adm-sidebar">{sidebar}</aside>
          <div className="adm-main">
            <header className="adm-topbar">
              <button
                type="button"
                className="adm-menu-btn lg:hidden"
                aria-label={t('adm_open_menu')}
                onClick={() => setDrawerOpen(true)}
              >
                <Menu size={22} />
              </button>
              <h1 className="adm-topbar-title">{t(titleKey)}</h1>
              <div className="adm-topbar-actions adm-switcher">
                <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => setCmdOpen(true)}>
                  {t('cmd_palette_placeholder').slice(0, 12)}…
                  <kbd className="adm-kbd">{t('adm_cmd_hint')}</kbd>
                </Button>
                {client?.name ? <span className="adm-muted text-sm">{client.name}</span> : null}
              </div>
            </header>
            <main className="adm-content" id="main-content">
              {children}
            </main>
          </div>
        </div>

        {drawerOpen && (
          <>
            <div className="adm-drawer-backdrop lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />
            <div
              className="adm-drawer lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={t('adm_open_menu')}
            >
              <div className="adm-drawer-head">
                <span className="adm-topbar-title">{t('adm_open_menu')}</span>
                <button
                  type="button"
                  className="adm-menu-btn"
                  aria-label={t('bo_close')}
                  onClick={() => setDrawerOpen(false)}
                >
                  <X size={22} />
                </button>
              </div>
              {sidebar}
            </div>
          </>
        )}

        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} navItems={cmdNav} />
      </div>
      </FluidProviders>
    </PlatformAuthGate>
  );
}
