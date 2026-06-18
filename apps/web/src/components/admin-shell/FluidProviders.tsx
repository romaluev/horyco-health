'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { ShapeProvider } from '@/lib/shape-context';
import { SurfaceProvider } from '@/lib/surface-context';
import { IconProvider } from '@/lib/icon-context';

/** Fluid Functionalism providers for admin surfaces (motion, shape, elevation, icons). */
export function FluidProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ShapeProvider defaultShape="rounded">
        <SurfaceProvider value={1}>
          <IconProvider defaultLibrary="lucide">{children}</IconProvider>
        </SurfaceProvider>
      </ShapeProvider>
    </MotionConfig>
  );
}
