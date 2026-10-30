import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createEnemies } from './index.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const makePlayer = (pos, extra = {}) => ({
  position: pos.clone(), velocity: v(0, 0, 0), halfWidth: 0.35, height: 1.1,
  groundPounding: false, invulnerable: false, ...extra,
});

// A tiny fake level: one island, one thorn patch, one enemy of each kind.
function fakeLevel() {
  return {
    colliders: [
      { box: new THREE.Box3(v(-20, -2, -20), v(20, 0, 20)) },
      { box: new THREE.Box3(v(10, 0, 10), v(12, 0.35, 12)), hazard: true },
    ],
    enemySpawns: [
      { kind: 'mossback', home: v(0, 0, 0), a: v(-3, 0, 0), b: v(3, 0, 0), leash: 5 },
      { kind: 'gloomwisp', home: v(-10, 4, -10), phase: 0 },
      { kind: 'puffcap', home: v(10, 0, -10) },
    ],
  };
}

describe('createEnemies', () => {
  let scene, enemies;
  beforeEach(() => {
    scene = new THREE.Scene();
    enemies = createEnemies({ scene, level: fakeLevel() });
  });

  const moss = () => enemies.list.find((e) => e.kind === 'mossback');

  it('matches the contract and is safe with no player', () => {
    expect(enemies.update(0, null)).toEqual([]);
    expect(enemies.update(1 / 60, null)).toEqual([]);
    expect(typeof enemies.reset).toBe('function');
  });

  it('works with no level at all', () => {
    const e = createEnemies({ scene: new THREE.Scene() });
    expect(e.update(1 / 60, makePlayer(v(0, 0, 0)))).toEqual([]);
  });

  it('a stomp from above defeats the enemy and asks for a bounce', () => {
    const m = moss();
    const p = makePlayer(v(m.pos.x, 1.1, m.pos.z), { velocity: v(0, -6, 0) });
    const events = enemies.update(1 / 60, p);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('stomp');
    expect(events[0].kind).toBe('mossback');
    expect(moss().alive).toBe(false);
    expect(enemies.update(1 / 60, p)).toEqual([]);
  });

  it('a ground pound counts as a stomp', () => {
    const m = moss();
    const p = makePlayer(v(m.pos.x, 0.4, m.pos.z), { groundPounding: true, velocity: v(0, -20, 0) });
    expect(enemies.update(1 / 60, p)[0].type).toBe('stomp');
  });

  it('touching from the side hurts with knockback away from the enemy', () => {
    const m = moss();
    const p = makePlayer(v(m.pos.x + 0.9, 0, m.pos.z));
    const events = enemies.update(1 / 60, p);
    const hurt = events.find((e) => e.type === 'hurt');
    expect(hurt).toBeTruthy();
    expect(hurt.knockback.x).toBeGreaterThan(0);
    expect(hurt.knockback.y).toBeGreaterThan(0);
    expect(moss().alive).toBe(true);
  });

  it('does not hurt an invulnerable Pip', () => {
    const m = moss();
    const p = makePlayer(v(m.pos.x + 0.9, 0, m.pos.z), { invulnerable: true });
    expect(enemies.update(1 / 60, p)).toEqual([]);
  });

  it('reports at most one hurt per step', () => {
    const p = makePlayer(v(11, 0.35, 11));
    const m = moss();
    m.pos.set(11.8, 0, 11);
    const events = enemies.update(1 / 60, p);
    expect(events.filter((e) => e.type === 'hurt')).toHaveLength(1);
  });

  it('thorns hurt when touched', () => {
    const p = makePlayer(v(11, 0.35, 11));
    const events = enemies.update(1 / 60, p);
    expect(events.some((e) => e.type === 'hurt')).toBe(true);
  });

  it('spores from a Puffcap hit Pip', () => {
    const p = makePlayer(v(10, 0, -4));
    let hit = false;
    for (let i = 0; i < 60 * 5 && !hit; i++) hit = enemies.update(1 / 60, p).some((e) => e.type === 'hurt');
    expect(hit).toBe(true);
  });

  it('reset brings defeated enemies back', () => {
    const m = moss();
    enemies.update(1 / 60, makePlayer(v(m.pos.x, 1.1, m.pos.z), { velocity: v(0, -6, 0) }));
    expect(moss().alive).toBe(false);
    enemies.reset();
    expect(moss().alive).toBe(true);
    expect(enemies.root.children.filter((c) => c.visible).length).toBeGreaterThanOrEqual(3);
  });

  it('dispose removes its meshes from the scene', () => {
    enemies.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
