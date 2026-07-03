import { useEffect, useState } from 'react';
import { buildDemoSongs, loadPlaylistSongs } from '../features';
import { demoTracksFor } from '../demo/demoData';
import type { Song } from '../algorithm/types';

interface SongsState {
  songs: Song[];
  synthetic: boolean;
  fallbackReason?: string;
  loading: boolean;
  error: string | null;
}

/** Loads a playlist's songs (with features) whenever the playlist id changes. */
export function usePlaylistSongs(
  playlistId: string | null,
  demo = false,
): SongsState {
  const [state, setState] = useState<SongsState>({
    songs: [],
    synthetic: false,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!playlistId) {
      setState({ songs: [], synthetic: false, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const loader = demo
      ? buildDemoSongs(demoTracksFor(playlistId)).then((songs) => ({
          songs,
          synthetic: true,
          fallbackReason: undefined,
        }))
      : loadPlaylistSongs(playlistId);

    loader
      .then((res) => {
        if (cancelled) return;
        setState({
          songs: res.songs,
          synthetic: res.synthetic,
          fallbackReason: res.fallbackReason,
          loading: false,
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          songs: [],
          synthetic: false,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [playlistId, demo]);

  return state;
}
