// Orchestrates a full optimization run: resolve preset + weights, build the
// distance matrix, construct with nearest-neighbor from the chosen start song,
// improve with local search, and report before/after stats.

import { avgAdjacency, buildDistanceMatrix, localSearch, nearestNeighborPath, orderCost, type CostContext, type SolveOptions } from './tsp';
import { FITNESS_PRESETS, type PresetId } from './fitness';
import type { DistanceWeights, Song } from './types';

export interface OptimizeRequest {
  songs: Song[];
  presetId: PresetId;
  /** Overrides the preset's weights (e.g. from the custom sliders). */
  weights?: DistanceWeights;
  /** Track id to place first. Defaults to the current first song. */
  startId?: string;
  solve?: SolveOptions;
}

export interface OptimizeResult {
  /** Reordered songs (length preserved; same set as input). */
  order: Song[];
  /** Indices into the *input* array, in the new order. */
  indexOrder: number[];
  weights: DistanceWeights;
  presetId: PresetId;
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

  const constructed = nearestNeighborPath(startIndex, matrix);
  const improved = localSearch(constructed, ctx, req.solve);

  const originalCost = orderCost(original, ctx);
  const optimizedCost = orderCost(improved, ctx);
  const improvementPct =
    originalCost > 0 ? ((originalCost - optimizedCost) / originalCost) * 100 : 0;

  return {
    order: improved.map((i) => songs[i]),
    indexOrder: improved,
    weights,
    presetId: req.presetId,
    stats: {
      originalCost,
      optimizedCost,
      originalAvgAdjacency: avgAdjacency(original, matrix),
      optimizedAvgAdjacency: avgAdjacency(improved, matrix),
      improvementPct,
    },
  };
}
