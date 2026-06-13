/** Named throttlers from AppModule — @SkipThrottle() must list each one explicitly. */
export const THROTTLE_NAMES = ['default', 'auth', 'webhook'] as const;

export type ThrottleName = (typeof THROTTLE_NAMES)[number];

/** Skip every named throttler (bare @SkipThrottle() only skips `default`). */
export const SKIP_ALL_THROTTLE: Record<ThrottleName, true> = {
  default: true,
  auth: true,
  webhook: true,
};

/** Skip auth + webhook; keep default (use with @Throttle on `default`). */
export const SKIP_AUTH_WEBHOOK: Record<'auth' | 'webhook', true> = {
  auth: true,
  webhook: true,
};
