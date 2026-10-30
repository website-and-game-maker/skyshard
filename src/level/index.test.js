import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createLevel } from './index.js';
import { shards, crumblers, islandById, checkpoints } from './layout.js';

const makePlayer = (x = 0, y = 0, z = 0) => ({
  position: new THREE.Vector3(x, y, z),
  velocity: new THREE.Vector3(),
  halfWidth: 0.35,
  height: 1.1,
  grounded: true,
});

const atShard = (p, i) => p.position.set(shards[i][0], shards[i][1] - 0.55, shards[i][2]);
const step = (level, player, n = 1, dt = 1 / 60) => {
  const events = [];
  for (let k = 0; k < n; k++) events.push(...level.update(dt, player));
  return events;
};

describe('createLevel', () => {
  let scene, level, player;
  beforeEach(() => {
    scene = new THREE.Scene();
    level = createLevel({ scene, quality: 'low' });
    player = makePlayer(0, 0, 4.5);
  });

  it('matches the contract shape', () => {
    expect(Array.isArray(level.colliders)).toBe(true);
    expect(level.colliders.length).toBeGreaterThan(30);
    for (const c of level.colliders) {
      expect(c.box).toBeInstanceOf(THREE.Box3);
      expect(c.box.isEmpty()).toBe(false);
    }
    expect(level.killY).toBeLessThan(-10);
    expect(level.spawn).toBeInstanceOf(THREE.Vector3);
    expect(level.respawnPoint.equals(level.spawn)).toBe(true);
    expect(level.shardsTotal).toBe(shards.length);
    expect(level.shardsCollected).toBe(0);
    expect(level.shardsRequired).toBeGreaterThan(0);
    expect(scene.fog).toBeTruthy();
  });

  it('runs behind menus with no player and no time step', () => {
    expect(level.update(0, null, 1.5)).toEqual([]);
    expect(level.update(0, null, 1.6)).toEqual([]);
  });

  it('collects each shard once', () => {
    atShard(player, 0);
    const first = step(level, player);
    expect(first).toEqual([{ type: 'shard', collected: 1, total: shards.length }]);
    expect(step(level, player, 5)).toEqual([]);
    expect(level.shardsCollected).toBe(1);
  });

  it('moves platforms and reports their velocity', () => {
    const movers = level.colliders.filter((c) => c.velocity);
    expect(movers.length).toBe(4);
    const before = movers.map((m) => m.box.getCenter(new THREE.Vector3()));
    step(level, null, 60);
    const moved = movers.some((m, i) => m.box.getCenter(new THREE.Vector3()).distanceTo(before[i]) > 0.5);
    expect(moved).toBe(true);
    expect(movers.some((m) => m.velocity.length() > 0.1)).toBe(true);
  });

  it('activates checkpoints in order and moves the respawn point', () => {
    const cp = checkpoints[0];
    const i = islandById[cp.island];
    player.position.set(i.x + cp.dx + 1, i.y, i.z + cp.dz);
    const events = step(level, player);
    const e = events.find((v) => v.type === 'checkpoint');
    expect(e.index).toBe(1);
    expect(level.respawnPoint.equals(e.position)).toBe(true);
    expect(step(level, player, 3).some((v) => v.type === 'checkpoint')).toBe(false);
  });

  it('does not move the respawn point back to an earlier checkpoint', () => {
    const at = (k) => {
      const cp = checkpoints[k];
      const i = islandById[cp.island];
      player.position.set(i.x + cp.dx + 1, i.y, i.z + cp.dz);
      return step(level, player);
    };
    at(1);
    const later = level.respawnPoint.clone();
    expect(at(0).some((v) => v.type === 'checkpoint')).toBe(false);
    expect(level.respawnPoint.equals(later)).toBe(true);
  });

  it('keeps the beacon locked until enough shards, then signals the goal once', () => {
    const b = level.beaconPosition;
    player.position.set(b.x + 1.5, b.y, b.z);
    const locked = step(level, player);
    expect(locked).toEqual([{ type: 'beaconLocked', needed: level.shardsRequired }]);
    expect(step(level, player, 10)).toEqual([]); // only once per visit

    player.position.set(0, 50, 0);
    step(level, player);
    for (let k = 0; k < level.shardsRequired; k++) {
      atShard(player, k);
      step(level, player);
    }
    player.position.set(b.x + 1.5, b.y, b.z);
    expect(step(level, player)).toEqual([{ type: 'goal' }]);
    expect(step(level, player, 10)).toEqual([]);
  });

  it('crumbles a slab under Pip and brings it back later', () => {
    const c = crumblers[0];
    const count = level.colliders.length;
    player.position.set(c.top[0], c.top[1], c.top[2]);
    step(level, player, 60);
    expect(level.colliders.length).toBe(count - 1);
    player.position.set(0, 0, 4.5);
    step(level, player, 60 * 5);
    expect(level.colliders.length).toBe(count);
  });

  it('gives a heart once', () => {
    const heart = level.root.children.find((o) => o.geometry?.type === 'ExtrudeGeometry' && o.material?.color?.getHex() === 0xff5f86);
    expect(heart).toBeTruthy();
    player.position.set(heart.position.x, heart.userData.base - 0.55, heart.position.z);
    expect(step(level, player).filter((e) => e.type === 'heart')).toHaveLength(1);
    expect(step(level, player, 3).filter((e) => e.type === 'heart')).toHaveLength(0);
  });

  it('reset restores a fresh run', () => {
    atShard(player, 0);
    step(level, player);
    const cp = checkpoints[0];
    const i = islandById[cp.island];
    player.position.set(i.x + cp.dx + 1, i.y, i.z + cp.dz);
    step(level, player);
    level.reset();
    expect(level.shardsCollected).toBe(0);
    expect(level.respawnPoint.equals(level.spawn)).toBe(true);
    atShard(player, 0);
    expect(step(level, player)[0].type).toBe('shard');
  });

  it('marks the mushroom as bouncy and the thorns as a hazard', () => {
    expect(level.colliders.some((c) => c.bouncy > 0)).toBe(true);
    expect(level.colliders.some((c) => c.hazard === true)).toBe(true);
  });

  it('exposes enemy spawns in world space', () => {
    expect(level.enemySpawns.length).toBeGreaterThan(5);
    for (const s of level.enemySpawns) expect(s.home).toBeInstanceOf(THREE.Vector3);
  });

  it('dispose removes everything it added', () => {
    level.dispose();
    expect(scene.children.length).toBe(0);
    expect(scene.fog).toBeNull();
  });

  it('builds on high quality too', () => {
    const s = new THREE.Scene();
    const hi = createLevel({ scene: s, quality: 'high' });
    expect(hi.colliders.length).toBe(level.colliders.length);
    hi.dispose();
  });
});
