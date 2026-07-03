// Central app configuration, read from Vite env vars. Missing values are
// tolerated so the UI still renders (with a warning) before credentials exist.

export const config = {
  spotify: {
    clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '',
    redirectUri:
      import.meta.env.VITE_SPOTIFY_REDIRECT_URI ??
      `${window.location.origin}/callback`,
    // Scopes needed to read playlists and write reorderings back.
    scopes: [
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private',
    ],
    authBase: 'https://accounts.spotify.com',
    apiBase: 'https://api.spotify.com/v1',
  },
  featureProvider:
    (import.meta.env.VITE_FEATURE_PROVIDER as 'mock' | 'spotify' | undefined) ??
    'mock',
} as const;

export function isSpotifyConfigured(): boolean {
  return Boolean(config.spotify.clientId);
}
