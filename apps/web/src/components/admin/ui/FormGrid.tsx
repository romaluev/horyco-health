'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Responsive multi-column field row: 1 col mobile, 2-3 cols desktop. */
export function FormGrid({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        cols === 2 && 'grid-cols-1 md:grid-cols-2',
        cols === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Alias for a single horizontal field row. */
export function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return <FormGrid cols={2} className={className}>{children}</FormGrid>;
}
