'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command-dialog';
import { useT, type I18nKey } from '@/lib/i18n';

export interface CommandNavItem {
  id: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface CommandAction {
  id: string;
  labelKey: I18nKey;
  icon?: LucideIcon;
  href?: string;
  onSelect?: () => void;
  groupKey: I18nKey;
}

export function CommandPalette({
  open,
  onOpenChange,
  navItems,
  extraActions = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: CommandNavItem[];
  extraActions?: CommandAction[];
}) {
  const t = useT();
  const router = useRouter();

  const run = (href?: string, onSelect?: () => void) => {
    onOpenChange(false);
    if (onSelect) onSelect();
    else if (href) router.push(href);
  };

  const navActions: CommandAction[] = navItems
    .filter((i) => i.id !== 'more')
    .map((item) => ({
      id: item.id,
      labelKey: item.labelKey as I18nKey,
      icon: item.icon,
      href: item.href,
      groupKey: 'cmd_group_nav' as I18nKey,
    }));

  const groups = new Map<I18nKey, CommandAction[]>();
  for (const action of [...navActions, ...extraActions]) {
    const list = groups.get(action.groupKey) ?? [];
    list.push(action);
    groups.set(action.groupKey, list);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t('cmd_palette_placeholder')} />
      <CommandList>
        <CommandEmpty>{t('cmd_palette_empty')}</CommandEmpty>
        {Array.from(groups.entries()).map(([groupKey, actions], idx) => (
          <div key={groupKey}>
            {idx > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={t(groupKey)}>
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    value={`${t(action.labelKey as I18nKey)} ${action.id}`}
                    onSelect={() => run(action.href, action.onSelect)}
                  >
                    {Icon ? <Icon className="size-4" /> : null}
                    <span>{t(action.labelKey as I18nKey)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/** Global cmd-k listener; mount once in AdminShell. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return { open, setOpen };
}
