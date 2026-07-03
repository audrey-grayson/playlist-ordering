import { describe, it, expect } from 'vitest';
import {
  circleOfFifthsDistance,
  fifthsIndex,
  harmonicDistance,
  isParallel,
  isRelative,
} from './keyDistance';

describe('fifthsIndex', () => {
  it('places C at 0, G at 1, F at 11', () => {
    expect(fifthsIndex(0)).toBe(0); // C
    expect(fifthsIndex(7)).toBe(1); // G (a fifth up from C)
    expect(fifthsIndex(5)).toBe(11); // F (a fifth down from C)
  });
});

describe('circleOfFifthsDistance', () => {
  it('is 0 for same key and symmetric', () => {
    expect(circleOfFifthsDistance(0, 0)).toBe(0);
    expect(circleOfFifthsDistance(0, 7)).toBe(1); // C↔G
    expect(circleOfFifthsDistance(7, 0)).toBe(1);
  });
  it('is at most 6', () => {
    for (let a = 0; a < 12; a++)
      for (let b = 0; b < 12; b++)
        expect(circleOfFifthsDistance(a, b)).toBeLessThanOrEqual(6);
  });
});

describe('relative / parallel detection', () => {
  it('C major and A minor are relative', () => {
    expect(isRelative(0, 1, 9, 0)).toBe(true);
    expect(isRelative(9, 0, 0, 1)).toBe(true);
  });
  it('C major and C minor are parallel', () => {
    expect(isParallel(0, 1, 0, 0)).toBe(true);
    expect(isParallel(0, 1, 7, 0)).toBe(false);
  });
});

describe('harmonicDistance', () => {
  it('is 0 for identical key/mode', () => {
    expect(harmonicDistance(0, 1, 0, 1)).toBe(0);
  });
  it('is neutral for unknown key', () => {
    expect(harmonicDistance(-1, 1, 0, 1)).toBe(0.5);
  });
  it('ranks adjacent fifth closer than a distant key', () => {
    const adjacent = harmonicDistance(0, 1, 7, 1); // C → G
    const distant = harmonicDistance(0, 1, 6, 1); // C → F# (tritone)
    expect(adjacent).toBeLessThan(distant);
  });
  it('treats relative/parallel keys as close', () => {
    expect(harmonicDistance(0, 1, 9, 0)).toBeLessThan(0.2); // relative
    expect(harmonicDistance(0, 1, 0, 0)).toBeLessThan(0.3); // parallel
  });
  it('always returns a value in [0,1]', () => {
    for (let ka = 0; ka < 12; ka++)
      for (let kb = 0; kb < 12; kb++)
        for (const ma of [0, 1])
          for (const mb of [0, 1]) {
            const d = harmonicDistance(ka, ma, kb, mb);
            expect(d).toBeGreaterThanOrEqual(0);
            expect(d).toBeLessThanOrEqual(1);
          }
  });
});
