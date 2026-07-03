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

  /** If true, fetch per-track analysis (sections). Costs one request/track. */
  constructor(private readonly fetchAnalysis = true) {}

  async getFeatures(
    tracks: SpotifyTrack[],
  ): Promise<Map<string, SongFeatures>> {
    const ids = tracks.filter((t) => t?.id).map((t) => t.id);
    const features = await spotifyApi.getAudioFeatures(ids);

    // Optionally enrich with section edges from audio analysis.
    const edges = new Map<string, { intro?: SectionEdge; outro?: SectionEdge }>();
    if (this.fetchAnalysis) {
      await Promise.all(
        ids.map(async (id) => {
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

    const map = new Map<string, SongFeatures>();
    for (const f of features) {
      const e = edges.get(f.id);
      map.set(f.id, toSongFeatures(f, e?.intro, e?.outro));
    }
    return map;
  }
}
