import { describe, it, expect } from 'vitest';
import { discountUntilFromValue } from './discount';

describe('discountUntilFromValue', () => {
  it('parses a positive integer timestamp', () => {
    expect(discountUntilFromValue('1719700000000')).toBe(1719700000000);
  });

  it.each([
    ['undefined', undefined],
    ['empty string', ''],
    ['not a number', 'abc'],
    ['zero', '0'],
    ['negative', '-5'],
  ])('returns null for %s', (_label, raw) => {
    expect(discountUntilFromValue(raw)).toBeNull();
  });
});
