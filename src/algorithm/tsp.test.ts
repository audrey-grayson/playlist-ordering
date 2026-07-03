import { describe, it, expect } from 'vitest';
import {
  buildDistanceMatrix,
  heldKarp,
  localSearch,
  nearestNeighborPath,
  orderCost,
  type CostContext,
} from './tsp';
import { FITNESS_PRESETS } from './fitness';
import { makeSong } from './testUtils';
import type { DistanceWeights, Song } from './types';

const W: DistanceWeights = {
  key: 1,
  tempo: 1,
  section: 0,
  timbre: 1,
  loudness: 1,
};

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

/** Exhaustive optimum with a fixed start, for small n. */
function bruteOptimal(startIndex: number, ctx: CostContext): number[] {
  const n = ctx.matrix.length;
  const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== startIndex);
  let best: number[] = [startIndex, ...rest];
  let bestCost = Infinity;
  for (const p of permutations(rest)) {
    const order = [startIndex, ...p];
    const c = orderCost(order, ctx);
    if (c < bestCost) {
      bestCost = c;
      best = order;
    }
  }
  return best;
}

function makeVariedSongs(n: number): Song[] {
  return Array.from({ length: n }, (_, i) =>
    makeSong(String(i), {
      key: (i * 5) % 12,
      mode: i % 2,
      tempo: 80 + ((i * 37) % 90),
      energy: ((i * 3) % 10) / 10,
      valence: ((i * 7) % 10) / 10,
      loudness: -12 + ((i * 13) % 10),
    }),
  );
}

describe('heldKarp', () => {
  it('preserves the set and the fixed start', () => {
    const songs = makeVariedSongs(10);
    const matrix = buildDistanceMatrix(songs, W);
    const ctx: CostContext = { matrix, songs };
    const order = heldKarp(4, ctx);
    expect(order[0]).toBe(4);
    expect(order.length).toBe(10);
    expect(new Set(order).size).toBe(10);
  });

  it('matches the brute-force optimum (pure adjacency)', () => {
    const songs = makeVariedSongs(7);
    const matrix = buildDistanceMatrix(songs, W);
    const ctx: CostContext = { matrix, songs };
    for (const start of [0, 3, 6]) {
      const dp = heldKarp(start, ctx);
      const brute = bruteOptimal(start, ctx);
      expect(orderCost(dp, ctx)).toBeCloseTo(orderCost(brute, ctx), 9);
    }
  });

  it('matches the brute-force optimum with a global objective (energy arc)', () => {
    const songs = makeVariedSongs(7);
    const objective = FITNESS_PRESETS.energyArc.objective!;
    const matrix = buildDistanceMatrix(songs, FITNESS_PRESETS.energyArc.weights);
    const ctx: CostContext = { matrix, songs, objective };
    const dp = heldKarp(0, ctx);
    const brute = bruteOptimal(0, ctx);
    expect(orderCost(dp, ctx)).toBeCloseTo(orderCost(brute, ctx), 9);
  });

  it('is never worse than the local-search heuristic', () => {
    const songs = makeVariedSongs(12);
    const matrix = buildDistanceMatrix(songs, W);
    const ctx: CostContext = { matrix, songs };
    const dp = heldKarp(0, ctx);
    const heur = localSearch(nearestNeighborPath(0, matrix), ctx);
    expect(orderCost(dp, ctx)).toBeLessThanOrEqual(orderCost(heur, ctx) + 1e-9);
  });

  it('handles trivial sizes', () => {
    const songs = makeVariedSongs(1);
    const ctx: CostContext = { matrix: buildDistanceMatrix(songs, W), songs };
    expect(heldKarp(0, ctx)).toEqual([0]);
  });
});
