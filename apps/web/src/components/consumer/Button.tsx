'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'block' | 'pill';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: '',
  ghost: 'btn-ghost',
};

const SIZE_CLASS: Record<Size, string> = {
  md: '',
  block: 'btn-block',
  pill: 'btn-pill',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  leftIcon?: ReactNode;
}

/** Consumer button primitive mapped to the token-driven `.btn` styles. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', busy, leftIcon, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('btn', VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  );
});
