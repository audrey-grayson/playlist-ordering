# Spotify Playlist Optimizer

A React + TypeScript web app that loads your Spotify playlists and reorders
them into an optimal listening sequence using a **Traveling-Salesman-style**
algorithm over a **musical distance** between songs. Reorderings are **staged**
(previewable, non-destructive) and only written back to Spotify after you
confirm.

> See [`PLAN.md`](./PLAN.md) for the full architecture and design rationale.

## Features

- **Loads all your playlists** on the front page; click one to see its tracks
  in a Spotify-like list (key, BPM, energy).
- **Reordering control panel** with selectable **fitness functions**, per-
  component **weight sliders**, and a **start-song** picker.
- **Optimize** produces a **staged** ordering (with move indicators and a
  before/after transition-cost stat) that is *not* written until you
  **Confirm & save to Spotify**.
- **Demo mode** — try the whole thing with sample playlists and mock audio data,
  no credentials required.

## The algorithm (the core)

Each ordered pair of songs A → B has a **directional distance** in `[0,1]`
(direction matters because we match the *end* of A to the *start* of B). It is a
weight-normalized blend of:

| Component    | What it measures |
| ------------ | ---------------- |
| **Harmonic** | Key compatibility via the circle of fifths / Camelot wheel — same key, adjacent fifth (V→I), relative and parallel major/minor are all "close". |
| **Tempo**    | BPM proximity, tolerant of half/double-time (128 ↔ 64 reads as close). |
| **Section**  | Smoothness at the seam: A's final section vs B's first section (loudness, tempo, key), from Spotify audio analysis. |
| **Timbre**   | Energy / valence / danceability / acousticness. |
| **Loudness** | Level continuity. |

**Fitness presets** each define a weight profile and optionally a *global* path
objective:

- **Harmonic Mixing** — DJ-style key + tempo matching.
- **Smooth Transitions** — section-boundary + loudness continuity.
- **Energy Arc** — build energy to a peak ~70% through, then cool down.
- **Mood Journey** — climb valence from start to finish.
- **Custom** — set the sliders yourself.

**Solver:** the playlist is an **open path** with a **fixed first song**.

- **Small playlists (≤ 20 tracks): exact dynamic programming.** A Held–Karp DP
  (`O(2ⁿ·n²)`) returns the *true optimum*. The global objectives are written as
  position-decomposable per-node penalties, so even Energy Arc / Mood Journey
  are solved exactly, not just pure-transition presets.
- **Larger playlists: recursive random partition.** The solve runs under a
  **4-second budget**. If the exact DP is too large to allocate or would exceed
  the budget, the *remaining* tracks are randomly split into two halves — the
  fixed first song stays first — and each half is solved independently (exactly,
  or split again), then concatenated. This scales to any length while keeping
  every segment locally optimal.

The solve runs in a **Web Worker**, so the UI stays responsive and the loading
spinner animates even during a multi-second solve. The staged panel labels which
strategy was used (`exact (DP)` vs `split × N (DP)`). Unit tests verify the DP
matches a brute-force optimum, and that the partition always returns a valid
permutation with the pinned start, is deterministic under a seeded RNG, and
terminates even with a spent time budget.

### Data efficiency

Audio features are stable per track and audio-analysis costs **one request per
track**, so computed `SongFeatures` are cached in `localStorage` (only the
trimmed fields we use — raw API payloads are discarded once section edges are
extracted). Revisiting a playlist or re-optimizing fetches **only tracks not
already cached**. The cache is LRU-capped so it can't grow without bound.

Unit tests cover the key theory, distance blending, and optimizer invariants:

```bash
npm test
```

## Setup

```bash
npm install
cp .env.example .env   # then fill in your Spotify credentials
npm run dev
```

### Spotify credentials

1. Create an app at <https://developer.spotify.com/dashboard>.
2. Add a **Redirect URI** (e.g. `http://localhost:5173/callback`) in the app
   settings — it must match `VITE_SPOTIFY_REDIRECT_URI` exactly.
3. Put the **Client ID** in `.env`:

   ```env
   VITE_SPOTIFY_CLIENT_ID=your_client_id
   VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
   VITE_FEATURE_PROVIDER=mock   # or "spotify"
   ```

Auth uses the **Authorization Code + PKCE** flow, so **no client secret** is
needed (and none should ever be placed in a frontend bundle).

### A note on audio data

The algorithm relies on Spotify's **audio-features** and **audio-analysis**
endpoints. Spotify **deprecated these for apps created after Nov 2024**. To keep
the app fully functional regardless, all feature access goes through a
`FeatureProvider` interface with two implementations:

- **`spotify`** — the real endpoints.
- **`mock`** — deterministic synthetic features seeded by track id.

Set `VITE_FEATURE_PROVIDER=spotify` to use real data; if those endpoints are
unavailable (403/404), the app **automatically falls back to mock** and shows a
banner, so the UI and algorithm still work end-to-end.

## Scripts

| Command          | Description                    |
| ---------------- | ------------------------------ |
| `npm run dev`    | Start the Vite dev server      |
| `npm run build`  | Type-check and production build|
| `npm run preview`| Preview the production build   |
| `npm test`       | Run the algorithm unit tests   |

## Project layout

```
src/
  auth/        Spotify PKCE flow, token store, useAuth
  api/         Typed Spotify client (playlists, tracks, features, write-back)
  features/    FeatureProvider interface + Spotify & Mock impls
  algorithm/   Distance model, fitness presets, TSP solver, optimizer (+ tests)
  state/       Data-loading hooks
  components/   UI: sidebar, track list, control panel, login
  demo/        Sample playlists for demo mode
```
