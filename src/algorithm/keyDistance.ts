// Harmonic distance between two keys, grounded in the circle of fifths and
// common key relationships used in DJ "harmonic mixing" (the Camelot wheel).
//
// Pitch classes: 0=C, 1=C#, 2=D, ... 11=B. mode: 1=major, 0=minor. key === -1
// means unknown.

/**
 * Position of a pitch class on the circle of fifths (0..11). Advancing by a
 * perfect fifth is +7 semitones; 7 is invertible mod 12 (7*7 ≡ 1), so the
 * position of pitch class `pc` is (7*pc) mod 12.
 */
export function fifthsIndex(pc: number): number {
  return (((pc * 7) % 12) + 12) % 12;
}

/** Steps around the circle of fifths between two pitch classes: 0..6. */
export function circleOfFifthsDistance(a: number, b: number): number {
  const d = Math.abs(fifthsIndex(a) - fifthsIndex(b));
  return Math.min(d, 12 - d);
}

/** True if the two (key,mode) pairs are relative major/minor (e.g. C / Am). */
export function isRelative(
  keyA: number,
  modeA: number,
  keyB: number,
  modeB: number,
): boolean {
  if (modeA === modeB) return false;
  // The relative minor sits 3 semitones below its major (i.e. +9 mod 12).
  const [majKey, minKey] = modeA === 1 ? [keyA, keyB] : [keyB, keyA];
  return (majKey + 9) % 12 === minKey;
}

/** True if same tonic, opposite mode (C major ↔ C minor). */
export function isParallel(
  keyA: number,
  modeA: number,
  keyB: number,
  modeB: number,
): boolean {
  return modeA !== modeB && keyA === keyB;
}

/**
 * Harmonic distance in [0,1]. 0 = identical key. Small for the classic
 * "compatible" moves: adjacent fifth (dominant/subdominant, e.g. V→I),
 * relative major/minor, and parallel major/minor (modulation). Unknown keys
 * return a neutral 0.5.
 */
export function harmonicDistance(
  keyA: number,
  modeA: number,
  keyB: number,
  modeB: number,
): number {
  if (keyA < 0 || keyB < 0) return 0.5;

  if (keyA === keyB && modeA === modeB) return 0;
  if (isRelative(keyA, modeA, keyB, modeB)) return 0.12;
  if (isParallel(keyA, modeA, keyB, modeB)) return 0.22;

  const cof = circleOfFifthsDistance(keyA, keyB); // 0..6
  const base = (cof / 6) * 0.9; // adjacent fifth (cof=1) → 0.15
  // Extra penalty when modes differ without a named close relationship.
  const modePenalty = modeA !== modeB ? 0.15 : 0;
  return Math.min(1, base + modePenalty);
}
