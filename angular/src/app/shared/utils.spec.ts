import { describe, it, expect } from 'vitest';
import { parseMoney, formatCents } from './utils';

describe('parseMoney', () => {
  it('parses integer string', () => {
    expect(parseMoney('10')).toBe(1000);
  });

  it('parses decimal string', () => {
    expect(parseMoney('22.50')).toBe(2250);
  });

  it('parses comma as decimal separator', () => {
    expect(parseMoney('22,50')).toBe(2250);
  });

  it('returns 0 for empty string', () => {
    expect(parseMoney('')).toBe(0);
  });

  it('returns 0 for whitespace', () => {
    expect(parseMoney('   ')).toBe(0);
  });

  it('throws for negative value', () => {
    expect(() => parseMoney('-5')).toThrow();
  });

  it('throws for non-numeric string', () => {
    expect(() => parseMoney('abc')).toThrow();
  });

  it('rounds to nearest cent', () => {
    expect(parseMoney('10.999')).toBe(1100);
  });
});

describe('formatCents', () => {
  it('formats 2250 as 22.50', () => {
    expect(formatCents(2250)).toBe('22.50');
  });

  it('formats 0 as 0.00', () => {
    expect(formatCents(0)).toBe('0.00');
  });

  it('formats single-digit cents with leading zero', () => {
    expect(formatCents(101)).toBe('1.01');
  });

  it('round-trips with parseMoney', () => {
    expect(parseMoney(formatCents(1234))).toBe(1234);
  });

  it('formats negative cents', () => {
    expect(formatCents(-500)).toBe('-5.00');
  });
});
