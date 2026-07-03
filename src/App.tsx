import { useEffect, useMemo, useState } from 'react';
import { config } from './config';
import { useAuth } from './auth/useAuth';
import { usePlaylists } from './state/usePlaylists';
import { usePlaylistSongs } from './state/usePlaylistSongs';
import { FITNESS_PRESETS, type PresetId } from './algorithm/fitness';
import {
  optimizePlaylist,
  type OptimizeResult,
} from './algorithm/optimize';
import type { DistanceWeights } from './algorithm/types';
import { spotifyApi } from './api/spotifyClient';
import { Login } from './components/Login';
import { PlaylistSidebar } from './components/PlaylistSidebar';
import { TrackList } from './components/TrackList';
import { ControlPanel } from './components/ControlPanel';
import './styles/app.css';

export default function App() {
  const auth = useAuth();
  const [demo, setDemo] = useState(false);
  const active = auth.loggedIn || demo;
  const { user, playlists, loading: plLoading, error: plError } = usePlaylists(
    auth.loggedIn,
    demo,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { songs, synthetic, fallbackReason, loading: songsLoading, error: songsError } =
    usePlaylistSongs(selectedId, demo);

  const [presetId, setPresetId] = useState<PresetId>('harmonic');
  const [weights, setWeights] = useState<DistanceWeights>(
    FITNESS_PRESETS.harmonic.weights,
  );
  const [startId, setStartId] = useState<string | null>(null);

  const [staged, setStaged] = useState<OptimizeResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState<string | null>(null);

  // When a preset is chosen, seed the sliders from its profile.
  const onPresetChange = (id: PresetId) => {
    setPresetId(id);
    setWeights(FITNESS_PRESETS[id].weights);
    setStaged(null);
  };

  // Editing sliders switches to the "custom" preset (keeps any global objective off).
  const onWeightsChange = (w: DistanceWeights) => {
    setWeights(w);
    if (presetId !== 'custom') setPresetId('custom');
    setStaged(null);
  };

  // Reset per-playlist state when the loaded songs change.
  useEffect(() => {
    setStaged(null);
    setWriteError(null);
    setWriteSuccess(null);
    setStartId(songs.length ? songs[0].id : null);
  }, [songs]);

  const originalPositions = useMemo(() => {
    const m = new Map<string, number>();
    songs.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [songs]);

  const handleOptimize = () => {
    if (songs.length < 2) return;
    setOptimizing(true);
    setWriteError(null);
    setWriteSuccess(null);
    // Defer so the "Optimizing…" state paints before the (sync) solve runs.
    setTimeout(() => {
      try {
        const result = optimizePlaylist({
          songs,
          presetId,
          weights,
          startId: startId ?? undefined,
        });
        setStaged(result);
      } finally {
        setOptimizing(false);
      }
    }, 20);
  };

  const handleConfirm = async () => {
    if (!staged || !selectedId) return;
    if (demo) {
      setWriteSuccess(
        'Demo mode: the reordering was applied locally (nothing is written to Spotify).',
      );
      setStaged(null);
      return;
    }
    setConfirming(true);
    setWriteError(null);
    try {
      await spotifyApi.replacePlaylistItems(
        selectedId,
        staged.order.map((s) => s.uri),
      );
      setWriteSuccess('Playlist reordered and saved to Spotify.');
      setStaged(null);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirming(false);
    }
  };

  if (!active) {
    return (
      <Login
        onLogin={auth.login}
        onDemo={() => setDemo(true)}
        error={auth.error}
        loading={auth.loading}
      />
    );
  }

  const displaySongs = staged ? staged.order : songs;
  const selectedPlaylist = playlists.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Playlist Optimizer</div>
        <div className="topbar-right">
          <span className={`provider-badge ${synthetic ? 'mock' : 'live'}`}>
            {config.featureProvider === 'spotify' && !synthetic
              ? 'Spotify audio data'
              : 'Mock audio data'}
          </span>
          {demo && <span className="provider-badge mock">Demo mode</span>}
          {user && (
            <span className="user">{user.display_name ?? user.id}</span>
          )}
          <button
            className="btn"
            onClick={() => {
              if (demo) {
                setDemo(false);
                setSelectedId(null);
              } else {
                auth.logout();
              }
            }}
          >
            {demo ? 'Exit demo' : 'Log out'}
          </button>
        </div>
      </header>

      <div className="workspace">
        <PlaylistSidebar
          playlists={playlists}
          selectedId={selectedId}
          loading={plLoading}
          error={plError}
          onSelect={setSelectedId}
        />

        <main className="main">
          {selectedPlaylist && (
            <div className="main-header">
              <h2>{selectedPlaylist.name}</h2>
              {staged && <span className="staged-pill">Staged preview</span>}
            </div>
          )}

          {fallbackReason && (
            <div className="banner banner-warn">
              Spotify audio features unavailable ({fallbackReason}) — using mock
              data so the algorithm still runs.
            </div>
          )}
          {synthetic && !fallbackReason && selectedId && (
            <div className="banner banner-info">
              Using synthetic (mock) audio features. Set{' '}
              <code>VITE_FEATURE_PROVIDER=spotify</code> to use real data.
            </div>
          )}
          {writeSuccess && (
            <div className="banner banner-success">{writeSuccess}</div>
          )}
          {writeError && <div className="banner banner-error">{writeError}</div>}

          <TrackList
            songs={displaySongs}
            loading={songsLoading}
            error={songsError}
            staged={Boolean(staged)}
            originalPositions={originalPositions}
            startId={startId}
          />
        </main>

        <ControlPanel
          songs={songs}
          presetId={presetId}
          weights={weights}
          startId={startId}
          optimizing={optimizing}
          confirming={confirming}
          staged={staged}
          onPresetChange={onPresetChange}
          onWeightsChange={onWeightsChange}
          onStartIdChange={(id) => {
            setStartId(id);
            setStaged(null);
          }}
          onOptimize={handleOptimize}
          onConfirm={handleConfirm}
          onDiscard={() => setStaged(null)}
        />
      </div>
    </div>
  );
}
