const PITCH_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

/** e.g. (0, 1) → "C maj", (9, 0) → "A min", (-1, _) → "—". */
export function keyName(key: number, mode: number): string {
  if (key < 0 || key > 11) return '—';
  return `${PITCH_NAMES[key]} ${mode === 1 ? 'maj' : 'min'}`;
}

/** ms → "m:ss". */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatBpm(tempo: number): string {
  return tempo ? `${Math.round(tempo)} BPM` : '—';
}
