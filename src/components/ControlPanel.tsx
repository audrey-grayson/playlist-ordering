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
  staged: OptimizeResult | null;
  onPresetChange: (id: PresetId) => void;
  onWeightsChange: (w: DistanceWeights) => void;
  onStartIdChange: (id: string) => void;
  onOptimize: () => void;
  onConfirm: () => void;
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
    staged,
    onPresetChange,
    onWeightsChange,
    onStartIdChange,
    onOptimize,
    onConfirm,
    onDiscard,
  } = props;

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

      <section className="panel-section">
        <label className="field-label">Component weights</label>
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
      </section>

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
        {optimizing ? 'Optimizing…' : 'Optimize'}
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
                  : 'Approximate: nearest-neighbor + 2-opt/Or-opt local search'
              }
            >
              {staged.method === 'held-karp' ? 'exact (DP)' : 'heuristic'}
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
          <div className="staged-actions">
            <button
              className="btn btn-primary"
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming ? 'Writing…' : 'Confirm & save to Spotify'}
            </button>
            <button
              className="btn btn-danger"
              onClick={onDiscard}
              disabled={confirming}
            >
              Discard
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}
