'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { MemberRole } from '@eatfit/shared';

import '@/app/admin.css';

import { AdminAppSidebar } from '@/components/admin-shell/AdminAppSidebar';
import { AdminHeader } from '@/components/admin-shell/AdminHeader';
import { CommandPalette, useCommandPalette } from '@/components/admin/ui/CommandPalette';
import { PageContainer } from '@/components/admin/ui/PageContainer';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { bootstrapStaffSession } from '@/lib/staff-auth';
import { jwtKind } from '@/lib/jwt';
import { useT, type I18nKey } from '@/lib/i18n';
import {
  BACKOFFICE_NAV,
  filterNavForRole,
  type NavItem,
} from '@/lib/admin-nav';
import { useAuthStore } from '@/store/auth.store';

import { StaffLoginCard } from './StaffLoginCard';

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

export function AdminShell({
  children,
  titleKey,
  brandSubtitleKey = 'bo_title',
  navItems = BACKOFFICE_NAV,
  platformLink = false,
}: AdminShellProps) {
  const t = useT();
  const status = useAuthStore((s) => s.status);
  const client = useAuthStore((s) => s.client);
  const token = useAuthStore((s) => s.token);
  const staffBusinesses = useAuthStore((s) => s.staffBusinesses);
  const activeBusinessSlug = useAuthStore((s) => s.activeBusinessSlug);
  const [booted, setBooted] = useState(false);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  useEffect(() => {
    if (status === 'idle') {
      void bootstrapStaffSession().finally(() => setBooted(true));
    } else {
      setBooted(true);
    }
  }, [status]);

  if (!booted || status === 'loading') {
    return (
      <div className="adm-root dark flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      </div>
    );
  }

  const kind = jwtKind(token);
  if (status !== 'authed' || !client || (kind !== 'staff' && kind !== 'platform')) {
    return (
      <div className="adm-root dark">
        <StaffLoginCard />
      </div>
    );
  }

  const isPlatform = kind === 'platform';
  const memberRole = getActiveRole(staffBusinesses, activeBusinessSlug);
  const visibleNav = filterNavForRole(navItems, memberRole, isPlatform);

  return (
    <div className="adm-root dark flex min-h-svh w-full">
      <SidebarProvider>
        <AdminAppSidebar
          navItems={navItems}
          brandSubtitleKey={brandSubtitleKey}
          platformLink={platformLink}
          memberRole={memberRole}
          isPlatform={isPlatform}
        />
        <SidebarInset className="flex min-h-svh flex-col">
          <AdminHeader titleKey={titleKey} onOpenCommandPalette={() => setCmdOpen(true)} />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden" id="main-content">
            <PageContainer>{children}</PageContainer>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} navItems={visibleNav} />
    </div>
  );
}
