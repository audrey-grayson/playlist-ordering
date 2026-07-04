import { useEffect, useMemo, useRef, useState } from 'react';
import { config } from './config';
import { useAuth } from './auth/useAuth';
import { usePlaylists } from './state/usePlaylists';
import { usePlaylistSongs } from './state/usePlaylistSongs';
import { FITNESS_PRESETS, type PresetId } from './algorithm/fitness';
import {
  optimizePlaylist,
  type OptimizeRequest,
  type OptimizeResult,
} from './algorithm/optimize';
import type { OptimizeWorkerResponse } from './algorithm/optimizeWorker';
import type { DistanceWeights } from './algorithm/types';
import { spotifyApi } from './api/spotifyClient';
import { perfLog, startTimer } from './util/perf';
import { Login } from './components/Login';
import { PlaylistSidebar } from './components/PlaylistSidebar';
import { TrackList } from './components/TrackList';
import { ControlPanel } from './components/ControlPanel';
import './styles/app.css';

/** Spawn the optimize worker, or null if Web Workers aren't available. */
function createOptimizeWorker(): Worker | null {
  try {
    return new Worker(new URL('./algorithm/optimizeWorker.ts', import.meta.url), {
      type: 'module',
    });
  } catch {
    return null;
  }
}

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
  const [savingCopy, setSavingCopy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState<string | null>(null);

  // The solve runs in a Web Worker so a large playlist can churn for a few
  // seconds without freezing the UI (and the loading spinner keeps spinning).
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
    workerRef.current = createOptimizeWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

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

  const selectedPlaylist = playlists.find((p) => p.id === selectedId) ?? null;
  // In demo mode the user id is 'demo' and demo playlists are owned by 'demo',
  // so this is true; unknown ownership is treated as "yours" (no false alarm).
  const ownedByUser =
    !selectedPlaylist || !user || selectedPlaylist.owner.id === user.id;

  const handleOptimize = () => {
    if (songs.length < 2) return;
    setOptimizing(true);
    setWriteError(null);
    setWriteSuccess(null);

    const done = startTimer();
    const req: OptimizeRequest = {
      songs,
      presetId,
      weights,
      startId: startId ?? undefined,
    };

    const finish = (result: OptimizeResult) => {
      perfLog('optimize.solve', done(), {
        n: songs.length,
        method: result.method,
        segments: result.segments,
        preset: presetId,
        improvement: `${result.stats.improvementPct.toFixed(1)}%`,
      });
      setStaged(result);
      setOptimizing(false);
    };

    const worker = workerRef.current;
    if (!worker) {
      // No worker (unsupported env): solve on the main thread after a paint.
      setTimeout(() => {
        try {
          finish(optimizePlaylist(req));
        } catch (e) {
          setWriteError(e instanceof Error ? e.message : String(e));
          setOptimizing(false);
        }
      }, 20);
      return;
    }

    // Safety net: the solver self-limits to ~4s, so if nothing comes back well
    // past that, kill the worker and recover rather than spinning forever.
    const killer = window.setTimeout(() => {
      worker.removeEventListener('message', onMessage);
      worker.terminate();
      workerRef.current = createOptimizeWorker();
      setWriteError(
        'Optimization timed out. Try a smaller playlist or a different start track.',
      );
      setOptimizing(false);
    }, (req.timeBudgetMs ?? 4000) + 4000);

    const onMessage = (ev: MessageEvent<OptimizeWorkerResponse>) => {
      window.clearTimeout(killer);
      worker.removeEventListener('message', onMessage);
      if (ev.data.ok) finish(ev.data.result);
      else {
        setWriteError('Optimization failed: ' + ev.data.error);
        setOptimizing(false);
      }
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage(req);
  };

  const changeStart = (id: string) => {
    setStartId(id);
    setStaged(null);
  };

  const handleSaveCopy = async () => {
    if (!staged || !selectedPlaylist) return;
    if (demo) {
      setWriteSuccess(
        'Demo mode: a reordered copy would be saved to your library (nothing is written to Spotify).',
      );
      setStaged(null);
      return;
    }
    if (!user) return;
    setSavingCopy(true);
    setWriteError(null);
    setWriteSuccess(null);
    try {
      const done = startTimer();
      const created = await spotifyApi.createPlaylist(
        user.id,
        `${selectedPlaylist.name} (optimized)`,
        {
          description: 'Reordered by Playlist Optimizer',
          public: false,
        },
      );
      await spotifyApi.replacePlaylistItems(
        created.id,
        staged.order.map((s) => s.uri),
      );
      perfLog('playlist.copy', done(), { tracks: staged.order.length });
      setWriteSuccess(`Saved a new playlist "${created.name}" to your library.`);
      setStaged(null);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingCopy(false);
    }
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
      const done = startTimer();
      await spotifyApi.replacePlaylistItems(
        selectedId,
        staged.order.map((s) => s.uri),
      );
      perfLog('playlist.write', done(), { tracks: staged.order.length });
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
            onSetStart={changeStart}
          />
        </main>

        <ControlPanel
          songs={songs}
          presetId={presetId}
          weights={weights}
          startId={startId}
          optimizing={optimizing}
          confirming={confirming}
          savingCopy={savingCopy}
          staged={staged}
          ownedByUser={ownedByUser}
          onPresetChange={onPresetChange}
          onWeightsChange={onWeightsChange}
          onStartIdChange={changeStart}
          onOptimize={handleOptimize}
          onConfirm={handleConfirm}
          onSaveCopy={handleSaveCopy}
          onDiscard={() => setStaged(null)}
        />
      </div>
    </div>
  );
}
