// Directional distance d(A → B) in [0,1] between two songs, blended from
// several normalized musical components with tunable weights. Direction matters
// because transition components compare the *end* of A to the *start* of B.

import { harmonicDistance } from './keyDistance';
import type { DistanceWeights, SectionEdge, SongFeatures } from './types';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Tempo distance, tolerant of half/double-time transitions (128↔64 BPM reads
 * as close). Normalized so a ~40 BPM gap ≈ 1.
 */
export function tempoDistance(a: number, b: number): number {
  if (!a || !b) return 0.5;
  const candidates = [b, b * 2, b / 2];
  const diff = Math.min(...candidates.map((c) => Math.abs(a - c)));
  return clamp01(diff / 40);
}

/** Loudness continuity, normalized by ~14 dB. */
function loudnessDistance(a: number, b: number): number {
  return clamp01(Math.abs(a - b) / 14);
}

/** Euclidean distance over energy/valence/danceability/acousticness. */
function timbreDistance(a: SongFeatures, b: SongFeatures): number {
  const de = a.energy - b.energy;
  const dv = a.valence - b.valence;
  const dd = a.danceability - b.danceability;
  const da = a.acousticness - b.acousticness;
  return clamp01(Math.sqrt((de * de + dv * dv + dd * dd + da * da) / 4));
}

/**
 * Boundary match: how smoothly the end of A flows into the start of B, using
 * section edges from audio analysis when present. Combines loudness, tempo,
 * and key continuity at the seam. Neutral (0.5) when edges are unavailable.
 */
function sectionDistance(a: SongFeatures, b: SongFeatures): number {
  const outro: SectionEdge | undefined = a.outro;
  const intro: SectionEdge | undefined = b.intro;
  if (!outro || !intro) return 0.5;
  const loud = loudnessDistance(outro.loudness, intro.loudness);
  const tempo = tempoDistance(outro.tempo, intro.tempo);
  const key = harmonicDistance(outro.key, outro.mode, intro.key, intro.mode);
  return clamp01(0.4 * loud + 0.3 * tempo + 0.3 * key);
}

/** Key component: prefer the seam keys (A's outro → B's intro) when available. */
function keyComponent(a: SongFeatures, b: SongFeatures): number {
  const ka = a.outro?.key ?? a.key;
  const ma = a.outro?.mode ?? a.mode;
  const kb = b.intro?.key ?? b.key;
  const mb = b.intro?.mode ?? b.mode;
  return harmonicDistance(ka, ma, kb, mb);
}

/**
 * Blended directional distance A → B. Each component in [0,1]; the result is a
 * weight-normalized average so it stays in [0,1] regardless of the weights.
 */
export function songDistance(
  a: SongFeatures,
  b: SongFeatures,
  w: DistanceWeights,
): number {
  const parts: Array<[number, number]> = [
    [w.key, keyComponent(a, b)],
    [w.tempo, tempoDistance(a.tempo, b.tempo)],
    [w.section, sectionDistance(a, b)],
    [w.timbre, timbreDistance(a, b)],
    [w.loudness, loudnessDistance(a.loudness, b.loudness)],
  ];
  let wsum = 0;
  let acc = 0;
  for (const [weight, value] of parts) {
    if (weight <= 0) continue;
    wsum += weight;
    acc += weight * value;
  }
  if (wsum === 0) return 0.5;
  return clamp01(acc / wsum);
}
