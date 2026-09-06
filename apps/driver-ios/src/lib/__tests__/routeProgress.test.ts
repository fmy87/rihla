import { stopProgressState, findCurrentStop, type ProgressStop } from '../routeProgress';

function stop(id: string, sequence: number, arrivedAt: string | null = null, isSkipped = false): ProgressStop {
  return { id, sequence, arrivedAt, isSkipped };
}

describe('stopProgressState', () => {
  it('marks a stop with arrived_at as completed', () => {
    const stops = [stop('a', 1, '2026-01-01T08:00:00Z')];
    expect(stopProgressState(stops[0], stops)).toBe('completed');
  });

  it('marks the first unresolved, non-skipped stop as current', () => {
    const stops = [stop('a', 1, '2026-01-01T08:00:00Z'), stop('b', 2), stop('c', 3)];
    expect(stopProgressState(stops[1], stops)).toBe('current');
    expect(stopProgressState(stops[2], stops)).toBe('upcoming');
  });

  it('skips a skipped stop when finding the current one', () => {
    const stops = [stop('a', 1), stop('b', 2, null, true), stop('c', 3)];
    expect(stopProgressState(stops[0], stops)).toBe('current');
    expect(stopProgressState(stops[2], stops)).toBe('upcoming');
  });

  it('is order-independent — sequence, not array position, decides current', () => {
    const stops = [stop('c', 3), stop('a', 1), stop('b', 2, '2026-01-01T08:00:00Z')];
    expect(stopProgressState(stop('c', 3), stops)).toBe('upcoming');
    expect(stopProgressState(stop('a', 1), stops)).toBe('current');
  });
});

describe('findCurrentStop', () => {
  it('returns null when every stop is resolved or skipped', () => {
    const stops = [stop('a', 1, '2026-01-01T08:00:00Z'), stop('b', 2, null, true)];
    expect(findCurrentStop(stops)).toBeNull();
  });

  it('returns the first unresolved, non-skipped stop in sequence order', () => {
    const stops = [stop('b', 2), stop('a', 1, '2026-01-01T08:00:00Z'), stop('c', 3)];
    expect(findCurrentStop(stops)?.id).toBe('b');
  });
});
