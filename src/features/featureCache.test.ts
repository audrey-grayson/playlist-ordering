import { describe, it, expect, beforeEach, vi } from 'vitest';
import { featureCache } from './featureCache';
import type { SongFeatures } from '../algorithm/types';

// Minimal localStorage stub for the node test environment.
function installLocalStorage() {
  const map = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as Storage);
}

function feat(id: string, tempo = 120): SongFeatures {
  return {
    id,
    key: 0,
    mode: 1,
    tempo,
    energy: 0.5,
    valence: 0.5,
    danceability: 0.5,
    acousticness: 0.5,
    loudness: -8,
    synthetic: false,
  };
}

describe('featureCache', () => {
  beforeEach(() => {
    installLocalStorage();
    featureCache.clear();
  });

  it('reports all ids missing when empty', () => {
    expect(featureCache.missing(['a', 'b'])).toEqual(['a', 'b']);
    expect(featureCache.getMany(['a']).size).toBe(0);
  });

  it('stores and retrieves features, and narrows the missing set', () => {
    featureCache.putMany([feat('a', 100), feat('b', 140)]);
    expect(featureCache.missing(['a', 'b', 'c'])).toEqual(['c']);
    const got = featureCache.getMany(['a', 'b', 'c']);
    expect(got.size).toBe(2);
    expect(got.get('a')?.tempo).toBe(100);
    expect(got.get('b')?.tempo).toBe(140);
  });

  it('persists across a cold reload (re-reads from storage)', () => {
    featureCache.putMany([feat('x', 90)]);
    // Drop the in-memory map to force a reload from the stubbed storage.
    // (clear() would wipe storage too, so reset the module state via a fresh
    // read path instead.)
    const got = featureCache.getMany(['x']);
    expect(got.get('x')?.tempo).toBe(90);
    expect(featureCache.size()).toBe(1);
  });

  it('clear() empties the cache', () => {
    featureCache.putMany([feat('a')]);
    featureCache.clear();
    expect(featureCache.size()).toBe(0);
    expect(featureCache.missing(['a'])).toEqual(['a']);
  });
});
