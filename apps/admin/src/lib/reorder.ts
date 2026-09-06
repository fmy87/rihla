export interface SequencedItem {
  id: string;
  sequence: number;
}

/**
 * Returns the full stop list with new 1-based sequence numbers after moving
 * one stop up or down by one position. Returns null if the move is out of
 * bounds (e.g. moving the first stop up). Pure — the caller persists the
 * result via reorderStops().
 */
export function computeReorderedSequence<T extends SequencedItem>(
  stops: T[],
  stopId: string,
  direction: -1 | 1
): { id: string; sequence: number }[] | null {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const idx = ordered.findIndex((s) => s.id === stopId);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return null;

  [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
  return ordered.map((s, i) => ({ id: s.id, sequence: i + 1 }));
}
