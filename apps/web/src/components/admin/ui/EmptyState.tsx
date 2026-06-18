'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const minHeightMap = {
  sm: 'min-h-40',
  md: 'min-h-64',
  lg: 'min-h-96',
  xl: 'min-h-[32rem]',
};

/** Empty state for admin list views (horyco-admin DashboardEmptyState pattern). */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
  minHeight = 'md',
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  minHeight?: keyof typeof minHeightMap;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center',
        minHeightMap[minHeight],
        className,
      )}
    >
      {Icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      ) : null}
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/** Alias matching horyco-admin naming. */
export const DashboardEmptyState = AdminEmptyState;
