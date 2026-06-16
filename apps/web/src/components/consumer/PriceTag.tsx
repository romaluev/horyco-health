'use client';

import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/format';

/** Renders a formatted price with the localized currency and optional strikethrough original. */
export function PriceTag({
  amount,
  original,
  className,
}: {
  amount: string | number;
  original?: string | number | null;
  className?: string;
}) {
  const t = useT();
  return (
    <span className={cn('tabular-nums', className)}>
      {formatMoney(amount)} {t('currency')}
      {original != null ? (
        <span className="menu-card-price-old">{formatMoney(original)}</span>
      ) : null}
    </span>
  );
}
