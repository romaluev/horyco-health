'use client';

import { BusinessSwitcher } from '@/components/backoffice/BusinessSwitcher';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useT, type I18nKey } from '@/lib/i18n';

interface AdminHeaderProps {
  titleKey: I18nKey;
  showBusinessSwitcher?: boolean;
  onOpenCommandPalette?: () => void;
  trailing?: React.ReactNode;
}

export function AdminHeader({
  titleKey,
  showBusinessSwitcher = false,
  onOpenCommandPalette,
  trailing,
}: AdminHeaderProps) {
  const t = useT();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">{t(titleKey)}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onOpenCommandPalette && (
          <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={onOpenCommandPalette}>
            {t('cmd_palette_placeholder').slice(0, 12)}…
            <kbd className="bg-muted text-muted-foreground pointer-events-none ml-2 hidden rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
              {t('adm_cmd_hint')}
            </kbd>
          </Button>
        )}
        {showBusinessSwitcher && <BusinessSwitcher />}
        {trailing}
      </div>
    </header>
  );
}
