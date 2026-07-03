import { isSpotifyConfigured } from '../config';

interface Props {
  onLogin: () => void;
  onDemo: () => void;
  error: string | null;
  loading: boolean;
}

export function Login({ onLogin, onDemo, error, loading }: Props) {
  const configured = isSpotifyConfigured();
  return (
    <div className="login">
      <div className="login-card">
        <h1>Playlist Optimizer</h1>
        <p className="login-sub">
          Reorder your Spotify playlists into an optimal listening sequence with
          a traveling-salesman algorithm over musical similarity.
        </p>

        {!configured && (
          <div className="banner banner-warn">
            <strong>Not configured.</strong> Set{' '}
            <code>VITE_SPOTIFY_CLIENT_ID</code> and{' '}
            <code>VITE_SPOTIFY_REDIRECT_URI</code> in a <code>.env</code> file
            (see <code>.env.example</code>), then restart the dev server.
          </div>
        )}

        {error && <div className="banner banner-error">{error}</div>}

        <button
          className="btn btn-primary login-btn"
          onClick={onLogin}
          disabled={!configured || loading}
        >
          {loading ? 'Connecting…' : 'Log in with Spotify'}
        </button>

        <div className="login-or">or</div>

        <button className="btn login-btn" onClick={onDemo}>
          Explore the demo (no login)
        </button>
        <p className="field-hint login-demo-hint">
          Loads sample playlists with mock audio data so you can try the
          optimizer immediately. Reordered results aren't saved anywhere.
        </p>
      </div>
    </div>
  );
}
