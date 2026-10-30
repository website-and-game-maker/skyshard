import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from './FollowCamera.js';

const DT = 1 / 60;
const make = (collidables = []) => new FollowCamera(new THREE.PerspectiveCamera(60, 1, 0.1, 500), { collidables });
const look = (lookX = 0, lookY = 0) => ({ state: { lookX, lookY } });

describe('FollowCamera', () => {
  it('snap places the camera behind (+Z at yaw 0) and above the target, looking at it', () => {
    const f = make();
    f.snap(new THREE.Vector3(1, 2, 3));
    const cam = f.camera;
    expect(cam.position.z).toBeGreaterThan(3 + 5);
    expect(cam.position.y).toBeGreaterThan(2);
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const toPivot = f.pivot.clone().sub(cam.position).normalize();
    expect(fwd.dot(toPivot)).toBeCloseTo(1, 5);
  });

  it('look input rotates yaw and clamps pitch', () => {
    const f = make();
    f.snap(new THREE.Vector3());
    f.update(DT, new THREE.Vector3(), look(0.5, 0));
    expect(f.yaw).toBeCloseTo(-0.5);
    for (let i = 0; i < 50; i++) f.update(DT, new THREE.Vector3(), look(0, 1));
    expect(f.pitch).toBeCloseTo(f.c.pitchMax);
    for (let i = 0; i < 50; i++) f.update(DT, new THREE.Vector3(), look(0, -1));
    expect(f.pitch).toBeCloseTo(f.c.pitchMin);
  });

  it('yaw stays wrapped to (-PI, PI]', () => {
    const f = make();
    f.snap(new THREE.Vector3());
    for (let i = 0; i < 100; i++) f.update(DT, new THREE.Vector3(), look(0.3, 0));
    expect(Math.abs(f.yaw)).toBeLessThanOrEqual(Math.PI);
  });

  it('follows a moving target smoothly and catches up', () => {
    const f = make();
    const t = new THREE.Vector3();
    f.snap(t);
    t.set(0.5, 0, 0);
    f.update(DT, t, look());
    expect(f.pivot.x).toBeGreaterThan(0);
    expect(f.pivot.x).toBeLessThan(0.5);
    for (let i = 0; i < 120; i++) f.update(DT, t, look());
    expect(f.pivot.x).toBeCloseTo(0.5, 3);
  });

  it('pulls in to avoid clipping through a wall behind the player', () => {
    const wall = { box: new THREE.Box3(new THREE.Vector3(-10, -10, 3), new THREE.Vector3(10, 10, 4)) };
    const f = make([wall]);
    f.snap(new THREE.Vector3());
    expect(f.camera.position.z).toBeLessThan(3);
    expect(f.distance).toBeLessThan(f.c.distance);
  });

  it('ignores a box that contains the pivot', () => {
    const big = { box: new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 3, 1)) };
    const f = make([big]);
    f.snap(new THREE.Vector3());
    expect(f.distance).toBeCloseTo(f.c.distance);
  });

  it('slowly orbits when input is null (menus)', () => {
    const f = make();
    f.snap(new THREE.Vector3());
    const y0 = f.yaw;
    for (let i = 0; i < 60; i++) f.update(DT, new THREE.Vector3(), null);
    expect(f.yaw).toBeGreaterThan(y0);
  });

  it('auto-swings behind sideways travel after the player stops looking', () => {
    const f = make();
    const t = new THREE.Vector3();
    f.snap(t);
    for (let i = 0; i < 240; i++) {
      t.x += 7 * DT; // running to the right (+X)
      f.update(DT, t, look());
    }
    // Behind +X travel means the camera sits on the -X side: yaw toward -PI/2.
    expect(f.yaw).toBeLessThan(-0.3);
  });

  it('snaps instead of sweeping when the target teleports', () => {
    const f = make();
    f.snap(new THREE.Vector3());
    f.update(DT, new THREE.Vector3(100, 0, 0), look());
    expect(f.pivot.x).toBeCloseTo(100);
  });
});
