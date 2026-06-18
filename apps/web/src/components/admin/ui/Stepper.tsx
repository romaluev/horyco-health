'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Compact quantity stepper for admin forms. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 100,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-input bg-background px-1 py-0.5 shadow-sm',
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Minus className="size-4" />
      </Button>
      <span className="min-w-8 text-center text-sm font-medium tabular-nums">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
