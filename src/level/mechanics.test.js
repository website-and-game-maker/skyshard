import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { moverAt, isStandingOn, createCrumbleState, stepCrumble, CRUMBLE_TIMES, touchesPickup, inZone } from './mechanics.js';

const player = (x, y, z) => ({ position: new THREE.Vector3(x, y, z), halfWidth: 0.35, height: 1.1 });

describe('moverAt', () => {
  const def = { from: [0, 0, 0], to: [10, 2, 0], period: 4, phase: 0 };

  it('starts at `from` and reaches `to` at half period', () => {
    expect(moverAt(def, 0).top).toEqual([0, 0, 0]);
    const mid = moverAt(def, 2).top;
    expect(mid[0]).toBeCloseTo(10);
    expect(mid[1]).toBeCloseTo(2);
  });

  it('reports a velocity that matches the motion', () => {
    for (const t of [0.3, 1.1, 2.7, 3.5]) {
      const h = 1e-4;
      const a = moverAt(def, t - h).top, b = moverAt(def, t + h).top;
      const v = moverAt(def, t).velocity;
      for (let i = 0; i < 3; i++) expect(v[i]).toBeCloseTo((b[i] - a[i]) / (2 * h), 3);
    }
  });

  it('is at rest at both ends', () => {
    expect(Math.abs(moverAt(def, 0).velocity[0])).toBeLessThan(1e-9);
    expect(Math.abs(moverAt(def, 2).velocity[0])).toBeLessThan(1e-9);
  });
});

describe('isStandingOn', () => {
  const box = new THREE.Box3(new THREE.Vector3(-1, -0.5, -1), new THREE.Vector3(1, 0, 1));
  it('detects feet on the top face, including a little overhang', () => {
    expect(isStandingOn(player(0, 0, 0), box)).toBe(true);
    expect(isStandingOn(player(1.2, 0.05, 0), box)).toBe(true);
  });
  it('ignores players above, below or beside', () => {
    expect(isStandingOn(player(0, 1, 0), box)).toBe(false);
    expect(isStandingOn(player(0, -0.5, 0), box)).toBe(false);
    expect(isStandingOn(player(3, 0, 0), box)).toBe(false);
  });
});

describe('crumbling slab', () => {
  it('stays solid until stepped on', () => {
    const s = createCrumbleState();
    for (let i = 0; i < 100; i++) expect(stepCrumble(s, 0.1, false)).toBe(true);
    expect(s.phase).toBe('solid');
  });

  it('shakes, falls, disappears, then reforms', () => {
    const s = createCrumbleState();
    stepCrumble(s, 0.016, true);
    expect(s.phase).toBe('shaking');
    expect(stepCrumble(s, CRUMBLE_TIMES.shaking - 0.05, false)).toBe(true);
    expect(stepCrumble(s, 0.1, false)).toBe(false);
    expect(s.phase).toBe('falling');
    stepCrumble(s, CRUMBLE_TIMES.falling, false);
    expect(s.phase).toBe('gone');
    stepCrumble(s, CRUMBLE_TIMES.gone + CRUMBLE_TIMES.reforming, false);
    expect(s.phase).toBe('solid');
    expect(stepCrumble(s, 0.016, false)).toBe(true);
  });

  it('handles one huge time step without getting stuck', () => {
    const s = createCrumbleState();
    stepCrumble(s, 0, true);
    expect(stepCrumble(s, 100, false)).toBe(true);
    expect(s.phase).toBe('solid');
  });
});

describe('pickups and zones', () => {
  it('collects a shard at chest height', () => {
    expect(touchesPickup(player(0, 0, 0), [0, 0.9, 0])).toBe(true);
    expect(touchesPickup(player(0, 0, 0), [0, 3, 0])).toBe(false);
    expect(touchesPickup(player(2, 0, 0), [0, 0.9, 0])).toBe(false);
  });
  it('uses a horizontal circle with limited height for zones', () => {
    expect(inZone(player(1, 0, 1), [0, 0, 0], 2)).toBe(true);
    expect(inZone(player(3, 0, 0), [0, 0, 0], 2)).toBe(false);
    expect(inZone(player(0, 5, 0), [0, 0, 0], 2)).toBe(false);
    expect(inZone(player(0, -2, 0), [0, 0, 0], 2)).toBe(false);
  });
});
