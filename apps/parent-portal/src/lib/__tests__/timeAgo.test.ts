import { describe, it, expect } from 'vitest';
import { compactDurationLabel, secondsSince } from '../timeAgo';

describe('compactDurationLabel', () => {
  it('formats under a minute in seconds', () => {
    expect(compactDurationLabel(0)).toBe('0s');
    expect(compactDurationLabel(45)).toBe('45s');
  });

  it('formats under an hour in minutes, rounded', () => {
    expect(compactDurationLabel(60)).toBe('1m');
    expect(compactDurationLabel(90)).toBe('2m'); // rounds up
    expect(compactDurationLabel(3599)).toBe('60m');
  });

  it('formats an hour or more in hours, rounded', () => {
    expect(compactDurationLabel(3600)).toBe('1h');
    expect(compactDurationLabel(7300)).toBe('2h'); // rounds up
  });

  it('clamps negative input to zero rather than showing a negative duration', () => {
    expect(compactDurationLabel(-30)).toBe('0s');
  });
});

describe('secondsSince', () => {
  it('returns null for a null timestamp', () => {
    expect(secondsSince(null)).toBeNull();
  });

  it('computes whole seconds between the timestamp and the given "now"', () => {
    const now = new Date('2026-09-06T12:00:30Z').getTime();
    expect(secondsSince('2026-09-06T12:00:00Z', now)).toBe(30);
  });

  it('never returns a negative value for a timestamp in the future', () => {
    const now = new Date('2026-09-06T12:00:00Z').getTime();
    expect(secondsSince('2026-09-06T12:05:00Z', now)).toBe(0);
  });
});
