'use client';

import type { LucideIcon } from 'lucide-react';
import { GitBranch, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

export type ViewMode = 'table' | 'grid' | 'tree';

interface ViewModeOption {
  value: ViewMode;
  label?: string;
  icon: LucideIcon;
}

interface ViewModeTogglerProps<T extends ViewMode = ViewMode> {
  value: T;
  onChange: (mode: T) => void;
  options?: ViewModeOption[];
  showLabels?: boolean;
}

const defaultOptions: ViewModeOption[] = [
  { value: 'table', icon: List },
  { value: 'grid', icon: Grid },
];

const treeGridOptions: ViewModeOption[] = [
  { value: 'tree', icon: GitBranch },
  { value: 'grid', icon: Grid },
];

export function ViewModeToggler<T extends ViewMode = ViewMode>({
  value,
  onChange,
  options,
  showLabels = true,
}: ViewModeTogglerProps<T>) {
  const t = useT();
  const modeOptions = options ?? (value === 'tree' ? treeGridOptions : defaultOptions);

  const getLabel = (optionValue: ViewMode) => {
    const custom = options?.find((o) => o.value === optionValue)?.label;
    if (custom) return custom;
    if (optionValue === 'table') return t('adm_view_table');
    if (optionValue === 'grid') return t('adm_view_grid');
    return t('adm_view_tree');
  };

  return (
    <div className="flex w-fit gap-1 rounded-lg border p-1">
      {modeOptions.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(option.value as T)}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            {showLabels ? (
              <span className="hidden md:inline">{getLabel(option.value)}</span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
