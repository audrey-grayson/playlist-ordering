// Selectable fitness presets. Each preset defines a weight profile over the
// distance components and, optionally, a *global* path objective that scores
// the whole ordering beyond pure adjacency smoothness (e.g. an energy arc).
//
// Global objectives are expressed as a *per-position node penalty* rather than
// a whole-order function. This keeps them position-decomposable, which lets the
// exact Held–Karp dynamic-programming solver fold them into its edge costs and
// still find the true optimum (see tsp.ts).

import type { DistanceWeights, Song } from './types';

export type PresetId =
  | 'harmonic'
  | 'smooth'
  | 'energyArc'
  | 'moodJourney'
  | 'custom';

/** Data derived once from the fixed start song, shared by all node penalties. */
export interface ObjectiveContext {
  startValence: number;
}

/**
 * A global objective. `nodePenalty` returns the penalty in [0,1] for placing a
 * song at 0-based `position` in a path of length `n` (lower is better).
 * `lambda` sets how much it counts relative to adjacency cost:
 *   total = (1 - lambda) * avgAdjacency + lambda * meanNodePenalty.
 */
export interface PathObjective {
  lambda: number;
  nodePenalty: (
    song: Song,
    position: number,
    n: number,
    ctx: ObjectiveContext,
  ) => number;
}

export interface FitnessPreset {
  id: PresetId;
  name: string;
  description: string;
  weights: DistanceWeights;
  objective?: PathObjective;
}

/** Build the shared objective context from a path's fixed first song. */
export function makeObjectiveContext(startSong: Song | undefined): ObjectiveContext {
  return { startValence: startSong?.features.valence ?? 0.5 };
}

/** Mean per-node penalty over an ordering, in [0,1]. */
export function aggregatePenalty(objective: PathObjective, order: Song[]): number {
  const n = order.length;
  if (n === 0) return 0;
  const ctx = makeObjectiveContext(order[0]);
  let acc = 0;
  for (let i = 0; i < n; i++) acc += objective.nodePenalty(order[i], i, n, ctx);
  return acc / n;
}

/**
 * Target energy arc: rise from a modest level to a peak around 70% of the way
 * through, then cool down. Node penalty is the squared deviation of the track's
 * energy from the target at its position.
 */
function energyArcNodePenalty(song: Song, position: number, n: number): number {
  if (n < 2) return 0;
  const t = position / (n - 1); // 0..1
  const peak = 0.7;
  const target =
    t <= peak
      ? 0.35 + (0.95 - 0.35) * (t / peak)
      : 0.95 - (0.95 - 0.4) * ((t - peak) / (1 - peak));
  const d = song.features.energy - target;
  return d * d; // in [0,1] since energy and target are in [0,1]
}

/**
 * Mood journey: valence should climb steadily from the first track's mood to a
 * bright target. Node penalty is squared deviation from that linear ramp.
 */
function moodJourneyNodePenalty(
  song: Song,
  position: number,
  n: number,
  ctx: ObjectiveContext,
): number {
  if (n < 2) return 0;
  const t = position / (n - 1);
  const end = 0.85;
  const target = ctx.startValence + (end - ctx.startValence) * t;
  const d = song.features.valence - target;
  return d * d;
}

export const FITNESS_PRESETS: Record<PresetId, FitnessPreset> = {
  harmonic: {
    id: 'harmonic',
    name: 'Harmonic Mixing',
    description:
      'DJ-style: prioritize compatible keys (circle of fifths) and matching tempo for seamless beat-matched transitions.',
    weights: { key: 1.0, tempo: 0.8, section: 0.3, timbre: 0.2, loudness: 0.3 },
  },
  smooth: {
    id: 'smooth',
    name: 'Smooth Transitions',
    description:
      'Match the end of each song to the start of the next — loudness and section-boundary continuity above all.',
    weights: { key: 0.4, tempo: 0.5, section: 1.0, timbre: 0.4, loudness: 0.7 },
  },
  energyArc: {
    id: 'energyArc',
    name: 'Energy Arc',
    description:
      'Shape the set as a journey: build energy to a peak ~70% through, then cool down — while keeping transitions smooth.',
    weights: { key: 0.4, tempo: 0.5, section: 0.4, timbre: 0.6, loudness: 0.4 },
    objective: { lambda: 0.55, nodePenalty: energyArcNodePenalty },
  },
  moodJourney: {
    id: 'moodJourney',
    name: 'Mood Journey',
    description:
      'Lift the mood: order tracks so valence (musical positivity) climbs steadily from start to finish.',
    weights: { key: 0.4, tempo: 0.4, section: 0.3, timbre: 0.6, loudness: 0.3 },
    objective: { lambda: 0.55, nodePenalty: moodJourneyNodePenalty },
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    description: 'Set the component weights yourself.',
    weights: { key: 0.6, tempo: 0.6, section: 0.5, timbre: 0.5, loudness: 0.4 },
  },
};

export const PRESET_ORDER: PresetId[] = [
  'harmonic',
  'smooth',
  'energyArc',
  'moodJourney',
  'custom',
];
