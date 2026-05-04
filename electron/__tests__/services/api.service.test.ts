import { addOne } from '../../services/api.service';
import { describe, it, expect } from '@jest/globals';

describe('addOne', () => {
  it('returns a number', () => {
    expect(typeof addOne()).toBe('number');
  });

  it('increments on each call', () => {
    const first = addOne();
    const second = addOne();
    expect(second).toBe(first + 1);
  });
});
