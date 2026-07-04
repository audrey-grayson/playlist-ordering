import { useEffect, useState } from 'react';
import type { Song, DistanceWeights } from '../algorithm/types';
import {
  FITNESS_PRESETS,
  PRESET_ORDER,
  type PresetId,
} from '../algorithm/fitness';
import type { OptimizeResult } from '../algorithm/optimize';

interface Props {
  songs: Song[];
  presetId: PresetId;
  weights: DistanceWeights;
  startId: string | null;
  optimizing: boolean;
  confirming: boolean;
  savingCopy: boolean;
  staged: OptimizeResult | null;
  /** Whether the loaded playlist is owned by the current user. */
  ownedByUser: boolean;
  onPresetChange: (id: PresetId) => void;
  onWeightsChange: (w: DistanceWeights) => void;
  onStartIdChange: (id: string) => void;
  onOptimize: () => void;
  onConfirm: () => void;
  onSaveCopy: () => void;
  onDiscard: () => void;
}

const WEIGHT_FIELDS: Array<{ key: keyof DistanceWeights; label: string; hint: string }> =
  [
    { key: 'key', label: 'Harmonic (key)', hint: 'Circle-of-fifths compatibility' },
    { key: 'tempo', label: 'Tempo (BPM)', hint: 'Beat-matching, incl. half-time' },
    { key: 'section', label: 'Section match', hint: 'End-of-song → start-of-next' },
    { key: 'timbre', label: 'Mood / timbre', hint: 'Energy, valence, danceability' },
    { key: 'loudness', label: 'Loudness', hint: 'Level continuity' },
  ];

export function ControlPanel(props: Props) {
  const {
    songs,
    presetId,
    weights,
    startId,
    optimizing,
    confirming,
    savingCopy,
    staged,
    ownedByUser,
    onPresetChange,
    onWeightsChange,
    onStartIdChange,
    onOptimize,
    onConfirm,
    onSaveCopy,
    onDiscard,
  } = props;

  // Confirmation gate for saving a copy of a playlist the user doesn't own.
  const [confirmCopy, setConfirmCopy] = useState(false);
  const busy = confirming || savingCopy;

  // Drop a pending confirmation when the staged preview goes away.
  useEffect(() => {
    if (!staged) setConfirmCopy(false);
  }, [staged]);

  const requestSaveCopy = () => {
    if (ownedByUser) onSaveCopy();
    else setConfirmCopy(true);
  };

  const disabled = songs.length < 2;
  const preset = FITNESS_PRESETS[presetId];

  const setWeight = (k: keyof DistanceWeights, v: number) =>
    onWeightsChange({ ...weights, [k]: v });

  return (
    <aside className="panel">
      <div className="panel-title">Reordering Control Panel</div>

      <section className="panel-section">
        <label className="field-label">Fitness function</label>
        <select
          className="select"
          value={presetId}
          onChange={(e) => onPresetChange(e.target.value as PresetId)}
        >
          {PRESET_ORDER.map((id) => (
            <option key={id} value={id}>
              {FITNESS_PRESETS[id].name}
            </option>
          ))}
        </select>
        <p className="field-hint">{preset.description}</p>
      </section>

      <details className="panel-section weights-details">
        <summary className="field-label weights-summary">
          Component weights
        </summary>
        <div className="weights-body">
          {WEIGHT_FIELDS.map((f) => (
            <div className="slider-row" key={f.key}>
              <div className="slider-head">
                <span>{f.label}</span>
                <span className="slider-val">{weights[f.key].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[f.key]}
                onChange={(e) => setWeight(f.key, Number(e.target.value))}
              />
              <div className="field-hint">{f.hint}</div>
            </div>
          ))}
        </div>
      </details>

      <section className="panel-section">
        <label className="field-label">Start with</label>
        <select
          className="select"
          value={startId ?? ''}
          onChange={(e) => onStartIdChange(e.target.value)}
          disabled={disabled}
        >
          {songs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.artists}
            </option>
          ))}
        </select>
        <p className="field-hint">The first track is fixed; the rest are ordered after it.</p>
      </section>

      <button
        className="btn btn-primary panel-optimize"
        onClick={onOptimize}
        disabled={disabled || optimizing}
      >
        {optimizing ? (
          <span className="optimize-busy">
            <span className="spinner" aria-hidden="true" />
            Optimizing…
          </span>
        ) : (
          'Optimize'
        )}
      </button>

      {staged && (
        <section className="panel-section staged-box">
          <div className="staged-title">
            Staged reordering
            <span
              className="method-tag"
              title={
                staged.method === 'held-karp'
                  ? 'Exact optimum via Held–Karp dynamic programming'
                  : `Playlist exceeded the exact-solve budget — split into ${staged.segments} randomly-partitioned segments, each solved exactly with Held–Karp`
              }
            >
              {staged.method === 'held-karp'
                ? 'exact (DP)'
                : `split × ${staged.segments} (DP)`}
            </span>
          </div>
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-label">Transition cost</div>
              <div className="stat-val">
                {staged.stats.originalAvgAdjacency.toFixed(3)} →{' '}
                <strong>{staged.stats.optimizedAvgAdjacency.toFixed(3)}</strong>
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Overall improvement</div>
              <div className="stat-val">
                <strong
                  className={
                    staged.stats.improvementPct >= 0 ? 'good' : 'bad'
                  }
                >
                  {staged.stats.improvementPct >= 0 ? '+' : ''}
                  {staged.stats.improvementPct.toFixed(1)}%
                </strong>
              </div>
            </div>
          </div>
          <p className="field-hint">
            This is a preview only — nothing is written to Spotify until you
            confirm.
          </p>
          {confirmCopy ? (
            <div className="copy-confirm">
              <p className="field-hint copy-confirm-msg">
                You don't own this playlist. Save the reordering as a{' '}
                <strong>new playlist</strong> in your library instead?
              </p>
              <div className="staged-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setConfirmCopy(false);
                    onSaveCopy();
                  }}
                  disabled={busy}
                >
                  {savingCopy ? 'Saving…' : 'Save new playlist'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setConfirmCopy(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="staged-actions">
              <button
                className="btn btn-primary"
                onClick={onConfirm}
                disabled={busy}
              >
                {confirming ? 'Writing…' : 'Confirm & overwrite original'}
              </button>
              <button
                className="btn"
                onClick={requestSaveCopy}
                disabled={busy}
              >
                {savingCopy ? 'Saving…' : 'Save as new playlist'}
              </button>
              <button
                className="btn btn-danger"
                onClick={onDiscard}
                disabled={busy}
              >
                Discard
              </button>
            </div>
          )}
        </section>
      )}
    </aside>
  );
}
