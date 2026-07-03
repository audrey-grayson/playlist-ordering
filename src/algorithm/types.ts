// Normalized musical model used by the reordering algorithm. Decoupled from
// Spotify's raw API shapes so a different data source can be swapped in.

/** A section boundary snapshot — used to match end-of-A to start-of-B. */
export interface SectionEdge {
  loudness: number; // dB
  tempo: number; // BPM
  key: number; // 0..11, -1 unknown
  mode: number; // 1 major / 0 minor
}

/** Everything the algorithm needs to know about one track. */
export interface SongFeatures {
  id: string;
  key: number; // 0..11 pitch class, -1 unknown
  mode: number; // 1 major / 0 minor
  tempo: number; // BPM
  energy: number; // 0..1
  valence: number; // 0..1
  danceability: number; // 0..1
  acousticness: number; // 0..1
  loudness: number; // dB
  /** First/last section edges when audio analysis is available. */
  intro?: SectionEdge;
  outro?: SectionEdge;
  /** True if these features are synthesized (mock) rather than from Spotify. */
  synthetic: boolean;
}

/** Track display metadata + its features, as consumed by the UI + algorithm. */
export interface Song {
  id: string;
  uri: string;
  name: string;
  artists: string;
  albumImage: string | null;
  durationMs: number;
  features: SongFeatures;
}

/**
 * Weights for the distance components. Each in [0, 1]; the blend normalizes by
 * the sum of weights so magnitudes stay comparable across presets.
 */
export interface DistanceWeights {
  key: number;
  tempo: number;
  section: number;
  timbre: number; // energy/valence/danceability/acousticness blend
  loudness: number;
}
