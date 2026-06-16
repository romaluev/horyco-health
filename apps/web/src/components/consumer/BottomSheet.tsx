'use client';

import { type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

/**
 * Bottom sheet built on the Radix dialog primitive (focus trap, escape, scroll lock),
 * styled with the consumer `.modal-*` classes.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-sheet" aria-describedby={undefined}>
          <div className="sheet-grabber" aria-hidden />
          <Dialog.Title className="modal-title">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
