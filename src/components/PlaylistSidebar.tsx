import type { SpotifyPlaylist } from '../api/types';

interface Props {
  playlists: SpotifyPlaylist[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
}

export function PlaylistSidebar({
  playlists,
  selectedId,
  loading,
  error,
  onSelect,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">Your Playlists</div>
      {loading && <div className="muted pad">Loading playlists…</div>}
      {error && <div className="banner banner-error">{error}</div>}
      {!loading && !error && playlists.length === 0 && (
        <div className="muted pad">No playlists found.</div>
      )}
      <ul className="playlist-list">
        {playlists.map((p) => {
          const img = p.images?.[p.images.length - 1]?.url ?? null;
          return (
            <li key={p.id}>
              <button
                className={`playlist-item ${p.id === selectedId ? 'active' : ''}`}
                onClick={() => onSelect(p.id)}
              >
                <div className="playlist-thumb">
                  {img ? (
                    <img src={img} alt="" />
                  ) : (
                    <div className="playlist-thumb-placeholder">♪</div>
                  )}
                </div>
                <div className="playlist-meta">
                  <div className="playlist-name">{p.name}</div>
                  <div className="playlist-count">
                    {p.tracks.total} tracks · {p.owner.display_name ?? p.owner.id}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
