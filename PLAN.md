# Spotify Playlist Optimizer — Plan

A React + TypeScript web app that loads a user's Spotify playlists, lets them
inspect the tracks, and computes an "optimal" reordering of a playlist using a
Traveling-Salesman-style algorithm over a musical **distance** between songs.
Reorderings are **staged** (previewable, non-destructive) and only written back
to Spotify after explicit confirmation.

---

## 1. Goals & scope

- **Auth + API infra** for Spotify, with the app secret/client id filled in
  later. Nothing should hard-require real credentials to develop the UI or the
  algorithm.
- **Front page**: load *all* of the user's playlists.
- **Playlist view**: click a playlist → see its tracks (Spotify-like list).
- **Reordering control panel** (right side): choose a **fitness function**,
  weights, and the **starting song**; press **Optimize**.
- **Staged result**: optimize produces a *staged* ordering that is listenable
  in-app but is **not** written to the playlist until the user confirms.
- **Core: the reordering algorithm** — a TSP-style path optimizer where each
  song has a musical distance to every other song.

## 2. Tech stack & infra

| Concern            | Choice                                             |
| ------------------ | -------------------------------------------------- |
| Build tool         | Vite                                               |
| Language           | React 18 + TypeScript                              |
| Auth               | Spotify **Authorization Code + PKCE** (SPA-safe, no server secret) |
| HTTP               | `fetch` wrapped in a typed client with token refresh |
| State              | React context + hooks (no heavy state lib needed)  |
| Styling            | Plain CSS modules / a small design system, dark theme |
| Config             | `.env` (`VITE_SPOTIFY_CLIENT_ID`, redirect URI)    |

### Spotify data caveat (important)

The algorithm depends on **audio features** (key, tempo/BPM, energy, valence,
danceability…) and **audio analysis** (per-song *sections* — used to match the
*end* of one song to the *start* of the next). As of Nov 2024 Spotify
deprecated `GET /audio-features` and `GET /audio-analysis` for newly-created
apps. To keep the project buildable and testable regardless:

- All track feature/analysis access goes through a **`FeatureProvider`
  interface**.
- Ship two implementations: `SpotifyFeatureProvider` (real endpoints) and
  `MockFeatureProvider` (deterministic pseudo-random features seeded by track
  id) so the UI + algorithm work end-to-end with zero credentials.
- A single flag switches providers; if the real endpoints 403/404, we fall
  back to mock and surface a banner.

## 3. Architecture / directory layout

```
src/
  auth/           PKCE flow, token storage & refresh
  api/            Typed Spotify client (playlists, tracks, features, analysis, write)
  features/       FeatureProvider interface + Spotify & Mock impls
  algorithm/
    types.ts      Song, features, sections, weights
    keyDistance.ts   circle-of-fifths + relative/parallel key distance
    distance.ts   pairwise distance = weighted blend of components
    fitness.ts    selectable fitness presets (weight profiles + path scorers)
    tsp.ts        nearest-neighbor + 2-opt open-path solver, fixed start
    optimize.ts   orchestrator: build matrix → solve → return staged order
  state/          app context (auth, selected playlist, staged order)
  components/
    PlaylistSidebar, TrackList, ControlPanel, StagedPreview, ...
  App.tsx, main.tsx
```

## 4. The distance model

Each ordered pair (A → B) has a **directional** distance `d(A,B)` in `[0,1]`
(direction matters because we match *end of A* to *start of B*). It is a
weighted blend of normalized components:

1. **Key / harmonic distance** — Camelot / circle-of-fifths.
   - Same key = 0. Adjacent on circle of fifths (±1 fifth) = small.
   - Relative major/minor = small. Parallel major/minor (modulation) = small-ish.
   - Also considers common progression moves (V→I, ii→V, etc.).
   - Uses the *last section's* key of A vs the *first section's* key of B when
     analysis is available, else the track-level key.
2. **Tempo (BPM) distance** — `|bpmA - bpmB|` normalized; half/double-time
   treated as near (a 128↔64 transition is danceable).
3. **Section-boundary match** — from audio analysis: compare A's final section
   (loudness, tempo, key) to B's first section. Rewards smooth energy/level
   continuity.
4. **Timbre/mood distance** — energy, valence, danceability, acousticness
   (euclidean over normalized dims).
5. **Loudness continuity** — avoid jarring level jumps.

Missing data → that component contributes a neutral mid value and is
down-weighted, never crashes.

## 5. Fitness functions (selectable presets)

Each preset = (a) a **weight profile** over the distance components, plus
optionally (b) a **global path objective** beyond pure adjacency cost.

- **Harmonic Mixing** — heavy key + tempo weight (DJ transitions).
- **Smooth Transitions** — heavy section-boundary + loudness continuity.
- **Energy Arc** — adjacency cost + penalty for deviating from a target energy
  curve (ramp up then cool down); rewards a shaped journey, not just locally
  smooth.
- **Mood Journey** — valence progression from current mood to a target.
- **Custom** — user sets the sliders directly.

The control panel exposes the preset selector plus per-component weight sliders
(seeded by the chosen preset) and a start-song picker.

## 6. TSP solver

- Model as an **open path** (a playlist has a first and last track; we do not
  return to the start), with a **fixed first node** chosen by the user.
- Build the N×N directional distance matrix.
- **Construction**: nearest-neighbor from the fixed start.
- **Improvement**: **2-opt** (and Or-opt moves) until no improving move or a
  time/iteration budget is hit — respecting the fixed start and, for
  Energy-Arc/Mood presets, scoring with the global objective rather than raw
  edge sum.
- Deterministic given inputs; fast enough for typical playlists (≤ a few
  hundred tracks) in the browser.

## 7. Non-destructive staging & write-back

- Optimize writes to `stagedOrder` in app state — the UI shows the new order,
  a diff vs. original, and lets the user audition it.
- **Confirm** → call the reorder/replace API
  (`PUT /playlists/{id}/tracks` with the reordered URIs, chunked) to persist.
- **Discard** reverts to the original order. Nothing is written without
  confirmation.

## 8. Implementation stages

1. **Scaffold** — Vite React-TS project, config, `.env.example`, README, dark
   theme shell. ✅ buildable.
2. **Auth infra** — PKCE login/callback/refresh, token store, `useAuth`.
3. **API client + FeatureProvider** — playlists, tracks, features, analysis,
   write; Spotify + Mock providers.
4. **Algorithm** — types, key distance, distance blend, fitness presets, TSP
   solver, optimizer + unit tests.
5. **UI** — playlist sidebar, track list, control panel, staged preview + diff,
   confirm/discard.
6. **Wire-up & polish** — loading/empty/error states, mock fallback banner,
   README usage.

Each stage is committed separately. Tests cover the algorithm (the core).
