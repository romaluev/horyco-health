import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPeriod, parseAnalyticsRange } from './analytics-range';

describe('parseAnalyticsRange', () => {
  it('defaults to today', () => {
    assert.equal(parseAnalyticsRange(undefined), 'today');
    assert.equal(parseAnalyticsRange('invalid'), 'today');
  });

  it('accepts valid ranges', () => {
    assert.equal(parseAnalyticsRange('7d'), '7d');
    assert.equal(parseAnalyticsRange('30d'), '30d');
  });
});

describe('analyticsPeriod', () => {
  // 2026-06-11 12:00 UTC, TZ+5 → local 2026-06-11 17:00
  const now = Date.UTC(2026, 5, 11, 12, 0, 0);

  it('today spans one local calendar day', () => {
    const p = analyticsPeriod('today', 5, now);
    assert.equal(p.range, 'today');
    assert.equal(p.label, '11.06.2026');
    assert.ok(p.end.getTime() > p.start.getTime());
    const hours = (p.end.getTime() - p.start.getTime()) / 3_600_000;
    assert.equal(hours, 24);
  });

  it('7d window is 7 days ending at end of today', () => {
    const today = analyticsPeriod('today', 5, now);
    const week = analyticsPeriod('7d', 5, now);
    assert.equal(week.end.getTime(), today.end.getTime());
    const days = (week.end.getTime() - week.start.getTime()) / (24 * 3_600_000);
    assert.equal(days, 7);
  });

  it('30d window is 30 days', () => {
    const month = analyticsPeriod('30d', 5, now);
    const days = (month.end.getTime() - month.start.getTime()) / (24 * 3_600_000);
    assert.equal(days, 30);
  });
});
