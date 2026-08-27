import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cn, formatCarbon, formatNumber, formatRelativeTime, truncateHash } from './utils';

describe('cn', () => {
  it('joins truthy class values and drops falsy ones', () => {
    expect(cn('a', false, 'b', undefined, null, 0 && 'c')).toBe('a b');
  });
});

describe('formatNumber', () => {
  it('formats a plain number with grouping', () => {
    expect(formatNumber(1234)).toBe('1,234');
  });

  it('parses a numeric string', () => {
    expect(formatNumber('42')).toBe('42');
  });

  it('returns an em dash for a non-numeric string', () => {
    expect(formatNumber('not-a-number')).toBe('—');
  });

  it('respects formatting options', () => {
    expect(formatNumber(1.23456, { maximumFractionDigits: 2 })).toBe('1.23');
  });
});

describe('formatCarbon', () => {
  it('returns an em dash for null', () => {
    expect(formatCarbon(null)).toBe('—');
  });

  it('formats a number with the tCO2e suffix, capped at 4 decimals', () => {
    expect(formatCarbon(1.06643219)).toBe('1.0664 tCO₂e');
  });

  it('formats a numeric string the same way as a number', () => {
    expect(formatCarbon('1.0664')).toBe('1.0664 tCO₂e');
  });

  it('formats zero as a real value, not an em dash', () => {
    expect(formatCarbon(0)).toBe('0 tCO₂e');
  });
});

describe('truncateHash', () => {
  const hash = '46904a0f802ea5cd842d82840f4cc9f7c7f5e62a86bd062fe8cfdbbf7827e7aa';

  it('truncates a long hash to prefix...suffix', () => {
    expect(truncateHash(hash)).toBe('46904a0f...27e7aa');
  });

  it('returns short strings unchanged', () => {
    expect(truncateHash('short')).toBe('short');
  });

  it('respects custom prefix/suffix lengths', () => {
    expect(truncateHash(hash, 4, 4)).toBe('4690...e7aa');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports very recent timestamps as "just now"', () => {
    expect(formatRelativeTime(new Date('2026-08-27T11:59:50.000Z').toISOString())).toBe('just now');
  });

  it('reports minutes for sub-hour gaps', () => {
    expect(formatRelativeTime(new Date('2026-08-27T11:55:00.000Z').toISOString())).toBe('5m ago');
  });

  it('reports hours for sub-day gaps', () => {
    expect(formatRelativeTime(new Date('2026-08-27T09:00:00.000Z').toISOString())).toBe('3h ago');
  });

  it('reports days for sub-month gaps', () => {
    expect(formatRelativeTime(new Date('2026-08-25T12:00:00.000Z').toISOString())).toBe('2d ago');
  });

  it('falls back to an absolute date beyond a month', () => {
    const result = formatRelativeTime(new Date('2026-01-01T12:00:00.000Z').toISOString());
    expect(result).not.toMatch(/ago$/);
    expect(result).toContain('2026');
  });
});
