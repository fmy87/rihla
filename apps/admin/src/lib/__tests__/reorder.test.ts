import { describe, it, expect } from 'vitest';
import { computeReorderedSequence } from '../reorder';

const stops = [
  { id: 'a', sequence: 1 },
  { id: 'b', sequence: 2 },
  { id: 'c', sequence: 3 },
];

describe('computeReorderedSequence', () => {
  it('moves a stop down and renumbers sequentially', () => {
    const result = computeReorderedSequence(stops, 'a', 1);
    expect(result).toEqual([
      { id: 'b', sequence: 1 },
      { id: 'a', sequence: 2 },
      { id: 'c', sequence: 3 },
    ]);
  });

  it('moves a stop up and renumbers sequentially', () => {
    const result = computeReorderedSequence(stops, 'c', -1);
    expect(result).toEqual([
      { id: 'a', sequence: 1 },
      { id: 'c', sequence: 2 },
      { id: 'b', sequence: 3 },
    ]);
  });

  it('returns null when moving the first stop up (out of bounds)', () => {
    expect(computeReorderedSequence(stops, 'a', -1)).toBeNull();
  });

  it('returns null when moving the last stop down (out of bounds)', () => {
    expect(computeReorderedSequence(stops, 'c', 1)).toBeNull();
  });

  it('returns null for an unknown stop id', () => {
    expect(computeReorderedSequence(stops, 'z', 1)).toBeNull();
  });

  it('is order-independent on input — sorts by sequence first', () => {
    const shuffled = [stops[2], stops[0], stops[1]];
    const result = computeReorderedSequence(shuffled, 'a', 1);
    expect(result).toEqual([
      { id: 'b', sequence: 1 },
      { id: 'a', sequence: 2 },
      { id: 'c', sequence: 3 },
    ]);
  });
});
