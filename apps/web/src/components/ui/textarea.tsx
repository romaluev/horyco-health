'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useShape } from '@/lib/shape-context';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    const shape = useShape();
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full px-3 py-2 text-[13px] shadow-1 bg-background text-foreground',
          'placeholder:text-muted-foreground transition-all duration-80',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6B97FF]',
          'disabled:cursor-not-allowed disabled:opacity-50 resize-y font-inherit',
          shape.input,
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
