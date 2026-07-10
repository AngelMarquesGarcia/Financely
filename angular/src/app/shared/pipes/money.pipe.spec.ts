import { describe, it, expect } from 'vitest';
import { MoneyPipe } from './money.pipe';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('formats cents with symbol by default', () => {
    expect(pipe.transform(2250)).toBe('22.50 €');
  });

  it('formats cents without symbol when withSymbol is false', () => {
    expect(pipe.transform(2250, false)).toBe('22.50');
  });

  it('formats zero', () => {
    expect(pipe.transform(0)).toBe('0.00 €');
  });

  it('formats large amount', () => {
    expect(pipe.transform(123456)).toBe('1234.56 €');
  });

  it('returns em dash for null', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });
});
