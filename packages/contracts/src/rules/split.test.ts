import { describe, expect, it } from 'vitest';
import { maxShare, minShare, shareForSlot, splitShares } from './split';

describe('splitShares', () => {
  it.each([
    [10_000, 3, [3334, 3333, 3333]],
    [12_000, 4, [3000, 3000, 3000, 3000]],
    [10_000, 6, [1667, 1667, 1667, 1667, 1666, 1666]],
    [0, 5, [0, 0, 0, 0, 0]],
    [1, 2, [1, 0]],
  ])('splits %i fils across %i slots', (total, capacity, expected) => {
    expect(splitShares(total, capacity)).toEqual(expected);
  });

  it('always sums to the total and differs by at most 1 fil', () => {
    for (let capacity = 1; capacity <= 50; capacity++) {
      for (const total of [0, 1, 999, 10_000, 123_457, 1_000_000]) {
        const shares = splitShares(total, capacity);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rejects invalid input', () => {
    expect(() => splitShares(-1, 2)).toThrow(RangeError);
    expect(() => splitShares(100.5, 2)).toThrow(RangeError);
    expect(() => splitShares(100, 0)).toThrow(RangeError);
  });
});

describe('shareForSlot', () => {
  it('matches splitShares for every slot', () => {
    const shares = splitShares(10_000, 6);
    shares.forEach((share, slot) => expect(shareForSlot(10_000, 6, slot)).toBe(share));
  });

  it('rejects out-of-range slots', () => {
    expect(() => shareForSlot(100, 3, 3)).toThrow(RangeError);
  });

  it('exposes the largest and smallest share', () => {
    expect(maxShare(10_000, 3)).toBe(3334);
    expect(minShare(10_000, 3)).toBe(3333);
  });
});
