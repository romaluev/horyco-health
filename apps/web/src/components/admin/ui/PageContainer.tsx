'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Scrollable page shell inside SidebarInset main. */
export function PageContainer({
  children,
  scrollable = true,
  className,
}: {
  children: ReactNode;
  scrollable?: boolean;
  className?: string;
}) {
  if (scrollable) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden', className)}>
        <div className="w-full p-4 md:p-6">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6', className)}>
      {children}
    </div>
  );
}
