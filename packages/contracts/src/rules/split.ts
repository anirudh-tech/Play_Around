/**
 * Largest-remainder split (DEC-019). Slot 0..remainder-1 receive one extra fil, so shares always
 * sum to the total and differ by at most 1 fil. Slot order is decided by the caller (O-05).
 */
export function splitShares(totalFils: number, capacity: number): number[] {
  assertSplitInput(totalFils, capacity);
  const base = Math.floor(totalFils / capacity);
  const remainder = totalFils % capacity;
  return Array.from({ length: capacity }, (_, slot) => (slot < remainder ? base + 1 : base));
}

export function shareForSlot(totalFils: number, capacity: number, slot: number): number {
  assertSplitInput(totalFils, capacity);
  if (!Number.isInteger(slot) || slot < 0 || slot >= capacity) {
    throw new RangeError(`slot must be an integer in [0, ${capacity - 1}]`);
  }
  const base = Math.floor(totalFils / capacity);
  return slot < totalFils % capacity ? base + 1 : base;
}

/** Largest share, used for display and price filters. */
export function maxShare(totalFils: number, capacity: number): number {
  return shareForSlot(totalFils, capacity, 0);
}

/** Smallest share, checked against the minimum paid share (DEC-020, O-15). */
export function minShare(totalFils: number, capacity: number): number {
  return shareForSlot(totalFils, capacity, capacity - 1);
}

function assertSplitInput(totalFils: number, capacity: number): void {
  if (!Number.isInteger(totalFils) || totalFils < 0) {
    throw new RangeError('totalFils must be a non-negative integer');
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError('capacity must be a positive integer');
  }
}
