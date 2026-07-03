// Real feature provider backed by Spotify's audio-features + audio-analysis
// endpoints. NOTE: Spotify deprecated these for apps created after Nov 2024;
// callers should be prepared to fall back to MockFeatureProvider on 403/404.

import type { SectionEdge, SongFeatures } from '../algorithm/types';
import { spotifyApi } from '../api/spotifyClient';
import type {
  AnalysisSection,
  SpotifyAudioFeatures,
  SpotifyTrack,
} from '../api/types';
import type { FeatureProvider } from './FeatureProvider';
import { featureCache } from './featureCache';

function edgeFrom(section: AnalysisSection | undefined): SectionEdge | undefined {
  if (!section) return undefined;
  return {
    loudness: section.loudness,
    tempo: section.tempo,
    key: section.key,
    mode: section.mode,
  };
}

function toSongFeatures(
  f: SpotifyAudioFeatures,
  intro?: SectionEdge,
  outro?: SectionEdge,
): SongFeatures {
  return {
    id: f.id,
    key: f.key,
    mode: f.mode,
    tempo: f.tempo,
    energy: f.energy,
    valence: f.valence,
    danceability: f.danceability,
    acousticness: f.acousticness,
    loudness: f.loudness,
    intro,
    outro,
    synthetic: false,
  };
}

export class SpotifyFeatureProvider implements FeatureProvider {
  readonly synthetic = false;

  /**
   * @param fetchAnalysis fetch per-track analysis (sections); one request/track.
   * @param cache persist + reuse computed features across sessions (default on).
   */
  constructor(
    private readonly fetchAnalysis = true,
    private readonly cache = true,
  ) {}

  async getFeatures(
    tracks: SpotifyTrack[],
  ): Promise<Map<string, SongFeatures>> {
    const ids = tracks.filter((t) => t?.id).map((t) => t.id);

    // Only fetch tracks we haven't already computed and cached. This is the
    // key saving: audio-analysis is one request per track, so revisiting a
    // playlist (or re-optimizing) hits the network for new tracks only.
    const toFetch = this.cache ? featureCache.missing(ids) : ids;

    if (toFetch.length > 0) {
      const features = await spotifyApi.getAudioFeatures(toFetch);

      // Enrich with section edges from audio analysis (best-effort per track).
      const edges = new Map<string, { intro?: SectionEdge; outro?: SectionEdge }>();
      if (this.fetchAnalysis) {
        await Promise.all(
          toFetch.map(async (id) => {
            try {
              const analysis = await spotifyApi.getAudioAnalysis(id);
              const sections = analysis.sections ?? [];
              edges.set(id, {
                intro: edgeFrom(sections[0]),
                outro: edgeFrom(sections[sections.length - 1]),
              });
            } catch {
              // Analysis is best-effort; ignore per-track failures.
            }
          }),
        );
      }

      const fetched: SongFeatures[] = features.map((f) => {
        const e = edges.get(f.id);
        return toSongFeatures(f, e?.intro, e?.outro);
      });
      if (this.cache) featureCache.putMany(fetched);

      // If caching is off, assemble directly from what we just fetched.
      if (!this.cache) {
        const map = new Map<string, SongFeatures>();
        for (const f of fetched) map.set(f.id, f);
        return map;
      }
    }

    return featureCache.getMany(ids);
  }
}
