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
import {
  BACKOFFICE_NAV,
  BACKOFFICE_SECONDARY_NAV,
  filterNavForRole,
  filterPrimaryNavForRole,
  type NavItem,
} from '@/lib/admin-nav';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CommandPalette, useCommandPalette } from '@/components/admin/ui/CommandPalette';
import { PageContainer } from '@/components/admin/ui/PageContainer';
import { cn } from '@/lib/utils';

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

function NavLinks({
  items,
  pathname,
  onNavigate,
  className,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <nav className={cn('adm-nav', className)} aria-label="Back office">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id !== 'more' && pathname.startsWith(item.href);
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

function BottomNav({
  items,
  pathname,
  onMore,
}: {
  items: NavItem[];
  pathname: string;
  onMore: () => void;
}) {
  const t = useT();
  return (
    <nav className="adm-bottom-nav" aria-label={t('bo_nav_primary')}>
      {items.map((item) => {
        const Icon = item.icon;
        if (item.id === 'more') {
          const secondaryActive = BACKOFFICE_SECONDARY_NAV.some((s) => pathname.startsWith(s.href));
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              className={cn(
                'adm-bottom-nav-link !inline-flex !h-auto !min-h-[56px] !flex-col !items-center !justify-center !gap-0.5 !p-[6px_4px] !text-[11px] font-medium',
                secondaryActive && 'active',
              )}
              onClick={onMore}
              aria-label={t('bo_nav_more')}
            >
              <Icon size={20} aria-hidden />
              {t(item.labelKey as I18nKey)}
            </Button>
          );
        }
        const active = pathname.startsWith(item.href);
        return (
          <Link key={item.id} href={item.href} className={cn('adm-bottom-nav-link', active && 'active')}>
            <Icon size={20} aria-hidden />
            <span>{t(item.labelKey as I18nKey)}</span>
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
  const [moreOpen, setMoreOpen] = useState(false);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  useEffect(() => {
    if (status === 'idle') {
      void bootstrapStaffSession().finally(() => setBooted(true));
    } else {
      setBooted(true);
    }
  }, [status]);

  useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
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
  const primaryNav = filterPrimaryNavForRole(memberRole, isPlatform);
  const secondaryNav = filterNavForRole(BACKOFFICE_SECONDARY_NAV, memberRole, isPlatform);

  const sidebar = (
    <>
      <div className="adm-sidebar-brand">
        Horyco
        <span>{t(brandSubtitleKey)}</span>
      </div>
      <NavLinks items={visibleNav} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      <div className="adm-sidebar-footer">
        {platformLink && (
          <Link href="/platform/" className="adm-nav-link">
            <ExternalLink size={18} aria-hidden />
            {t('platform_nav_console')}
          </Link>
        )}
        <Button
          type="button"
          variant="ghost"
          className="adm-nav-link adm-sidebar-logout !h-auto !min-h-[var(--adm-control-h)] !justify-start !gap-[10px] !px-[10px] !py-[6px] !text-[13px] font-medium"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </Button>
      </div>
    </>
  );

  return (
    <div className="adm-root">
      <div className="adm-layout">
        <aside className="adm-sidebar">{sidebar}</aside>

        <div className="adm-main">
          <header className="adm-topbar">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="adm-menu-btn lg:hidden"
              aria-label={t('adm_open_menu')}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu />
            </Button>
            <h1 className="adm-topbar-title">{t(titleKey)}</h1>
            <div className="adm-topbar-actions adm-switcher">
              <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => setCmdOpen(true)}>
                {t('cmd_palette_placeholder').slice(0, 12)}…
                <kbd className="adm-kbd">{t('adm_cmd_hint')}</kbd>
              </Button>
              <BusinessSwitcher />
            </div>
          </header>

          <main className="adm-content" id="main-content">
            <PageContainer>{children}</PageContainer>
          </main>

          <BottomNav items={primaryNav} pathname={pathname} onMore={() => setMoreOpen(true)} />
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="adm-menu-btn"
                aria-label={t('bo_close')}
                onClick={() => setDrawerOpen(false)}
              >
                <X />
              </Button>
            </div>
            {sidebar}
          </div>
        </>
      )}

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{t('bo_nav_more')}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 py-4">
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Button
                  key={item.id}
                  variant={active ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  asChild
                >
                  <Link href={item.href} onClick={() => setMoreOpen(false)}>
                    <Icon className="h-4 w-4" />
                    {t(item.labelKey as I18nKey)}
                  </Link>
                </Button>
              );
            })}
            {platformLink && (
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/platform/" onClick={() => setMoreOpen(false)}>
                  <ExternalLink className="h-4 w-4" />
                  {t('platform_nav_console')}
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
              {t('logout')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} navItems={visibleNav} />
    </div>
  );
}
