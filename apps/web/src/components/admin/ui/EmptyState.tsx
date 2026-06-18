'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Empty state for admin list views. */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
      {Icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      ) : null}
      <h3 className="text-lg font-medium text-muted-foreground">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
