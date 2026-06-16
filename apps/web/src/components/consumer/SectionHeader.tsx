'use client';

import { type ReactNode } from 'react';

/** Sticky screen header with a title and optional controls (search, chips). */
export function SectionHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="screen-header">
      <h1 className="screen-title">{title}</h1>
      {children}
    </div>
  );
}
