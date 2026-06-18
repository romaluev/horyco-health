'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      {collapsible ? (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'flex h-auto w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-left',
            open && '[&_svg:last-child]:rotate-180',
          )}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      ) : (
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      )}
      {open ? <div className="border-t border-border/60 px-4 py-4">{children}</div> : null}
    </section>
  );
}
