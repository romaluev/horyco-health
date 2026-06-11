'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, ExternalLink } from 'lucide-react';
import { MemberRole } from '@eatfit/shared';
import { useAuthStore } from '@/store/auth.store';
import { bootstrapStaffSession } from '@/lib/staff-auth';
import { jwtKind } from '@/lib/jwt';
import { useT, type I18nKey } from '@/lib/i18n';
import { StaffLoginCard } from './StaffLoginCard';
import { BusinessSwitcher } from '../backoffice/BusinessSwitcher';
import { BACKOFFICE_NAV, filterNavForRole, type NavItem } from '@/lib/admin-nav';

interface AdminShellProps {
  children: ReactNode;
  titleKey: I18nKey;
  brandSubtitleKey?: I18nKey;
  navItems?: NavItem[];
  platformLink?: boolean;
}

function getActiveRole(
  businesses: { slug: string; role: MemberRole }[],
  activeSlug: string | null,
): MemberRole | null {
  if (!activeSlug) return businesses[0]?.role ?? null;
  return businesses.find((b) => b.slug === activeSlug)?.role ?? null;
}

function NavLinks({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  const t = useT();
  return (
    <nav className="adm-nav" aria-label="Back office">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
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

export function AdminShell({
  children,
  titleKey,
  brandSubtitleKey = 'bo_title',
  navItems = BACKOFFICE_NAV,
  platformLink = false,
}: AdminShellProps) {
  const t = useT();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const client = useAuthStore((s) => s.client);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const staffBusinesses = useAuthStore((s) => s.staffBusinesses);
  const activeBusinessSlug = useAuthStore((s) => s.activeBusinessSlug);
  const [booted, setBooted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      void bootstrapStaffSession().finally(() => setBooted(true));
    } else {
      setBooted(true);
    }
  }, [status]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (!booted || status === 'loading') {
    return (
      <div className="adm-root adm-login-page">
        <p className="adm-muted">{t('loading')}</p>
      </div>
    );
  }

  const kind = jwtKind(token);
  if (status !== 'authed' || !client || (kind !== 'staff' && kind !== 'platform')) {
    return <StaffLoginCard />;
  }

  const isPlatform = kind === 'platform';
  const memberRole = getActiveRole(staffBusinesses, activeBusinessSlug);
  const visibleNav = filterNavForRole(navItems, memberRole, isPlatform);

  const sidebar = (
    <>
      <div className="adm-sidebar-brand">
        Horyco
        <span>{t(brandSubtitleKey)}</span>
      </div>
      <NavLinks items={visibleNav} pathname={pathname} />
      <div style={{ padding: '8px 12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {platformLink && (
          <Link href="/platform/" className="adm-nav-link">
            <ExternalLink size={18} aria-hidden />
            {t('platform_nav_console')}
          </Link>
        )}
        <button type="button" className="adm-nav-link adm-btn-ghost" onClick={() => logout()} style={{ border: 'none', width: '100%', cursor: 'pointer' }}>
          <LogOut size={18} aria-hidden />
          {t('logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="adm-root">
      <div className="adm-layout">
        <aside className="adm-sidebar">{sidebar}</aside>

        <div className="adm-main">
          <header className="adm-topbar">
            <button
              type="button"
              className="adm-menu-btn"
              aria-label={t('adm_open_menu')}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={22} />
            </button>
            <h1 className="adm-topbar-title">{t(titleKey)}</h1>
            <div className="adm-topbar-actions adm-switcher">
              <BusinessSwitcher />
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
          <div className="adm-drawer" role="dialog" aria-modal="true" aria-label={t('adm_open_menu')}>
            <div className="adm-topbar" style={{ borderBottom: '1px solid var(--adm-border)' }}>
              <span className="adm-topbar-title">Menu</span>
              <button type="button" className="adm-menu-btn" aria-label="Close" onClick={() => setDrawerOpen(false)}>
                <X size={22} />
              </button>
            </div>
            {sidebar}
          </div>
        </>
      )}
    </div>
  );
}
