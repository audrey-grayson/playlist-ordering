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
import {
  aggregatePenalty,
  makeObjectiveContext,
  type ObjectiveContext,
  type PathObjective,
} from './fitness';

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
  const { lambda } = ctx.objective;
  const global = aggregatePenalty(ctx.objective, order.map((i) => ctx.songs[i]));
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

/**
 * Largest playlist size we attempt to solve *exactly* with Held–Karp DP. The DP
 * is O(2^n · n^2) time and O(2^n · n) memory; at n=20 that is ~250 MB and under
 * ~2 s, comfortably inside the time budget. Larger playlists are handled by the
 * recursive random-partition strategy in `solveOptimalOrder`.
 */
export const DP_EXACT_MAX = 20;

/** Wall-clock budget for a single optimize run before we split and recurse. */
export const DP_TIME_BUDGET_MS = 4000;

/**
 * Subsets no larger than this are always solved exactly, ignoring the deadline.
 * A DP at this size is a handful of milliseconds, so honoring it guarantees the
 * recursion terminates: partitioning strictly shrinks subsets until they land
 * here and resolve, even if the time budget is already spent.
 */
export const DP_ALWAYS_SAFE = 12;

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** Fisher–Yates shuffle in place, using a pluggable RNG (for determinism in tests). */
function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/**
 * Exact optimal open-path ordering of a *subset* via Held–Karp DP.
 *
 * `subset` is a list of indices into the full song/matrix arrays; `subset[0]`
 * is pinned first. The subset will occupy global positions `[posOffset, …)` in
 * the final concatenation, and `totalN`/`octx` describe the whole playlist — so
 * node penalties for global objectives (energy arc, mood journey) are evaluated
 * at true global positions and the returned cost is this subset's exact
 * contribution to `orderCost` over the full order (minus the single boundary
 * edge to whatever follows, which the caller stitches).
 *
 * Returns `null` if the allocation fails or the `deadline` (ms epoch) is passed
 * mid-solve; the caller then partitions instead.
 */
function heldKarpSubset(
  subset: number[],
  ctx: CostContext,
  totalN: number,
  posOffset: number,
  octx: ObjectiveContext,
  deadline: number,
): number[] | null {
  const { matrix, songs, objective } = ctx;
  const n = subset.length;
  if (n <= 1) return subset.slice();
  if (n === 2) return subset.slice();

  const lambda = objective?.lambda ?? 0;
  const edgeCoef = (1 - lambda) / (totalN - 1);
  const nodeCoef = objective ? lambda / totalN : 0;

  const dist = (a: number, b: number) => edgeCoef * matrix[subset[a]][subset[b]];
  const nodeCost = (local: number, globalPos: number) =>
    objective
      ? nodeCoef * objective.nodePenalty(songs[subset[local]], globalPos, totalN, octx)
      : 0;

  const size = 1 << n;
  let dp: Float64Array;
  let parent: Int32Array;
  try {
    dp = new Float64Array(size * n).fill(Infinity);
    parent = new Int32Array(size * n).fill(-1);
  } catch {
    return null; // out of memory — fall back to partitioning
  }

  const startMask = 1; // bit 0 = pinned start (subset[0])
  dp[startMask * n + 0] = nodeCost(0, posOffset);

  const checkTime = Number.isFinite(deadline);
  let steps = 0;
  for (let S = 0; S < size; S++) {
    if (!(S & startMask)) continue;
    if (checkTime && (++steps & 0x3fff) === 0 && Date.now() > deadline) return null;
    const globalPos = posOffset + popcount(S); // position of the next appended node
    for (let j = 0; j < n; j++) {
      if (!(S & (1 << j))) continue;
      const cur = dp[S * n + j];
      if (cur === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (S & (1 << k)) continue;
        const nS = S | (1 << k);
        const cand = cur + dist(j, k) + nodeCost(k, globalPos);
        if (cand < dp[nS * n + k]) {
          dp[nS * n + k] = cand;
          parent[nS * n + k] = j;
        }
      }
    }
  }

  const full = size - 1;
  let best = Infinity;
  let bestJ = 0;
  for (let j = 0; j < n; j++) {
    if (dp[full * n + j] < best) {
      best = dp[full * n + j];
      bestJ = j;
    }
  }

  // Reconstruct the local path, then map back to the subset's global indices.
  const local: number[] = [];
  let S = full;
  let j = bestJ;
  while (j !== -1) {
    local.push(j);
    const pj = parent[S * n + j];
    S ^= 1 << j;
    j = pj;
  }
  local.reverse();
  return local.map((l) => subset[l]);
}

/**
 * Exact optimal open-path ordering via Held–Karp DP with the fixed start at
 * `startIndex`, over all songs in `ctx`. Thin wrapper kept for callers/tests
 * that want a guaranteed exact answer (no deadline).
 *
 * Only call for `matrix.length <= DP_EXACT_MAX`.
 */
export function heldKarp(startIndex: number, ctx: CostContext): number[] {
  const n = ctx.matrix.length;
  if (n <= 1) return n === 1 ? [startIndex] : [];
  const subset = [startIndex];
  for (let i = 0; i < n; i++) if (i !== startIndex) subset.push(i);
  const octx = makeObjectiveContext(ctx.songs[startIndex]);
  const solved = heldKarpSubset(subset, ctx, n, 0, octx, Infinity);
  return solved ?? nearestNeighborPath(startIndex, ctx.matrix);
}

export interface RecursiveSolveOptions {
  /** Attempt exact DP for subsets up to this size (default DP_EXACT_MAX). */
  exactMax?: number;
  /** Total wall-clock budget in ms before falling back to partitioning. */
  timeBudgetMs?: number;
  /** Injectable RNG for the random partition (default Math.random). */
  rng?: () => number;
}

export interface RecursiveSolveResult {
  /** Full ordering as indices into the song/matrix arrays; starts at `startIndex`. */
  indexOrder: number[];
  /** True if the whole order was solved exactly (no partition was needed). */
  exact: boolean;
  /** Number of exactly-solved leaf segments (1 when fully exact). */
  segments: number;
}

/**
 * Optimal ordering with a fixed start, scaling past the exact-DP ceiling.
 *
 * Small enough playlists are solved exactly (Held–Karp). When the playlist is
 * too large to allocate, or the time budget is exhausted mid-solve, we randomly
 * partition the *remaining* tracks into two halves — the pinned first song stays
 * first — and recurse on each half independently, then concatenate. Each half is
 * a smaller subproblem that is itself solved exactly (or split again), so the
 * result is a sequence of locally-optimal segments produced within the budget.
 */
export function solveOptimalOrder(
  startIndex: number,
  ctx: CostContext,
  opts: RecursiveSolveOptions = {},
): RecursiveSolveResult {
  const n = ctx.matrix.length;
  if (n <= 1) return { indexOrder: n === 1 ? [startIndex] : [], exact: true, segments: n };

  const exactMax = Math.max(2, opts.exactMax ?? DP_EXACT_MAX);
  const deadline = Date.now() + (opts.timeBudgetMs ?? DP_TIME_BUDGET_MS);
  const rng = opts.rng ?? Math.random;
  const octx = makeObjectiveContext(ctx.songs[startIndex]);

  // `subset[0]` is always the pinned-first song for that subproblem.
  const solve = (
    subset: number[],
    posOffset: number,
  ): RecursiveSolveResult => {
    const m = subset.length;
    if (m <= 1) return { indexOrder: subset.slice(), exact: true, segments: m };

    if (m <= exactMax) {
      // Subsets at/under DP_ALWAYS_SAFE ignore the deadline so recursion always
      // bottoms out even after the budget is spent.
      const dl = m <= DP_ALWAYS_SAFE ? Infinity : deadline;
      const exact = heldKarpSubset(subset, ctx, n, posOffset, octx, dl);
      if (exact) return { indexOrder: exact, exact: true, segments: 1 };
    }

    // Too big or timed out: randomly split the tail, keep the pinned song first.
    const first = subset[0];
    const rest = subset.slice(1);
    shuffleInPlace(rest, rng);
    const half = Math.ceil(rest.length / 2);
    const aSub = [first, ...rest.slice(0, half)];
    const bSub = rest.slice(half);

    const a = solve(aSub, posOffset);
    if (bSub.length === 0) {
      return { indexOrder: a.indexOrder, exact: false, segments: a.segments };
    }
    const b = solve(bSub, posOffset + a.indexOrder.length);
    return {
      indexOrder: [...a.indexOrder, ...b.indexOrder],
      exact: false,
      segments: a.segments + b.segments,
    };
  };

  const subset = [startIndex];
  for (let i = 0; i < n; i++) if (i !== startIndex) subset.push(i);
  return solve(subset, 0);
}
