'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Horizontal toolbar for filters, tabs, and bulk actions. */
export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between',
        className,
      )}
    >
      {children}
    </div>
  );
}
