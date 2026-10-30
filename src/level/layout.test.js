import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  islands, islandById, movers, crumblers, bouncers, checkpoints, shards, spawn, enemySpawns, hearts, SHARDS_REQUIRED, KILL_Y,
} from './layout.js';
import { islandColliders, boxCollider, groundHeightAt } from './colliders.js';
import { moverAt } from './mechanics.js';

// Conservative jump budget, well inside what Pip can do (jump + double jump).
const MAX_GAP_FLAT = 4.2; // rise up to 1.5
const MAX_GAP_HIGH = 3.6; // rise up to 3.2 (needs the double jump)
const MAX_RISE = 3.2;

const islandSurface = (id) => {
  const i = islandById[id];
  return { x: i.x, y: i.y, z: i.z, r: i.radius * 0.92 };
};
const boxSurface = (top, size) => ({ x: top[0], y: top[1], z: top[2], r: Math.min(size[0], size[2]) / 2 });
const moverSurface = (id, end) => {
  const m = movers.find((v) => v.id === id);
  return boxSurface(end === 'from' ? m.from : m.to, m.size);
};
const crumbleSurface = (id) => {
  const c = crumblers.find((v) => v.id === id);
  return boxSurface(c.top, c.size);
};
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;

const staticColliders = () => [
  ...islands.flatMap((i) => islandColliders(i)),
  ...crumblers.map((c) => boxCollider([c.top[0], c.top[1] - c.size[1] / 2, c.top[2]], c.size)),
];

describe('level route', () => {
  const legs = [
    [islandSurface('meadow'), islandSurface('step1')],
    [islandSurface('step1'), islandSurface('step2')],
    [islandSurface('step2'), islandSurface('step3')],
    [islandSurface('step3'), islandSurface('hollow')],
    [islandSurface('hollow'), moverSurface('ferry', 'from')],
    [moverSurface('ferry', 'to'), islandSurface('grove')],
    [islandSurface('grove'), moverSurface('sideferry', 'from')],
    [moverSurface('sideferry', 'to'), islandSurface('bonus')],
    [islandSurface('grove'), crumbleSurface('crumble1')],
    [crumbleSurface('crumble1'), crumbleSurface('crumble2')],
    [crumbleSurface('crumble2'), crumbleSurface('crumble3')],
    [crumbleSurface('crumble3'), islandSurface('ledge')],
    [islandSurface('ledge'), moverSurface('lift', 'from')],
    [moverSurface('lift', 'to'), islandSurface('heights')],
    [islandSurface('heights'), islandSurface('springrock')],
    [islandSurface('springrock'), islandSurface('hopstone')],
    [islandSurface('hopstone'), islandSurface('spire')],
    [islandSurface('spire'), moverSurface('skyferry', 'from')],
    [moverSurface('skyferry', 'to'), islandSurface('beacon')],
  ];

  it.each(legs.map((l, i) => [i, l]))('leg %i is jumpable', (_i, [a, b]) => {
    const rise = b.y - a.y;
    expect(rise).toBeLessThanOrEqual(MAX_RISE);
    expect(gap(a, b)).toBeLessThanOrEqual(rise > 1.5 ? MAX_GAP_HIGH : MAX_GAP_FLAT);
  });

  it('the mushroom on spring rock launches towards the spire', () => {
    const b = bouncers[0];
    expect(b.island).toBe('springrock');
    const leg = gap(islandSurface('springrock'), islandSurface('spire'));
    const rise = islandById.spire.y - islandById.springrock.y;
    // Pip falls at 34 * 1.55 u/s^2 after a bounce, so a 28 u/s launch peaks ~7.4 units up.
    expect((b.strength * b.strength) / (2 * 34 * 1.55)).toBeGreaterThan(rise);
    expect(leg).toBeLessThan(8);
  });

  it('climbs steadily to the beacon, above the kill plane', () => {
    expect(islandById.beacon.y).toBeGreaterThan(islandById.meadow.y + 15);
    for (const i of islands) expect(i.y - i.depth).toBeGreaterThan(KILL_Y);
  });
});

describe('level geometry', () => {
  it('spawns Pip on solid ground', () => {
    expect(groundHeightAt(staticColliders(), spawn.x, spawn.z)).toBeCloseTo(spawn.y);
  });

  it('places checkpoints and their respawn spots on their islands', () => {
    const cols = staticColliders();
    for (const cp of checkpoints) {
      const i = islandById[cp.island];
      expect(groundHeightAt(cols, i.x + cp.dx, i.z + cp.dz)).toBeCloseTo(i.y);
      expect(groundHeightAt(cols, i.x + cp.dx, i.z + cp.dz - 1.8)).toBeCloseTo(i.y);
    }
  });

  it('keeps island colliders inside the visible island', () => {
    for (const i of islands) {
      for (const c of islandColliders(i)) {
        for (const [x, z] of [[c.box.min.x, c.box.min.z], [c.box.max.x, c.box.max.z], [c.box.min.x, c.box.max.z]]) {
          expect(Math.hypot(x - i.x, z - i.z)).toBeLessThanOrEqual(i.radius + 1e-6);
        }
      }
    }
  });

  it('never lets a moving platform pass through scenery', () => {
    const cols = staticColliders();
    for (const m of movers) {
      for (let k = 0; k <= 200; k++) {
        const t = (k / 200) * m.period;
        const { top } = moverAt(m, t);
        const box = boxCollider([top[0], top[1] - m.size[1] / 2, top[2]], m.size).box.expandByScalar(-0.02);
        for (const c of cols) expect(box.intersectsBox(c.box), `${m.id} at t=${t.toFixed(2)}`).toBe(false);
      }
    }
  });

  it('does not overlap islands with each other', () => {
    for (let a = 0; a < islands.length; a++) {
      for (let b = a + 1; b < islands.length; b++) {
        const A = islands[a], B = islands[b];
        const d = Math.hypot(A.x - B.x, A.z - B.z);
        const verticallyApart = Math.abs(A.y - B.y) > 1.5;
        expect(d > A.radius + B.radius - 1 || verticallyApart, `${A.id} vs ${B.id}`).toBe(true);
      }
    }
  });
});

describe('collectibles', () => {
  // Every shard floats over (or just above the arc of) something Pip can stand on.
  const surfaces = [
    ...islands.map((i) => ({ x: i.x, y: i.y, z: i.z, r: i.radius })),
    ...crumblers.map((c) => boxSurface(c.top, c.size)),
    ...movers.flatMap((m) => Array.from({ length: 11 }, (_, k) => boxSurface(moverAt(m, (k / 20) * m.period).top, m.size))),
  ];

  it.each(shards.map((s, i) => [i, s]))('shard %i is reachable', (_i, s) => {
    const ok = surfaces.some((f) => {
      const h = Math.hypot(s[0] - f.x, s[2] - f.z);
      const up = s[1] - f.y;
      return h <= f.r + 4 && up >= 0.3 && up <= 10;
    });
    expect(ok).toBe(true);
  });

  it('has a sensible shard target for the beacon', () => {
    expect(shards.length).toBeGreaterThanOrEqual(50);
    expect(SHARDS_REQUIRED).toBeLessThanOrEqual(shards.length);
    expect(SHARDS_REQUIRED / shards.length).toBeGreaterThan(0.6);
    expect(SHARDS_REQUIRED / shards.length).toBeLessThan(0.85);
  });

  it('does not stack two shards in the same spot', () => {
    for (let a = 0; a < shards.length; a++) {
      for (let b = a + 1; b < shards.length; b++) {
        const d = Math.hypot(shards[a][0] - shards[b][0], shards[a][1] - shards[b][1], shards[a][2] - shards[b][2]);
        expect(d).toBeGreaterThan(1.2);
      }
    }
  });

  it('puts hearts on islands', () => {
    for (const h of hearts) {
      const i = islandById[h.island];
      expect(Math.hypot(h.dx, h.dz)).toBeLessThan(i.radius * 0.9);
    }
  });
});

describe('enemy placement', () => {
  it('keeps every Mossback leash on its island', () => {
    const cols = staticColliders();
    for (const s of enemySpawns.filter((e) => e.kind === 'mossback')) {
      const i = islandById[s.island];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = i.x + Math.cos(a) * s.leash, z = i.z + Math.sin(a) * s.leash;
        expect(groundHeightAt(cols, x, z), `${s.island} leash`).toBeCloseTo(i.y);
      }
      for (const p of [s.a, s.b]) expect(Math.hypot(...p)).toBeLessThanOrEqual(s.leash);
    }
  });

  it('roots Puffcaps on solid ground and floats Gloomwisps above islands', () => {
    const cols = staticColliders();
    for (const s of enemySpawns.filter((e) => e.kind !== 'mossback')) {
      const i = islandById[s.island];
      if (s.kind === 'puffcap') expect(groundHeightAt(cols, i.x + s.at[0], i.z + s.at[1])).toBeCloseTo(i.y);
      else expect(s.hover).toBeGreaterThan(1.5);
    }
  });

  it('leaves the start and the beacon island peaceful', () => {
    for (const s of enemySpawns) expect(['meadow', 'beacon']).not.toContain(s.island);
  });
});
