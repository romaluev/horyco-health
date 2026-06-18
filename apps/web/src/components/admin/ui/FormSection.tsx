'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Titled form section; collapsible on mobile for long editors. */
export function FormSection({
  title,
  description,
  children,
  defaultOpen = true,
  collapsible = false,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn('rounded-lg border bg-card', className)}>
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between gap-2 px-4 py-3 text-left',
          !collapsible && 'cursor-default',
        )}
        onClick={() => collapsible && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!collapsible}
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {collapsible ? (
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        ) : null}
      </button>
      {open ? <div className="border-t px-4 py-4">{children}</div> : null}
    </section>
  );
}
