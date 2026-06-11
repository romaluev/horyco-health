export type AnalyticsRange = 'today' | '7d' | '30d';

export interface AnalyticsPeriod {
  start: Date;
  end: Date;
  label: string;
  range: AnalyticsRange;
}

/** Парсит query range; по умолчанию — today. */
export function parseAnalyticsRange(raw?: string): AnalyticsRange {
  if (raw === '7d' || raw === '30d' || raw === 'today') return raw;
  return 'today';
}

/**
 * Границы периода в UTC с учётом TZ бизнеса.
 * today — календарный день; 7d/30d — скользящее окно до конца «сегодня».
 */
export function analyticsPeriod(range: AnalyticsRange, tzOffsetHours: number, now = Date.now()): AnalyticsPeriod {
  const localMs = now + tzOffsetHours * 3_600_000;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const endUtcMs = Date.UTC(y, m, day + 1) - tzOffsetHours * 3_600_000;
  const end = new Date(endUtcMs);

  let startUtcMs: number;
  let label: string;

  if (range === 'today') {
    startUtcMs = Date.UTC(y, m, day) - tzOffsetHours * 3_600_000;
    label = `${String(day).padStart(2, '0')}.${String(m + 1).padStart(2, '0')}.${y}`;
  } else {
    const days = range === '7d' ? 7 : 30;
    startUtcMs = endUtcMs - days * 24 * 3_600_000;
    const sd = new Date(startUtcMs + tzOffsetHours * 3_600_000);
    const ed = new Date(endUtcMs - 1 + tzOffsetHours * 3_600_000);
    label = `${fmt(sd)} — ${fmt(ed)}`;
  }

  return { start: new Date(startUtcMs), end, label, range };
}

function fmt(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}
