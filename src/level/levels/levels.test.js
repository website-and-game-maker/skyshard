// Every registered level is validated the same way: data sanity, then the autopilot
// plays the level's `route` with Pip's real movement code and must reach the beacon.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LEVELS, WORLDS, levelById, nextLevelId } from './index.js';
import { createLevel } from '../index.js';
import { PlayerController } from '../../player/PlayerController.js';
import { playRoute } from './autopilot.js';
import { groundHeightAt } from '../colliders.js';

describe('level registry', () => {
  it('has unique ids and every world lists real levels in order', () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of WORLDS) {
      expect(w.levels.length).toBeGreaterThan(0);
      for (const id of w.levels) expect(levelById[id], id).toBeTruthy();
    }
  });

  it('chains levels in play order', () => {
    expect(nextLevelId('driftmeadow')).toBe('windward');
    expect(nextLevelId(LEVELS[LEVELS.length - 1].id)).toBe(null);
  });
});

for (const def of LEVELS.filter((l) => l.route)) {
  describe(`level ${def.id}`, () => {
    it('has sane data', () => {
      expect(def.name).toBeTruthy();
      expect(def.sunstones?.length ?? 0).toBe(3);
      const level = createLevel({ scene: new THREE.Scene(), quality: 'low', layout: def });
      expect(level.shardsRequired).toBeLessThanOrEqual(level.shardsTotal);
      // Spawn stands on solid ground.
      expect(groundHeightAt(level.colliders, def.spawn.x, def.spawn.z, def.spawn.y + 0.1)).toBeCloseTo(def.spawn.y, 1);
    });

    it('can be finished along its route with real Pip physics', () => {
      const level = createLevel({ scene: new THREE.Scene(), quality: 'low', layout: def });
      const result = playRoute(level, PlayerController, { beforeGoal: () => level.openGoal() });
      expect(result.ok ? 'ok' : `leg ${result.leg}: ${result.why}`).toBe('ok');
      expect(result.sim.events.some((e) => e.type === 'goal' || e.type === 'beaconLocked')).toBe(true);
    });
  });
}

// Every shard and sunstone must hang within reach of something Pip can stand on (or ride
// up an updraft / spring to). Reach: up to a double-jump high, a jump-length to the side.
function standSpots(def) {
  const spots = [];
  for (const i of def.islands ?? []) spots.push({ x: i.x, y: i.y, z: i.z, r: i.radius * 0.9 });
  for (const c of [...(def.crumblers ?? []), ...(def.blinkers ?? [])]) spots.push({ x: c.top[0], y: c.top[1], z: c.top[2], r: c.size[0] / 2 });
  for (const m of def.movers ?? []) {
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      spots.push({ x: m.from[0] + (m.to[0] - m.from[0]) * t, y: m.from[1] + (m.to[1] - m.from[1]) * t, z: m.from[2] + (m.to[2] - m.from[2]) * t, r: m.size[0] / 2 });
    }
  }
  return spots;
}

function reachable(def, p) {
  const isl = Object.fromEntries((def.islands ?? []).map((i) => [i.id, i]));
  for (const u of def.updrafts ?? []) {
    if (Math.hypot(p[0] - u.at[0], p[2] - u.at[2]) < u.radius + 1 && p[1] < u.at[1] + u.height + 4) return true;
  }
  for (const b of def.bouncers ?? []) {
    const i = isl[b.island];
    if (Math.hypot(p[0] - i.x - b.dx, p[2] - i.z - b.dz) < 2 && p[1] < i.y + 12) return true;
  }
  return standSpots(def).some((s) => {
    const side = Math.max(0, Math.hypot(p[0] - s.x, p[2] - s.z) - s.r);
    const up = p[1] - s.y;
    return side <= 3.5 && up >= 0 && up <= 5.2 - side * 0.3;
  });
}

for (const def of LEVELS.filter((l) => l.route)) {
  it(`${def.id}: every shard and sunstone is within reach`, () => {
    const bad = [...def.shards, ...def.sunstones].filter((p) => !reachable(def, p));
    expect(bad).toEqual([]);
  });
}
