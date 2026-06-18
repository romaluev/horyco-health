'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink, LogOut } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/store/auth.store';
import { useT, type I18nKey } from '@/lib/i18n';
import { PLATFORM_NAV } from '@/lib/admin-nav';

function getPlatformNavActive(pathname: string, href: string): boolean {
  if (href === '/platform/') {
    return pathname === '/platform/' || pathname === '/platform';
  }
  return pathname.startsWith(href);
}

export function PlatformAppSidebar() {
  const t = useT();
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1">
          <div className="text-sm font-semibold tracking-tight">Horyco</div>
          <div className="text-muted-foreground text-xs">{t('platform_title')}</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('platform_title')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PLATFORM_NAV.map((item) => {
                const Icon = item.icon;
                const active = getPlatformNavActive(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={active} tooltip={t(item.labelKey as I18nKey)}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{t(item.labelKey as I18nKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('platform_go_backoffice')}>
              <Link href="/b/">
                <ExternalLink />
                <span>{t('platform_go_backoffice')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => logout()} tooltip={t('logout')}>
              <LogOut />
              <span>{t('logout')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
