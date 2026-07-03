// Open-path TSP solver with a fixed start node. "Open path" because a playlist
// has a first and last track — we do not return to the start. Distances are
// directional (asymmetric), so segment reversals recompute internal edges.
//
// Construction: nearest-neighbor from the fixed start.
// Improvement: 2-opt + Or-opt local search under a time/iteration budget,
// scored by a pluggable cost function (adjacency sum, optionally blended with a
// global objective).

import { songDistance } from './distance';
import type { DistanceWeights, Song } from './types';
import type { PathObjective } from './fitness';

/** N×N directional distance matrix: matrix[i][j] = d(songs[i] → songs[j]). */
export function buildDistanceMatrix(
  songs: Song[],
  weights: DistanceWeights,
): number[][] {
  const n = songs.length;
  const m: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      m[i][j] = songDistance(songs[i].features, songs[j].features, weights);
    }
  }
  return m;
}

/** Sum of adjacent directional edges along an index path. */
export function pathEdgeSum(order: number[], matrix: number[][]): number {
  let sum = 0;
  for (let i = 0; i < order.length - 1; i++) sum += matrix[order[i]][order[i + 1]];
  return sum;
}

/** Average adjacency cost in [0,1] (edge sum / #edges). */
export function avgAdjacency(order: number[], matrix: number[][]): number {
  return order.length < 2 ? 0 : pathEdgeSum(order, matrix) / (order.length - 1);
}

export interface CostContext {
  matrix: number[][];
  songs: Song[];
  objective?: PathObjective;
}

/** Total cost to minimize for an index order (lower is better). */
export function orderCost(order: number[], ctx: CostContext): number {
  const adjacency = avgAdjacency(order, ctx.matrix);
  if (!ctx.objective) return adjacency;
  const { lambda, penalty } = ctx.objective;
  const global = penalty(order.map((i) => ctx.songs[i]));
  return (1 - lambda) * adjacency + lambda * global;
}

/** Nearest-neighbor construction from a fixed start index. */
export function nearestNeighborPath(startIndex: number, matrix: number[][]): number[] {
  const n = matrix.length;
  const visited = new Array<boolean>(n).fill(false);
  const order = [startIndex];
  visited[startIndex] = true;
  let current = startIndex;
  for (let step = 1; step < n; step++) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      if (matrix[current][j] < bestD) {
        bestD = matrix[current][j];
        best = j;
      }
    }
    order.push(best);
    visited[best] = true;
    current = best;
  }
  return order;
}

export interface SolveOptions {
  timeBudgetMs?: number;
  maxPasses?: number;
}

/**
 * Improve an order with 2-opt (segment reversal) and Or-opt (relocate a short
 * run). Index 0 (the fixed start) never moves. Stops on no improvement, or when
 * the time/pass budget is exhausted.
 */
export function localSearch(
  initial: number[],
  ctx: CostContext,
  opts: SolveOptions = {},
): number[] {
  const timeBudgetMs = opts.timeBudgetMs ?? 2000;
  const maxPasses = opts.maxPasses ?? 40;
  const n = initial.length;
  if (n < 4) return initial.slice();

  let best = initial.slice();
  let bestCost = orderCost(best, ctx);
  const deadline = Date.now() + timeBudgetMs;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    // 2-opt: reverse segment [i..j], i >= 1 to keep the start fixed.
    for (let i = 1; i < n - 1; i++) {
      if (Date.now() > deadline) return best;
      for (let j = i + 1; j < n; j++) {
        const candidate = best.slice();
        let lo = i;
        let hi = j;
        while (lo < hi) {
          const tmp = candidate[lo];
          candidate[lo] = candidate[hi];
          candidate[hi] = tmp;
          lo++;
          hi--;
        }
        const c = orderCost(candidate, ctx);
        if (c + 1e-9 < bestCost) {
          best = candidate;
          bestCost = c;
          improved = true;
        }
      }
    }

    // Or-opt: relocate runs of length 1..3 to a better position.
    for (let len = 1; len <= 3; len++) {
      for (let i = 1; i + len <= n; i++) {
        if (Date.now() > deadline) return best;
        const seg = best.slice(i, i + len);
        const rest = best.slice(0, i).concat(best.slice(i + len));
        for (let k = 1; k <= rest.length; k++) {
          if (k >= i && k <= i) continue; // no-op reinsert at same spot
          const candidate = rest.slice(0, k).concat(seg, rest.slice(k));
          const c = orderCost(candidate, ctx);
          if (c + 1e-9 < bestCost) {
            best = candidate;
            bestCost = c;
            improved = true;
          }
        }
      }
    }

    if (!improved) break;
  }
  return best;
}
