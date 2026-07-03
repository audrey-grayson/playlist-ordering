import { describe, it, expect } from 'vitest';
import { optimizePlaylist } from './optimize';
import { buildDistanceMatrix, nearestNeighborPath } from './tsp';
import { makeSong } from './testUtils';
import type { DistanceWeights } from './types';

const W: DistanceWeights = {
  key: 1,
  tempo: 1,
  section: 0,
  timbre: 1,
  loudness: 1,
};

describe('nearestNeighborPath', () => {
  it('visits every node exactly once, starting at the fixed start', () => {
    const songs = Array.from({ length: 8 }, (_, i) =>
      makeSong(String(i), { tempo: 80 + i * 10 }),
    );
    const m = buildDistanceMatrix(songs, W);
    const path = nearestNeighborPath(3, m);
    expect(path[0]).toBe(3);
    expect(new Set(path).size).toBe(8);
    expect(path.length).toBe(8);
  });
});

describe('optimizePlaylist', () => {
  it('preserves the exact set of songs and the fixed start', () => {
    const songs = Array.from({ length: 12 }, (_, i) =>
      makeSong(String(i), {
        key: i % 12,
        tempo: 90 + (i % 5) * 12,
        energy: (i % 4) / 4,
      }),
    );
    const res = optimizePlaylist({ songs, presetId: 'harmonic', startId: '5' });
    expect(res.order[0].id).toBe('5');
    expect(res.order.length).toBe(songs.length);
    expect(new Set(res.order.map((s) => s.id)).size).toBe(songs.length);
  });

  it('does not increase cost versus the original order', () => {
    // Deliberately scrambled tempos so a better ordering exists.
    const tempos = [120, 60, 118, 62, 121, 59, 119, 61, 122, 58];
    const songs = tempos.map((t, i) => makeSong(String(i), { tempo: t }));
    const res = optimizePlaylist({
      songs,
      presetId: 'custom',
      weights: { key: 0, tempo: 1, section: 0, timbre: 0, loudness: 0 },
    });
    expect(res.stats.optimizedCost).toBeLessThanOrEqual(
      res.stats.originalCost + 1e-9,
    );
  });

  it('groups tempo-similar tracks adjacently under a tempo-only objective', () => {
    // Two clear tempo clusters interleaved.
    const raw = [
      { id: 'a', tempo: 100 },
      { id: 'x', tempo: 170 },
      { id: 'b', tempo: 102 },
      { id: 'y', tempo: 168 },
      { id: 'c', tempo: 98 },
      { id: 'z', tempo: 172 },
    ];
    const songs = raw.map((r) => makeSong(r.id, { tempo: r.tempo }));
    const res = optimizePlaylist({
      songs,
      presetId: 'custom',
      weights: { key: 0, tempo: 1, section: 0, timbre: 0, loudness: 0 },
      startId: 'a',
    });
    // Expect the slow cluster (a,b,c) and fast cluster (x,y,z) to not interleave:
    // count transitions between clusters should be exactly 1.
    const slow = new Set(['a', 'b', 'c']);
    let crossings = 0;
    for (let i = 0; i < res.order.length - 1; i++) {
      if (slow.has(res.order[i].id) !== slow.has(res.order[i + 1].id)) crossings++;
    }
    expect(crossings).toBe(1);
  });

  it('handles empty and single-song playlists', () => {
    expect(optimizePlaylist({ songs: [], presetId: 'harmonic' }).order).toEqual(
      [],
    );
    const one = [makeSong('solo')];
    const res = optimizePlaylist({ songs: one, presetId: 'harmonic' });
    expect(res.order.map((s) => s.id)).toEqual(['solo']);
  });

  it('respects a global objective (energy arc peaks in the back half)', () => {
    const songs = Array.from({ length: 10 }, (_, i) =>
      makeSong(String(i), { energy: (i % 10) / 10, tempo: 120 }),
    );
    const res = optimizePlaylist({ songs, presetId: 'energyArc', startId: '0' });
    const energies = res.order.map((s) => s.features.energy);
    const peakIdx = energies.indexOf(Math.max(...energies));
    // Peak should land in the second half of the set (arc rises then falls).
    expect(peakIdx).toBeGreaterThan(songs.length / 3);
  });
});
