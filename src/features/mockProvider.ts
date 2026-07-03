// Deterministic synthetic feature provider. Given a track id, produces stable
// pseudo-random-but-plausible audio features so the whole app is exercisable
// without Spotify's (deprecated) audio endpoints or any credentials.

import type { SectionEdge, SongFeatures } from '../algorithm/types';
import type { SpotifyTrack } from '../api/types';
import type { FeatureProvider } from './FeatureProvider';

/** Small string hash → 32-bit int (FNV-1a). */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic [0,1) generator seeded per (id, salt). */
function rand(id: string, salt: string): number {
  return (hash(`${id}::${salt}`) % 100000) / 100000;
}

function synth(track: SpotifyTrack): SongFeatures {
  const id = track.id;
  const key = Math.floor(rand(id, 'key') * 12); // 0..11
  const mode = rand(id, 'mode') > 0.4 ? 1 : 0;
  const tempo = Math.round(70 + rand(id, 'tempo') * 100); // 70..170 BPM
  const energy = rand(id, 'energy');
  const valence = rand(id, 'valence');
  const danceability = rand(id, 'dance');
  const acousticness = rand(id, 'acoustic');
  const loudness = -14 + rand(id, 'loud') * 12; // -14..-2 dB

  const edge = (salt: string, baseTempo: number, baseKey: number): SectionEdge => ({
    loudness: loudness + (rand(id, `${salt}L`) - 0.5) * 4,
    tempo: baseTempo + (rand(id, `${salt}T`) - 0.5) * 6,
    key: (baseKey + Math.round((rand(id, `${salt}K`) - 0.5) * 2) + 12) % 12,
    mode,
  });

  return {
    id,
    key,
    mode,
    tempo,
    energy,
    valence,
    danceability,
    acousticness,
    loudness,
    intro: edge('intro', tempo, key),
    outro: edge('outro', tempo, key),
    synthetic: true,
  };
}

export class MockFeatureProvider implements FeatureProvider {
  readonly synthetic = true;

  async getFeatures(
    tracks: SpotifyTrack[],
  ): Promise<Map<string, SongFeatures>> {
    const map = new Map<string, SongFeatures>();
    for (const t of tracks) {
      if (t?.id) map.set(t.id, synth(t));
    }
    return map;
  }
}
