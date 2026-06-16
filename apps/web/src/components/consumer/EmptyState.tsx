'use client';

import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden>
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {subtitle ? <p className="empty-state-sub">{subtitle}</p> : null}
      {action}
    </div>
  );
}
