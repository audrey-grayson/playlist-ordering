import { config } from '../config';
import type { Song, SongFeatures } from '../algorithm/types';
import { spotifyApi } from '../api/spotifyClient';
import type { SpotifyTrack } from '../api/types';
import type { FeatureProvider } from './FeatureProvider';
import { MockFeatureProvider } from './mockProvider';
import { SpotifyFeatureProvider } from './spotifyProvider';

export type { FeatureProvider } from './FeatureProvider';
export { MockFeatureProvider } from './mockProvider';
export { SpotifyFeatureProvider } from './spotifyProvider';

const mock = new MockFeatureProvider();

export function makeFeatureProvider(): FeatureProvider {
  return config.featureProvider === 'spotify'
    ? new SpotifyFeatureProvider()
    : mock;
}

export interface LoadTracksResult {
  songs: Song[];
  /** True if features are synthetic (mock or fell back to mock). */
  synthetic: boolean;
  /** Set when the configured provider failed and we fell back to mock. */
  fallbackReason?: string;
}

/** Build Songs from already-fetched tracks using the mock provider (demo mode). */
export async function buildDemoSongs(tracks: SpotifyTrack[]): Promise<Song[]> {
  const featureMap = await mock.getFeatures(tracks);
  return tracks
    .filter((t) => featureMap.has(t.id))
    .map((t) => toSong(t, featureMap.get(t.id)!));
}

function toSong(track: SpotifyTrack, features: SongFeatures): Song {
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: track.artists.map((a) => a.name).join(', '),
    albumImage: track.album?.images?.[track.album.images.length - 1]?.url ?? null,
    durationMs: track.duration_ms,
    features,
  };
}

/**
 * Load a playlist's tracks and attach musical features. If the configured
 * (Spotify) provider fails — e.g. the deprecated audio endpoints 403/404 — we
 * transparently fall back to the mock provider and report why.
 */
export async function loadPlaylistSongs(
  playlistId: string,
): Promise<LoadTracksResult> {
  const items = await spotifyApi.getPlaylistTracks(playlistId);
  const tracks = items
    .map((i) => i.track)
    .filter((t): t is SpotifyTrack => Boolean(t?.id) && !t?.is_local);

  let provider = makeFeatureProvider();
  let fallbackReason: string | undefined;

  let featureMap: Map<string, SongFeatures>;
  try {
    featureMap = await provider.getFeatures(tracks);
    if (featureMap.size === 0 && tracks.length > 0 && !provider.synthetic) {
      throw new Error('No audio features returned.');
    }
  } catch (e) {
    if (provider.synthetic) throw e;
    fallbackReason =
      e instanceof Error ? e.message : 'Spotify audio features unavailable.';
    provider = mock;
    featureMap = await provider.getFeatures(tracks);
  }

  const songs = tracks
    .filter((t) => featureMap.has(t.id))
    .map((t) => toSong(t, featureMap.get(t.id)!));

  return { songs, synthetic: provider.synthetic, fallbackReason };
}
