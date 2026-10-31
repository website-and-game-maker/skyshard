import { describe, it, expect } from 'vitest';
import { createProgress, SAVE_KEY, SKINS } from './index.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
};
const LEVELS = [
  { id: 'tutorial', world: 'tutorial' },
  { id: 'a', world: 'w1', sunstones: [1, 2, 3] },
  { id: 'b', world: 'w1', sunstones: [1, 2, 3] },
  { id: 'c', world: 'w2', sunstones: [1, 2, 3] },
];

describe('progress', () => {
  it('opens levels one after another', () => {
    const p = createProgress({ levels: LEVELS, storage: memory() });
    expect(p.isUnlocked('tutorial')).toBe(true);
    expect(p.isUnlocked('a')).toBe(true);
    expect(p.isUnlocked('b')).toBe(false);
    expect(p.nextUp()).toBe('a');
    p.complete('a', { timeMs: 5000 });
    expect(p.isUnlocked('b')).toBe(true);
    expect(p.isUnlocked('c')).toBe(false);
    expect(p.nextUp()).toBe('b');
  });

  it('keeps best time, best shards and sunstones across runs, and persists', () => {
    const storage = memory();
    const p = createProgress({ levels: LEVELS, storage });
    const r1 = p.complete('a', { timeMs: 9000, shards: 10, sunstones: [true, false, false] });
    expect(r1.firstClear).toBe(true);
    expect(r1.newSunstones).toBe(1);
    const r2 = p.complete('a', { timeMs: 12000, shards: 14, sunstones: [false, true, false] });
    expect(r2.newBest).toBe(false);
    expect(p.record('a')).toMatchObject({ bestMs: 9000, bestShards: 14, sunstones: [true, true, false], clears: 2 });
    const again = createProgress({ levels: LEVELS, storage });
    expect(again.totalSunstones).toBe(2);
    expect(JSON.parse(storage.map.get(SAVE_KEY)).levels.a.done).toBe(true);
  });

  it('banks a sunstone when picked up even without finishing', () => {
    const p = createProgress({ levels: LEVELS, storage: memory() });
    expect(p.keepSunstone('b', 2)).toBe(true);
    expect(p.keepSunstone('b', 2)).toBe(false);
    expect(p.sunstonesFound('b')).toBe(1);
    expect(p.isComplete('b')).toBe(false);
  });

  it('unlocks skins with sunstones and only lets you wear unlocked ones', () => {
    const p = createProgress({ levels: LEVELS, storage: memory() });
    expect(p.setSkin('meadow')).toBe(false);
    const r = p.complete('a', { timeMs: 1, sunstones: [true, true, true] });
    expect(r.newSkins.map((s) => s.id)).toEqual(['meadow']);
    expect(p.setSkin('meadow')).toBe(true);
    expect(p.skin.id).toBe('meadow');
    expect(SKINS[0].need).toBe(0);
  });

  it('survives broken or missing storage', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    const p = createProgress({ levels: LEVELS, storage: broken });
    p.complete('a', { timeMs: 1 });
    expect(p.isUnlocked('b')).toBe(true);
    const garbage = memory();
    garbage.setItem(SAVE_KEY, '{nope');
    expect(createProgress({ levels: LEVELS, storage: garbage }).isComplete('a')).toBe(false);
  });
});
