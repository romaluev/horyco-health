'use client';

import { usePathname } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell/AdminShell';
import { jwtKind } from '@/lib/jwt';
import { useAuthStore } from '@/store/auth.store';
import type { I18nKey } from '@/lib/i18n';

const TITLE_BY_PREFIX: [string, I18nKey][] = [
  ['/b/onboarding/', 'bo_onboarding'],
  ['/b/settings/', 'adm_settings'],
  ['/b/customers/', 'adm_users'],
  ['/b/modifiers/', 'bo_modifiers'],
  ['/b/offers/', 'bo_offers'],
  ['/b/combos/', 'bo_combos'],
  ['/b/menu/', 'adm_menu'],
  ['/b/orders/', 'adm_orders'],
  ['/b/dashboard/', 'dash_title'],
];

function titleForPath(pathname: string): I18nKey {
  for (const [prefix, key] of TITLE_BY_PREFIX) {
    if (pathname.startsWith(prefix)) return key;
  }
  return 'bo_title';
}

export function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const isPlatform = jwtKind(token) === 'platform';

  return (
    <AdminShell titleKey={titleForPath(pathname)} platformLink={isPlatform}>
      {children}
    </AdminShell>
  );
}
