import { describe, it, expect } from 'vitest';
import { tripDurationMinutes } from '../replayDuration';

describe('tripDurationMinutes', () => {
  it('returns null with fewer than two points', () => {
    expect(tripDurationMinutes([])).toBeNull();
    expect(tripDurationMinutes([{ recordedAt: '2026-09-06T06:00:00Z' }])).toBeNull();
  });

  it('computes whole minutes between the first and last point', () => {
    const points = [
      { recordedAt: '2026-09-06T06:00:00Z' },
      { recordedAt: '2026-09-06T06:04:00Z' },
      { recordedAt: '2026-09-06T06:23:00Z' },
    ];
    expect(tripDurationMinutes(points)).toBe(23);
  });

  it('rounds to the nearest minute', () => {
    const points = [{ recordedAt: '2026-09-06T06:00:00Z' }, { recordedAt: '2026-09-06T06:00:40Z' }];
    expect(tripDurationMinutes(points)).toBe(1); // 40s rounds up
  });

  it('ignores intermediate points — only first and last matter', () => {
    const points = [
      { recordedAt: '2026-09-06T06:00:00Z' },
      { recordedAt: '2026-09-06T06:59:00Z' }, // would blow up a naive sum-of-gaps approach
      { recordedAt: '2026-09-06T06:10:00Z' },
    ];
    expect(tripDurationMinutes(points)).toBe(10);
  });
});
