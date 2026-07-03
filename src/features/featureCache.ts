// Persistent cache of computed SongFeatures, keyed by track id. Audio features
// are stable per track, and audio-analysis costs one request *per track*, so
// caching the trimmed result avoids re-fetching on revisit / re-optimize.
//
// We deliberately persist ONLY the SongFeatures we actually use — the raw
// Spotify audio-features and (large) audio-analysis payloads are discarded once
// the intro/outro section edges are extracted. Backed by a single localStorage
// blob with an LRU cap so it can't grow without bound.

import type { SongFeatures } from '../algorithm/types';

const KEY = 'spo.feature-cache.v1';
const MAX_ENTRIES = 5000;

interface Entry {
  f: SongFeatures;
  t: number; // last-write epoch ms, for LRU eviction
}

let mem: Map<string, Entry> | null = null;

function store(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // e.g. blocked storage
  }
}

function load(): Map<string, Entry> {
  if (mem) return mem;
  mem = new Map();
  const raw = store()?.getItem(KEY);
  if (raw) {
    try {
      const obj = JSON.parse(raw) as Record<string, Entry>;
      for (const [id, e] of Object.entries(obj)) {
        if (e?.f) mem.set(id, e);
      }
    } catch {
      /* corrupt cache — start fresh */
    }
  }
  return mem;
}

function persist(m: Map<string, Entry>): void {
  const s = store();
  if (!s) return;
  // Evict oldest entries beyond the cap before writing.
  if (m.size > MAX_ENTRIES) {
    const sorted = [...m.entries()].sort((a, b) => b[1].t - a[1].t);
    m.clear();
    for (const [id, e] of sorted.slice(0, MAX_ENTRIES)) m.set(id, e);
  }
  const obj: Record<string, Entry> = {};
  for (const [id, e] of m) obj[id] = e;
  try {
    s.setItem(KEY, JSON.stringify(obj));
  } catch {
    // Quota exceeded: drop half (oldest) and retry once.
    const sorted = [...m.entries()].sort((a, b) => b[1].t - a[1].t);
    m.clear();
    const keep = sorted.slice(0, Math.floor(sorted.length / 2));
    const obj2: Record<string, Entry> = {};
    for (const [id, e] of keep) {
      m.set(id, e);
      obj2[id] = e;
    }
    try {
      s.setItem(KEY, JSON.stringify(obj2));
    } catch {
      /* give up silently; cache is best-effort */
    }
  }
}

export const featureCache = {
  /** Return cached features for the given ids (misses are simply omitted). */
  getMany(ids: string[]): Map<string, SongFeatures> {
    const m = load();
    const out = new Map<string, SongFeatures>();
    for (const id of ids) {
      const e = m.get(id);
      if (e) out.set(id, e.f);
    }
    return out;
  },

  /** Which of `ids` are NOT cached (i.e. need to be fetched). */
  missing(ids: string[]): string[] {
    const m = load();
    return ids.filter((id) => !m.has(id));
  },

  /** Store features (write-through). */
  putMany(features: SongFeatures[]): void {
    if (features.length === 0) return;
    const m = load();
    const now = Date.now();
    for (const f of features) m.set(f.id, { f, t: now });
    persist(m);
  },

  clear(): void {
    mem = new Map();
    store()?.removeItem(KEY);
  },

  size(): number {
    return load().size;
  },
};
