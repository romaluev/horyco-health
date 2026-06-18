'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink, LogOut } from 'lucide-react';
import { MemberRole } from '@eatfit/shared';

import { BusinessSwitcher } from '@/components/backoffice/BusinessSwitcher';
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
import {
  BACKOFFICE_NAV,
  filterNavForRole,
  type NavItem,
} from '@/lib/admin-nav';

interface AdminAppSidebarProps {
  navItems?: NavItem[];
  brandSubtitleKey?: I18nKey;
  platformLink?: boolean;
  memberRole: MemberRole | null;
  isPlatform: boolean;
}

function getNavActive(pathname: string, href: string): boolean {
  return pathname.startsWith(href);
}

export function AdminAppSidebar({
  navItems = BACKOFFICE_NAV,
  brandSubtitleKey = 'bo_title',
  platformLink = false,
  memberRole,
  isPlatform,
}: AdminAppSidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const visibleNav = filterNavForRole(navItems, memberRole, isPlatform);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1">
          <div className="text-sm font-semibold tracking-tight">Horyco</div>
          <div className="text-muted-foreground text-xs">{t(brandSubtitleKey)}</div>
        </div>
        <div className="px-2">
          <BusinessSwitcher />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('bo_nav_primary')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = getNavActive(pathname, item.href);
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
          {platformLink && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t('platform_nav_console')}>
                <Link href="/platform/">
                  <ExternalLink />
                  <span>{t('platform_nav_console')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
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
