import type { Song } from '../algorithm/types';
import { formatBpm, formatDuration, keyName } from '../util/format';

interface Props {
  songs: Song[];
  loading: boolean;
  error: string | null;
  staged: boolean;
  /** Original index of each song id, used to show move deltas when staged. */
  originalPositions: Map<string, number> | null;
  startId: string | null;
}

function MoveBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="move move-same">•</span>;
  const up = delta < 0;
  return (
    <span className={`move ${up ? 'move-up' : 'move-down'}`}>
      {up ? '▲' : '▼'}
      {Math.abs(delta)}
    </span>
  );
}

export function TrackList({
  songs,
  loading,
  error,
  staged,
  originalPositions,
  startId,
}: Props) {
  if (loading) return <div className="muted pad">Loading tracks…</div>;
  if (error) return <div className="banner banner-error">{error}</div>;
  if (songs.length === 0)
    return <div className="muted pad">Select a playlist to see its tracks.</div>;

  return (
    <div className="tracklist">
      <div className="track-row track-head">
        <div className="track-idx">#</div>
        <div className="track-title">Title</div>
        <div className="track-attr">Key</div>
        <div className="track-attr">BPM</div>
        <div className="track-attr">Energy</div>
        <div className="track-time">Time</div>
      </div>
      {songs.map((s, i) => {
        const orig = originalPositions?.get(s.id);
        const delta = staged && orig != null ? i - orig : 0;
        return (
          <div
            key={s.id}
            className={`track-row ${s.id === startId ? 'is-start' : ''}`}
          >
            <div className="track-idx">
              {i + 1}
              {staged && originalPositions && <MoveBadge delta={delta} />}
            </div>
            <div className="track-title">
              {s.albumImage ? (
                <img className="track-art" src={s.albumImage} alt="" />
              ) : (
                <div className="track-art track-art-ph">♪</div>
              )}
              <div className="track-names">
                <div className="track-name">
                  {s.name}
                  {s.id === startId && <span className="start-tag">start</span>}
                </div>
                <div className="track-artist">{s.artists}</div>
              </div>
            </div>
            <div className="track-attr">{keyName(s.features.key, s.features.mode)}</div>
            <div className="track-attr">{formatBpm(s.features.tempo)}</div>
            <div className="track-attr">
              <div className="meter">
                <div
                  className="meter-fill"
                  style={{ width: `${Math.round(s.features.energy * 100)}%` }}
                />
              </div>
            </div>
            <div className="track-time">{formatDuration(s.durationMs)}</div>
          </div>
        );
      })}
    </div>
  );
}
