// Save progression: which levels are done, best times, best shard counts, sunstones found,
// and the chosen skin. Stored as one JSON blob in localStorage; every call survives a
// missing or broken storage (private windows, blocked cookies) by keeping state in memory.
export const SAVE_KEY = 'skyshard.save.v1';

// Cosmetic unlocks, earned with sunstones (3 per level).
export const SKINS = [
  { id: 'classic', name: 'Classic', need: 0, hood: 0x3cc8c0, hoodDark: 0x2a9d97, scarf: 0xff7a59, scarfTip: 0xffb347 },
  { id: 'meadow', name: 'Meadowleaf', need: 3, hood: 0x7ccf5a, hoodDark: 0x4f9a3c, scarf: 0xffe27a, scarfTip: 0xff9fb8 },
  { id: 'ember', name: 'Emberheart', need: 9, hood: 0xff7a3a, hoodDark: 0xc4482a, scarf: 0x3a2a40, scarfTip: 0xffd27a },
  { id: 'aurora', name: 'Aurora', need: 15, hood: 0x8a9cff, hoodDark: 0x5a62c8, scarf: 0x7af0c8, scarfTip: 0xc89cff },
  { id: 'midnight', name: 'Midnight', need: 21, hood: 0x2a2a5a, hoodDark: 0x1a1a3a, scarf: 0x9ff2ff, scarfTip: 0xffffff },
  { id: 'gold', name: 'Sunforged', need: 27, hood: 0xffd36b, hoodDark: 0xd9a441, scarf: 0xfff4d0, scarfTip: 0xffa21a },
];

const blank = () => ({ version: 1, levels: {}, skin: 'classic', seenIntro: {} });

export function createProgress({ levels, storage = safeStorage() } = {}) {
  let data = load();

  function load() {
    try {
      const raw = storage?.getItem(SAVE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && parsed.levels) return { ...blank(), ...parsed };
    } catch {
      // fall through to a fresh save
    }
    return blank();
  }

  function save() {
    try {
      storage?.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // storage full or blocked: progress lives for this session only
    }
  }

  // Levels that count for unlocking: the tutorial never blocks anything.
  const campaign = () => levels.filter((l) => l.world && l.world !== 'tutorial');

  const api = {
    get data() {
      return data;
    },

    record(id) {
      return data.levels[id] ?? null;
    },

    isComplete(id) {
      return !!data.levels[id]?.done;
    },

    // The first campaign level is always open; each later one opens when the one before is done.
    isUnlocked(id) {
      const list = campaign();
      const i = list.findIndex((l) => l.id === id);
      if (i < 0) return true; // tutorial and unknown ids are always playable
      return i === 0 || api.isComplete(list[i - 1].id);
    },

    // The furthest unlocked, unfinished level: where "Continue" goes.
    nextUp() {
      const list = campaign();
      return (list.find((l) => api.isUnlocked(l.id) && !api.isComplete(l.id)) ?? list[list.length - 1])?.id ?? null;
    },

    sunstonesFound(id) {
      return (data.levels[id]?.sunstones ?? []).filter(Boolean).length;
    },

    get totalSunstones() {
      return Object.values(data.levels).reduce((n, r) => n + (r.sunstones ?? []).filter(Boolean).length, 0);
    },

    get maxSunstones() {
      return campaign().reduce((n, l) => n + (l.sunstones?.length ?? 0), 0);
    },

    get completedCount() {
      return campaign().filter((l) => api.isComplete(l.id)).length;
    },

    // Merge one finished run into the save. Returns what's new, for the results screen.
    complete(id, { timeMs, shards = 0, totalShards = 0, sunstones = [], deaths = 0 }) {
      const prev = data.levels[id] ?? {};
      const before = api.totalSunstones;
      const unlockedBefore = new Set(api.unlockedSkins().map((s) => s.id));
      const firstClear = !prev.done;
      const record = {
        done: true,
        bestMs: prev.bestMs ? Math.min(prev.bestMs, Math.round(timeMs)) : Math.round(timeMs),
        bestShards: Math.max(prev.bestShards ?? 0, shards),
        totalShards,
        sunstones: sunstones.map((s, i) => !!s || !!prev.sunstones?.[i]),
        clears: (prev.clears ?? 0) + 1,
        fewestDeaths: Math.min(prev.fewestDeaths ?? Infinity, deaths),
      };
      data.levels[id] = record;
      save();
      return {
        firstClear,
        newBest: !prev.bestMs || timeMs < prev.bestMs,
        newSunstones: api.totalSunstones - before,
        newSkins: api.unlockedSkins().filter((s) => !unlockedBefore.has(s.id)),
        record,
      };
    },

    // Sunstones count the moment they're picked up, even if Pip doesn't finish the level.
    keepSunstone(id, index) {
      const rec = data.levels[id] ?? (data.levels[id] = { done: false, sunstones: [] });
      rec.sunstones = rec.sunstones ?? [];
      if (rec.sunstones[index]) return false;
      rec.sunstones[index] = true;
      save();
      return true;
    },

    unlockedSkins() {
      return SKINS.filter((s) => api.totalSunstones >= s.need);
    },

    get skin() {
      const s = SKINS.find((k) => k.id === data.skin);
      return s && api.totalSunstones >= s.need ? s : SKINS[0];
    },

    setSkin(id) {
      if (!api.unlockedSkins().some((s) => s.id === id)) return false;
      data.skin = id;
      save();
      return true;
    },

    // One-time flags (e.g. a world's intro card was shown).
    seen(key) {
      return !!data.seenIntro[key];
    },
    markSeen(key) {
      data.seenIntro[key] = true;
      save();
    },

    reset() {
      data = blank();
      save();
    },
  };
  return api;
}

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
