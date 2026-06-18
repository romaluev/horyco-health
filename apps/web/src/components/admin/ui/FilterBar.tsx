'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FilterBar({
  left,
  right,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-center', className)}>
      {left ? <div className="flex flex-1 flex-wrap items-center gap-2">{left}</div> : null}
      {right ? (
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">{right}</div>
      ) : null}
    </div>
  );
}
