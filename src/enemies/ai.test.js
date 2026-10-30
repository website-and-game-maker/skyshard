import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createMossback, updateMossback, MOSSBACK, createWisp, updateWisp, WISP,
  createPuffcap, updatePuffcap, PUFFCAP, updateProjectile,
} from './ai.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const player = (x, y, z) => ({ position: v(x, y, z), velocity: v(0, 0, 0), halfWidth: 0.35, height: 1.1 });
const run = (fn, e, seconds, p, dt = 1 / 60) => {
  const out = [];
  for (let t = 0; t < seconds; t += dt) {
    const r = fn(e, dt, p);
    if (r) out.push(r);
  }
  return out;
};

describe('Mossback', () => {
  const make = () => createMossback({ home: v(0, 2, 0), a: v(-4, 2, 0), b: v(4, 2, 0), leash: 5 });

  it('patrols back and forth between its two points', () => {
    const e = make();
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < 60 * 12; i++) {
      updateMossback(e, 1 / 60, null);
      minX = Math.min(minX, e.pos.x);
      maxX = Math.max(maxX, e.pos.x);
    }
    expect(minX).toBeCloseTo(-4, 1);
    expect(maxX).toBeCloseTo(4, 1);
    expect(e.mode).toBe('patrol');
  });

  it('notices Pip, telegraphs, then charges at him', () => {
    const e = make();
    const p = player(0, 2, 4);
    updateMossback(e, 1 / 60, p);
    expect(e.mode).toBe('alert');
    run(updateMossback, e, MOSSBACK.alertTime + 0.02, p);
    expect(e.mode).toBe('charge');
    const before = e.pos.distanceTo(p.position);
    run(updateMossback, e, 0.3, p);
    expect(e.pos.distanceTo(p.position)).toBeLessThan(before);
  });

  it('ignores Pip on another level or far away', () => {
    const e = make();
    updateMossback(e, 1 / 60, player(0, 8, 2));
    expect(e.mode).toBe('patrol');
    updateMossback(e, 1 / 60, player(30, 2, 0));
    expect(e.mode).toBe('patrol');
  });

  it('never leaves its leash, even chasing Pip off the edge', () => {
    const e = make();
    const p = player(5.5, 2, 3);
    for (let i = 0; i < 60 * 20; i++) {
      updateMossback(e, 1 / 60, p);
      expect(Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z)).toBeLessThanOrEqual(e.leash + 1e-6);
      expect(e.pos.y).toBe(2);
    }
  });

  it('cycles back to patrolling after a charge', () => {
    const e = make();
    const p = player(0, 2, 4);
    run(updateMossback, e, MOSSBACK.alertTime + MOSSBACK.chargeTime + 0.1, p);
    expect(e.mode).toBe('recover');
    run(updateMossback, e, MOSSBACK.recoverTime + 0.05, null);
    expect(e.mode).toBe('patrol');
  });
});

describe('Gloomwisp', () => {
  it('hovers near home when Pip is away', () => {
    const e = createWisp({ home: v(0, 5, 0) });
    for (let i = 0; i < 600; i++) {
      updateWisp(e, 1 / 60, player(50, 0, 0));
      expect(e.pos.distanceTo(e.home)).toBeLessThan(1.6);
    }
    expect(e.mode).toBe('hover');
  });

  it('winds up, swoops through where Pip was, then returns home', () => {
    const e = createWisp({ home: v(0, 5, 0) });
    const p = player(0, 2, 6);
    updateWisp(e, 1 / 60, p);
    expect(e.mode).toBe('windup');
    run(updateWisp, e, WISP.windupTime + 0.02, p);
    expect(e.mode).toBe('swoop');
    let closest = Infinity;
    const chest = p.position.clone().setY(p.position.y + 0.6);
    while (e.mode === 'swoop') {
      updateWisp(e, 1 / 60, p);
      closest = Math.min(closest, e.pos.distanceTo(chest));
    }
    expect(closest).toBeLessThan(0.4);
    p.position.set(100, 0, 0);
    run(updateWisp, e, 6, p);
    expect(['rest', 'hover']).toContain(e.mode);
    expect(e.pos.distanceTo(e.home)).toBeLessThan(1.6);
  });
});

describe('Puffcap', () => {
  it('inflates and fires a spore at Pip, then waits for its cooldown', () => {
    const e = createPuffcap({ home: v(0, 0, 0) });
    e.cooldown = 0;
    const p = player(0, 0, 8);
    const shots = run(updatePuffcap, e, PUFFCAP.chargeTime + 0.05, p);
    expect(shots).toHaveLength(1);
    const s = shots[0];
    expect(s.vel.length()).toBeCloseTo(PUFFCAP.projectileSpeed);
    expect(s.vel.z).toBeGreaterThan(0);
    expect(run(updatePuffcap, e, PUFFCAP.cooldown - 0.1, p)).toHaveLength(0);
    expect(run(updatePuffcap, e, PUFFCAP.chargeTime + 0.3, p)).toHaveLength(1);
  });

  it('holds fire when Pip is out of range', () => {
    const e = createPuffcap({ home: v(0, 0, 0) });
    expect(run(updatePuffcap, e, 10, player(0, 0, 40))).toHaveLength(0);
    expect(run(updatePuffcap, e, 10, null)).toHaveLength(0);
  });

  it('spores pop on terrain and time out', () => {
    const wall = { box: new THREE.Box3(v(-1, -1, 2), v(1, 1, 3)) };
    const p = { pos: v(0, 0, 0), vel: v(0, 0, 5), life: 4, alive: true };
    run(updateProjectile, p, 1, [wall]);
    expect(p.alive).toBe(false);
    expect(p.pos.z).toBeLessThan(3.2);
    const q = { pos: v(0, 0, 0), vel: v(0, 0, 5), life: 0.5, alive: true };
    run(updateProjectile, q, 1, []);
    expect(q.alive).toBe(false);
  });
});
