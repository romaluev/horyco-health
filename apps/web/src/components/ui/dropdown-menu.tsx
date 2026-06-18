'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Dropdown, DropdownSeparator } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { spring } from '@/lib/springs';
import { cn } from '@/lib/utils';

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  itemIndex: React.MutableRefObject<number>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error('DropdownMenu components must be used within DropdownMenu');
  return ctx;
}

function extractMenuParts(children: React.ReactNode): { label: string; icon?: LucideIcon } {
  const parts = React.Children.toArray(children);
  let icon: LucideIcon | undefined;
  const labels: string[] = [];
  for (const part of parts) {
    if (typeof part === 'string' || typeof part === 'number') {
      labels.push(String(part));
      continue;
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(part)) {
      if (!icon && typeof part.type === 'function') {
        icon = part.type as LucideIcon;
        continue;
      }
      if (typeof part.props.children === 'string') labels.push(part.props.children);
    }
  }
  return { label: labels.join(' ').trim() || 'Action', icon };
}

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const itemIndex = React.useRef(0);
  itemIndex.current = 0;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target)) {
        const portal = document.getElementById('ff-dropdown-portal');
        if (!portal?.contains(target)) setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, itemIndex }}>
      {children}
    </DropdownMenuContext.Provider>
  );
};

const DropdownMenuTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, children, className, onClick, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useDropdownMenu();

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    onClick?.(e as React.MouseEvent<HTMLButtonElement>);
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      ref: (node: HTMLElement | null) => {
        triggerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
        const childRef = (children as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref;
        if (typeof childRef === 'function') childRef(node);
        else if (childRef && typeof childRef === 'object') (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
      },
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        (children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>).props.onClick?.(e);
        handleClick(e);
      },
      'aria-expanded': open,
      'aria-haspopup': 'menu',
    });
  }

  return (
    <button
      type="button"
      ref={(node) => {
        triggerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
      }}
      className={className}
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={handleClick}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'center' | 'end' }
>(({ className, align = 'start', children, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useDropdownMenu();
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
  }, [open, triggerRef]);

  if (!open || !rect) return null;

  const menuWidth = 288;
  let left = rect.left;
  if (align === 'end') left = rect.right - menuWidth;
  if (align === 'center') left = rect.left + rect.width / 2 - menuWidth / 2;

  return createPortal(
    <div
      id="ff-dropdown-portal"
      style={{
        position: 'fixed',
        top: rect.bottom + 6,
        left: Math.max(8, left),
        zIndex: 50,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
        animate={{ opacity: 1, y: 0, scaleY: 1 }}
        transition={spring.fast}
        style={{ transformOrigin: 'top center' }}
      >
        <Dropdown ref={ref} className={cn('w-72', className)} {...props}>
          {children}
        </Dropdown>
      </motion.div>
    </div>,
    document.body,
  );
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean; disabled?: boolean; onSelect?: () => void }
>(({ className, children, onClick, onSelect, disabled, ...props }, ref) => {
  const { setOpen, itemIndex } = useDropdownMenu();
  const index = itemIndex.current++;
  const { label, icon } = extractMenuParts(children);

  return (
    <MenuItem
      ref={ref}
      index={index}
      label={label}
      icon={icon}
      className={cn(
        (className ?? '').includes('destructive') && 'text-destructive',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      onSelect={
        disabled
          ? undefined
          : () => {
              onSelect?.();
              onClick?.({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent<HTMLDivElement>);
              setOpen(false);
            }
      }
      {...props}
    />
  );
});
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuSeparator = DropdownSeparator;

const DropdownMenuGroup = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="group" className={className} {...props}>
    {children}
  </div>
);

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-2 py-1.5 text-[11px] text-muted-foreground', className)} {...props} />
  ),
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />
);
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuShortcut,
};
