import { useCallback, useEffect, useState } from 'react';
import { spotifyApi } from '../api/spotifyClient';
import type { SpotifyPlaylist, SpotifyUser } from '../api/types';
import { DEMO_PLAYLIST_METAS } from '../demo/demoData';

interface PlaylistsState {
  user: SpotifyUser | null;
  playlists: SpotifyPlaylist[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads the current user and all their playlists on mount. */
export function usePlaylists(enabled: boolean, demo = false): PlaylistsState {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (demo) {
      setUser({ id: 'demo', display_name: 'Demo User' });
      setPlaylists(DEMO_PLAYLIST_METAS);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([spotifyApi.getCurrentUser(), spotifyApi.getMyPlaylists()])
      .then(([u, pls]) => {
        setUser(u);
        setPlaylists(pls);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setLoading(false));
  }, [demo]);

  useEffect(() => {
    if (enabled || demo) load();
  }, [enabled, demo, load]);

  return { user, playlists, loading, error, reload: load };
}
