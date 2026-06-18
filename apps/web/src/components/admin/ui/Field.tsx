'use client';

import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Label + control + optional error/hint wrapper. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
  compact,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('space-y-1.5', compact && 'space-y-1', className)}>
      <Label htmlFor={htmlFor} className={cn(compact && 'text-xs')}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
