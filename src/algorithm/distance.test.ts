import { describe, it, expect } from 'vitest';
import { songDistance, tempoDistance } from './distance';
import { makeFeatures } from './testUtils';
import type { DistanceWeights } from './types';

const W: DistanceWeights = {
  key: 1,
  tempo: 1,
  section: 1,
  timbre: 1,
  loudness: 1,
};

describe('tempoDistance', () => {
  it('is 0 for identical tempo', () => {
    expect(tempoDistance(120, 120)).toBe(0);
  });
  it('treats half/double time as close', () => {
    expect(tempoDistance(128, 64)).toBe(0); // double-time match
    expect(tempoDistance(70, 140)).toBe(0);
  });
  it('grows with the gap', () => {
    expect(tempoDistance(120, 130)).toBeLessThan(tempoDistance(120, 150));
  });
});

describe('songDistance', () => {
  it('is ~0 for identical features when section data is absent', () => {
    // The section component compares end-of-A to start-of-B, so it is only
    // meaningful with edge data; without it, exclude it from the blend.
    const noSection: DistanceWeights = { ...W, section: 0 };
    const f = makeFeatures('a');
    expect(songDistance(f, makeFeatures('a'), noSection)).toBeCloseTo(0, 5);
  });

  it('returns a value in [0,1]', () => {
    const a = makeFeatures('a', { key: 0, tempo: 120, energy: 0.1 });
    const b = makeFeatures('b', { key: 6, tempo: 175, energy: 0.9 });
    const d = songDistance(a, b, W);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it('is directional: A→B smooth, B→A jarring', () => {
    // a.outro matches b.intro (smooth forward), but b.outro is far from
    // a.intro (jarring backward). Everything else is identical.
    const a = makeFeatures('a', {
      outro: { loudness: -3, tempo: 120, key: 0, mode: 1 },
      intro: { loudness: -3, tempo: 120, key: 0, mode: 1 },
    });
    const b = makeFeatures('b', {
      intro: { loudness: -3, tempo: 120, key: 0, mode: 1 },
      outro: { loudness: -20, tempo: 80, key: 6, mode: 0 },
    });
    const ab = songDistance(a, b, W);
    const ba = songDistance(b, a, W);
    expect(ab).toBeLessThan(ba);
  });

  it('ignores zero-weight components', () => {
    const a = makeFeatures('a', { energy: 0 });
    const b = makeFeatures('b', { energy: 1 });
    const onlyTimbre: DistanceWeights = {
      key: 0,
      tempo: 0,
      section: 0,
      timbre: 1,
      loudness: 0,
    };
    // Differ only in energy → nonzero under timbre weight.
    expect(songDistance(a, b, onlyTimbre)).toBeGreaterThan(0);
  });
});
