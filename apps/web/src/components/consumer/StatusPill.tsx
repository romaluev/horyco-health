'use client';

import {
  CheckCircle2,
  ChefHat,
  Clock,
  Package,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { OrderStatus } from '@eatfit/shared';
import { useStatusText } from '@/lib/i18n';

const STATUS_META: Record<OrderStatus, { className: string; Icon: LucideIcon }> = {
  [OrderStatus.Pending]: { className: 'pending', Icon: Clock },
  [OrderStatus.Confirmed]: { className: 'confirmed', Icon: Clock },
  [OrderStatus.Cooking]: { className: 'cooking', Icon: ChefHat },
  [OrderStatus.Ready]: { className: 'ready', Icon: Package },
  [OrderStatus.Delivering]: { className: 'delivering', Icon: Truck },
  [OrderStatus.Done]: { className: 'done', Icon: CheckCircle2 },
  [OrderStatus.Cancelled]: { className: 'cancelled', Icon: XCircle },
};

/** Colored order-status pill with an icon; tone is driven by status tokens in globals.css. */
export function StatusPill({ status }: { status: OrderStatus }) {
  const st = useStatusText();
  const { className, Icon } = STATUS_META[status];
  return (
    <span className={`status-pill ${className}`}>
      <Icon size={14} aria-hidden />
      {st(status)}
    </span>
  );
}
