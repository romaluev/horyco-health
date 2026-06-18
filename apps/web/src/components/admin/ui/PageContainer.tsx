'use client';

import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
      <ScrollArea className={cn('h-[calc(100dvh-var(--adm-topbar-h))] w-full', className)}>
        <div className="w-full p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:px-6 lg:pb-6 max-lg:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </div>
      </ScrollArea>
    );
  }

  return (
    <div
      className={cn(
        'flex h-[calc(100dvh-var(--adm-topbar-h))] w-full flex-col overflow-hidden p-4 md:px-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
