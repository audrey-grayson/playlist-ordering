// Local demo dataset so the full app — playlists, tracks, and the optimizer —
// can be exercised without Spotify credentials. Tracks carry only display
// metadata; musical features come from the MockFeatureProvider (seeded by id),
// so demo playlists optimize with the exact same algorithm path as real ones.

import type { SpotifyPlaylist, SpotifyTrack } from '../api/types';

function track(id: string, name: string, artist: string, durationMs: number): SpotifyTrack {
  return {
    id,
    uri: `spotify:track:${id}`,
    name,
    duration_ms: durationMs,
    explicit: false,
    artists: [{ id: `art-${id}`, name: artist }],
    album: { id: `alb-${id}`, name: `${name} (Single)`, images: [] },
    is_local: false,
  };
}

const NIGHT_DRIVE: SpotifyTrack[] = [
  track('nd01', 'Neon Highway', 'The Midnights', 214000),
  track('nd02', 'Static Bloom', 'Violet Arc', 198000),
  track('nd03', 'Afterglow', 'Kép', 241000),
  track('nd04', 'Coastline', 'Slow Parade', 223000),
  track('nd05', 'Chrome Hearts', 'The Midnights', 201000),
  track('nd06', 'Low Beam', 'Ferris', 187000),
  track('nd07', 'Overpass', 'Violet Arc', 233000),
  track('nd08', 'Signal Fade', 'Nula', 209000),
  track('nd09', 'Midnight Index', 'Kép', 256000),
  track('nd10', 'Tail Lights', 'Slow Parade', 219000),
  track('nd11', 'Rest Stop', 'Ferris', 176000),
  track('nd12', 'Sodium Glow', 'Nula', 244000),
];

const FOCUS_FLOW: SpotifyTrack[] = [
  track('ff01', 'First Light', 'Amba', 262000),
  track('ff02', 'Paper Trails', 'Quiet Machine', 231000),
  track('ff03', 'Isotope', 'Halden', 288000),
  track('ff04', 'Slow Fold', 'Amba', 274000),
  track('ff05', 'Grid', 'Quiet Machine', 245000),
  track('ff06', 'Understory', 'Halden', 301000),
  track('ff07', 'Long Exposure', 'Ferns', 259000),
  track('ff08', 'Meridian', 'Amba', 236000),
  track('ff09', 'Drift', 'Ferns', 268000),
  track('ff10', 'Closing Time', 'Quiet Machine', 227000),
];

const PARTY_PEAK: SpotifyTrack[] = [
  track('pp01', 'Countdown', 'Bright Fuse', 189000),
  track('pp02', 'Hands Up', 'Marla V', 176000),
  track('pp03', 'Voltage', 'The Chase', 201000),
  track('pp04', 'Supernova', 'Bright Fuse', 194000),
  track('pp05', 'Pulse', 'Marla V', 183000),
  track('pp06', 'Overdrive', 'The Chase', 205000),
  track('pp07', 'Confetti', 'Bright Fuse', 172000),
  track('pp08', 'Skyline', 'Marla V', 198000),
  track('pp09', 'Last Call', 'The Chase', 211000),
  track('pp10', 'Encore', 'Bright Fuse', 187000),
  track('pp11', 'Glow Stick', 'Marla V', 179000),
  track('pp12', 'Sunrise Set', 'The Chase', 224000),
  track('pp13', 'Afterparty', 'Bright Fuse', 168000),
  track('pp14', 'Cooldown', 'Marla V', 233000),
];

export interface DemoPlaylist {
  playlist: SpotifyPlaylist;
  tracks: SpotifyTrack[];
}

function playlist(
  id: string,
  name: string,
  description: string,
  tracks: SpotifyTrack[],
): DemoPlaylist {
  return {
    playlist: {
      id,
      name,
      description,
      images: [],
      owner: { id: 'demo', display_name: 'Demo User' },
      tracks: { total: tracks.length, href: '' },
      snapshot_id: 'demo',
      public: false,
      collaborative: false,
    },
    tracks,
  };
}

export const DEMO_PLAYLISTS: DemoPlaylist[] = [
  playlist('demo-night', 'Night Drive', 'Synthy after-dark cruising', NIGHT_DRIVE),
  playlist('demo-focus', 'Focus Flow', 'Deep-work instrumentals', FOCUS_FLOW),
  playlist('demo-party', 'Party Peak', 'Build it up and bring it down', PARTY_PEAK),
];

export function demoTracksFor(playlistId: string): SpotifyTrack[] {
  return DEMO_PLAYLISTS.find((d) => d.playlist.id === playlistId)?.tracks ?? [];
}

export const DEMO_PLAYLIST_METAS: SpotifyPlaylist[] = DEMO_PLAYLISTS.map(
  (d) => d.playlist,
);
