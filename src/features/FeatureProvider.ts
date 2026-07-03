import type { SongFeatures } from '../algorithm/types';
import type { SpotifyTrack } from '../api/types';

/**
 * Abstraction over the source of per-track musical features. Two impls exist:
 * - SpotifyFeatureProvider: the real (now-deprecated) audio-features/analysis
 *   endpoints.
 * - MockFeatureProvider: deterministic synthetic features seeded by track id,
 *   so the UI and algorithm work end-to-end without credentials or the
 *   deprecated endpoints.
 */
export interface FeatureProvider {
  readonly synthetic: boolean;
  /**
   * Return features for every track, keyed by track id. Implementations should
   * tolerate partial/missing data and never throw for individual tracks.
   */
  getFeatures(tracks: SpotifyTrack[]): Promise<Map<string, SongFeatures>>;
}
