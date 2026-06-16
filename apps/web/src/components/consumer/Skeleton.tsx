'use client';

import { cn } from '@/lib/utils';

/** Base shimmer block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function MenuSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      <Skeleton className="skeleton-pill" />
      <Skeleton className="skeleton-pill sm" />
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <Skeleton className="skeleton-card-media" />
          <div className="skeleton-card-body">
            <Skeleton className="skeleton-line md" />
            <Skeleton className="skeleton-line lg" />
            <Skeleton className="skeleton-line sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div className="card" key={i}>
          <Skeleton className="skeleton-line md u-mb-2" />
          <Skeleton className="skeleton-line lg u-mb-2" />
          <Skeleton className="skeleton-line sm" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div>
      <Skeleton className="skeleton-hero" />
      <div className="skeleton-detail-body">
        <Skeleton className="skeleton-line title" />
        <Skeleton className="skeleton-line lg u-mb-2" />
        <Skeleton className="skeleton-line lg u-mb-4" />
        <Skeleton className="skeleton-line block" />
      </div>
    </div>
  );
}
