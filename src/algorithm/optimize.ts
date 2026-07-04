// Orchestrates a full optimization run: resolve preset + weights, build the
// distance matrix, construct with nearest-neighbor from the chosen start song,
// improve with local search, and report before/after stats.

import {
  avgAdjacency,
  buildDistanceMatrix,
  DP_TIME_BUDGET_MS,
  orderCost,
  solveOptimalOrder,
  type CostContext,
} from './tsp';
import { FITNESS_PRESETS, type PresetId } from './fitness';
import type { DistanceWeights, Song } from './types';

export type SolveMethod = 'held-karp' | 'partitioned';

export interface OptimizeRequest {
  songs: Song[];
  presetId: PresetId;
  /** Overrides the preset's weights (e.g. from the custom sliders). */
  weights?: DistanceWeights;
  /** Track id to place first. Defaults to the current first song. */
  startId?: string;
  /** Override the largest N solved exactly by Held–Karp DP. */
  exactMax?: number;
  /** Wall-clock budget (ms) before splitting into halves. */
  timeBudgetMs?: number;
  /** Injectable RNG for the random partition (default Math.random). */
  rng?: () => number;
}

export interface OptimizeResult {
  /** Reordered songs (length preserved; same set as input). */
  order: Song[];
  /** Indices into the *input* array, in the new order. */
  indexOrder: number[];
  weights: DistanceWeights;
  presetId: PresetId;
  /** Whether the result is the exact DP optimum or a partitioned approximation. */
  method: SolveMethod;
  /** Number of exactly-solved segments (1 when fully exact; >1 when partitioned). */
  segments: number;
  stats: {
    originalCost: number;
    optimizedCost: number;
    originalAvgAdjacency: number;
    optimizedAvgAdjacency: number;
    improvementPct: number;
  };
}

export function optimizePlaylist(req: OptimizeRequest): OptimizeResult {
  const { songs } = req;
  const preset = FITNESS_PRESETS[req.presetId];
  const weights = req.weights ?? preset.weights;

  const n = songs.length;
  if (n === 0) {
    return {
      order: [],
      indexOrder: [],
      weights,
      presetId: req.presetId,
      method: 'held-karp',
      segments: 0,
      stats: {
        originalCost: 0,
        optimizedCost: 0,
        originalAvgAdjacency: 0,
        optimizedAvgAdjacency: 0,
        improvementPct: 0,
      },
    };
  }

  const matrix = buildDistanceMatrix(songs, weights);
  const ctx: CostContext = { matrix, songs, objective: preset.objective };

  const startIndex = req.startId
    ? Math.max(0, songs.findIndex((s) => s.id === req.startId))
    : 0;

  // Original order as-is (but rotated so the chosen start leads, for a fair
  // before/after comparison the user can reason about).
  const original = [startIndex, ...songs.map((_, i) => i).filter((i) => i !== startIndex)];

  // Exact dynamic programming (Held–Karp) when it fits within the size ceiling
  // and time budget; otherwise recursively partition into randomly-split halves
  // (the fixed start stays first) and solve each half exactly.
  const solved = solveOptimalOrder(startIndex, ctx, {
    exactMax: req.exactMax,
    timeBudgetMs: req.timeBudgetMs ?? DP_TIME_BUDGET_MS,
    rng: req.rng,
  });
  const improved = solved.indexOrder;
  const method: SolveMethod = solved.exact ? 'held-karp' : 'partitioned';

  const originalCost = orderCost(original, ctx);
  const optimizedCost = orderCost(improved, ctx);
  const improvementPct =
    originalCost > 0 ? ((originalCost - optimizedCost) / originalCost) * 100 : 0;

  return {
    order: improved.map((i) => songs[i]),
    indexOrder: improved,
    weights,
    presetId: req.presetId,
    method,
    segments: solved.segments,
    stats: {
      originalCost,
      optimizedCost,
      originalAvgAdjacency: avgAdjacency(original, matrix),
      optimizedAvgAdjacency: avgAdjacency(improved, matrix),
      improvementPct,
    },
  };
}
