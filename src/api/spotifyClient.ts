// Thin typed wrapper over the Spotify Web API. Handles auth headers, JSON,
// rate-limit (429) retry, and paging.

import { config } from '../config';
import { getValidAccessToken } from '../auth/spotifyAuth';
import type {
  Paging,
  PlaylistTrackItem,
  SpotifyAudioAnalysis,
  SpotifyAudioFeatures,
  SpotifyPlaylist,
  SpotifyTrack,
  SpotifyUser,
} from './types';

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retries = 2,
): Promise<T> {
  const token = await getValidAccessToken();
  const url = path.startsWith('http') ? path : `${config.spotify.apiBase}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '1');
    await new Promise((r) => setTimeout(r, (retryAfter + 0.25) * 1000));
    return request<T>(path, init, retries - 1);
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw new SpotifyApiError(
      `Spotify API ${res.status} on ${path}: ${detail}`,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Follow `next` links to collect all items of a paged endpoint. */
async function collectPaged<T>(firstPath: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = firstPath;
  while (next) {
    const page: Paging<T> = await request<Paging<T>>(next);
    items.push(...page.items);
    next = page.next;
  }
  return items;
}

export const spotifyApi = {
  getCurrentUser(): Promise<SpotifyUser> {
    return request<SpotifyUser>('/me');
  },

  /** All playlists owned by / followed by the current user. */
  getMyPlaylists(): Promise<SpotifyPlaylist[]> {
    return collectPaged<SpotifyPlaylist>('/me/playlists?limit=50');
  },

  /** All track items of a playlist (following paging). */
  getPlaylistTracks(playlistId: string): Promise<PlaylistTrackItem[]> {
    return collectPaged<PlaylistTrackItem>(
      `/playlists/${playlistId}/tracks?limit=100`,
    );
  },

  /** Batched audio features (100 ids max per call). Deprecated for new apps. */
  async getAudioFeatures(ids: string[]): Promise<SpotifyAudioFeatures[]> {
    const out: SpotifyAudioFeatures[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const res = await request<{ audio_features: (SpotifyAudioFeatures | null)[] }>(
        `/audio-features?ids=${chunk.join(',')}`,
      );
      for (const f of res.audio_features) if (f) out.push(f);
    }
    return out;
  },

  /** Per-track audio analysis (sections). Deprecated for new apps. */
  getAudioAnalysis(id: string): Promise<SpotifyAudioAnalysis> {
    return request<SpotifyAudioAnalysis>(`/audio-analysis/${id}`);
  },

  /**
   * Persist a reordering by replacing the playlist's items with `uris` in the
   * given order. Chunked: first PUT replaces with the first ≤100, then POSTs
   * append the rest. Returns the final snapshot id.
   */
  async replacePlaylistItems(
    playlistId: string,
    uris: string[],
  ): Promise<string> {
    const first = uris.slice(0, 100);
    const res = await request<{ snapshot_id: string }>(
      `/playlists/${playlistId}/tracks`,
      { method: 'PUT', body: JSON.stringify({ uris: first }) },
    );
    let snapshot = res.snapshot_id;
    for (let i = 100; i < uris.length; i += 100) {
      const chunk = uris.slice(i, i + 100);
      const r = await request<{ snapshot_id: string }>(
        `/playlists/${playlistId}/tracks`,
        { method: 'POST', body: JSON.stringify({ uris: chunk }) },
      );
      snapshot = r.snapshot_id;
    }
    return snapshot;
  },
};

export type { SpotifyTrack };
