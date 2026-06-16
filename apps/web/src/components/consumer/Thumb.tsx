'use client';

import { UtensilsCrossed, type LucideIcon } from 'lucide-react';

type ThumbVariant = 'cart' | 'order';

const IMG_CLASS: Record<ThumbVariant, string> = {
  cart: 'cart-thumb',
  order: 'order-item-thumb',
};

const PLACEHOLDER_CLASS: Record<ThumbVariant, string> = {
  cart: 'cart-thumb-placeholder',
  order: 'order-item-thumb order-item-thumb-empty',
};

const ICON_SIZE: Record<ThumbVariant, number> = {
  cart: 22,
  order: 16,
};

/** Image thumbnail with an icon placeholder; used by cart lines and order item rows. */
export function Thumb({
  src,
  alt,
  variant = 'cart',
  icon: Icon = UtensilsCrossed,
}: {
  src?: string | null;
  alt: string;
  variant?: ThumbVariant;
  icon?: LucideIcon;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={IMG_CLASS[variant]} src={src} alt={alt} loading="lazy" />
    );
  }
  return (
    <div className={PLACEHOLDER_CLASS[variant]} aria-hidden>
      <Icon size={ICON_SIZE[variant]} />
    </div>
  );
}
