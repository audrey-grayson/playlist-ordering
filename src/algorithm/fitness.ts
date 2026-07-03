// Selectable fitness presets. Each preset defines a weight profile over the
// distance components and, optionally, a *global* path objective that scores
// the whole ordering beyond pure adjacency smoothness (e.g. an energy arc).

import type { DistanceWeights, Song } from './types';

export type PresetId =
  | 'harmonic'
  | 'smooth'
  | 'energyArc'
  | 'moodJourney'
  | 'custom';

/**
 * A global objective returns a penalty in [0,1] for an ordering (lower is
 * better). `lambda` sets how much it counts relative to adjacency cost:
 * total = (1 - lambda) * avgAdjacency + lambda * globalPenalty.
 */
export interface PathObjective {
  lambda: number;
  penalty: (order: Song[]) => number;
}

export interface FitnessPreset {
  id: PresetId;
  name: string;
  description: string;
  weights: DistanceWeights;
  objective?: PathObjective;
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/**
 * Target energy arc: rise from a modest level to a peak around 70% of the way
 * through, then cool down. Penalty is mean squared deviation of each track's
 * energy from the target curve.
 */
function energyArcPenalty(order: Song[]): number {
  const n = order.length;
  if (n < 2) return 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0..1
    // Skewed hump peaking at t≈0.7.
    const peak = 0.7;
    const target =
      t <= peak
        ? 0.35 + (0.95 - 0.35) * (t / peak)
        : 0.95 - (0.95 - 0.4) * ((t - peak) / (1 - peak));
    const d = order[i].features.energy - target;
    acc += d * d;
  }
  return Math.min(1, acc / n);
}

/**
 * Mood journey: valence should climb steadily from the first track's mood to a
 * bright target. Penalty is mean squared deviation from that linear ramp.
 */
function moodJourneyPenalty(order: Song[]): number {
  const n = order.length;
  if (n < 2) return 0;
  const start = order[0].features.valence;
  const end = 0.85;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const target = start + (end - start) * t;
    const d = order[i].features.valence - target;
    acc += d * d;
  }
  return Math.min(1, acc / n);
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
    objective: { lambda: 0.55, penalty: energyArcPenalty },
  },
  moodJourney: {
    id: 'moodJourney',
    name: 'Mood Journey',
    description:
      'Lift the mood: order tracks so valence (musical positivity) climbs steadily from start to finish.',
    weights: { key: 0.4, tempo: 0.4, section: 0.3, timbre: 0.6, loudness: 0.3 },
    objective: { lambda: 0.55, penalty: moodJourneyPenalty },
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

export { mean };
