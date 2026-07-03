import type { Song, SongFeatures } from './types';

export function makeFeatures(
  id: string,
  overrides: Partial<SongFeatures> = {},
): SongFeatures {
  return {
    id,
    key: 0,
    mode: 1,
    tempo: 120,
    energy: 0.5,
    valence: 0.5,
    danceability: 0.5,
    acousticness: 0.5,
    loudness: -8,
    synthetic: true,
    ...overrides,
  };
}

export function makeSong(
  id: string,
  features: Partial<SongFeatures> = {},
): Song {
  return {
    id,
    uri: `spotify:track:${id}`,
    name: `Song ${id}`,
    artists: 'Test Artist',
    albumImage: null,
    durationMs: 200000,
    features: makeFeatures(id, features),
  };
}
