'use client';

import { usePathname } from 'next/navigation';
import { PlatformShell } from '@/components/admin-shell/PlatformShell';
import type { I18nKey } from '@/lib/i18n';

const TITLE_BY_PREFIX: [string, I18nKey][] = [
  ['/platform/businesses/new', 'platform_create'],
  ['/platform/businesses/view', 'platform_edit_business'],
  ['/platform/businesses/', 'platform_list'],
  ['/platform/', 'platform_nav_dashboard'],
];

function titleForPath(pathname: string): I18nKey {
  for (const [prefix, key] of TITLE_BY_PREFIX) {
    if (pathname.startsWith(prefix)) return key;
  }
  return 'platform_title';
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith('/platform/setup')) {
    return <>{children}</>;
  }

  return <PlatformShell titleKey={titleForPath(pathname)}>{children}</PlatformShell>;
}
