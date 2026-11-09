import { describe, expect, it } from 'vitest';
import { formatAed, parseAedToFils } from './money';

describe('parseAedToFils', () => {
  it.each([
    ['33', 3300],
    ['33.5', 3350],
    ['33.34', 3334],
    [' 0.01 ', 1],
  ])('parses %s', (input, expected) => {
    expect(parseAedToFils(input)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '-5', '1e3'])('rejects %s', (input) => {
    expect(parseAedToFils(input)).toBeNull();
  });
});

describe('formatAed', () => {
  it('formats fils as AED', () => {
    expect(formatAed(3334)).toBe('AED 33.34');
    expect(formatAed(100_000)).toBe('AED 1,000.00');
    expect(formatAed(5)).toBe('AED 0.05');
  });
});
