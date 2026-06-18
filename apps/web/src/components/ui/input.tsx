'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useShape } from '@/lib/shape-context';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    const shape = useShape();
    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full px-3 text-[13px] shadow-1 bg-background text-foreground',
          'placeholder:text-muted-foreground transition-all duration-80',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6B97FF]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          shape.input,
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
