'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Page title row with optional description, search slot, and action buttons. */
export function PageHeader({
  title,
  description,
  actions,
  search,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  search?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-col gap-3 md:mb-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {search ? <div className="w-full sm:max-w-sm">{search}</div> : null}
    </div>
  );
}
