'use client';

import { type ReactNode } from 'react';

import '@/app/admin.css';

import { AdminHeader } from '@/components/admin-shell/AdminHeader';
import { PlatformAppSidebar } from '@/components/admin-shell/PlatformAppSidebar';
import { CommandPalette, useCommandPalette } from '@/components/admin/ui/CommandPalette';
import { PageContainer } from '@/components/admin/ui/PageContainer';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { PLATFORM_NAV } from '@/lib/admin-nav';
import type { I18nKey } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth.store';

import { PlatformAuthGate } from './PlatformAuthGate';

interface PlatformShellProps {
  children: ReactNode;
  titleKey: I18nKey;
}

export function PlatformShell({ children, titleKey }: PlatformShellProps) {
  const client = useAuthStore((s) => s.client);
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();

  const cmdNav = PLATFORM_NAV.map((item) => ({
    id: item.id,
    href: item.href,
    labelKey: item.labelKey,
    icon: item.icon,
  }));

  return (
    <PlatformAuthGate>
      <div className="adm-root dark flex min-h-svh w-full">
        <SidebarProvider>
          <PlatformAppSidebar />
          <SidebarInset className="flex min-h-svh flex-col">
            <AdminHeader
              titleKey={titleKey}
              onOpenCommandPalette={() => setCmdOpen(true)}
              trailing={client?.name ? <span className="text-muted-foreground text-sm">{client.name}</span> : null}
            />
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden" id="main-content">
              <PageContainer>{children}</PageContainer>
            </main>
          </SidebarInset>
        </SidebarProvider>
        <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} navItems={cmdNav} />
      </div>
    </PlatformAuthGate>
  );
}
