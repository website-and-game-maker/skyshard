import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FollowCamera, CAMERA_STYLES, CAMERA } from './FollowCamera.js';

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
    f.yaw = 0; // player steers the camera toward the wall
    f.update(DT, new THREE.Vector3(), look());
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

  it('on respawn, turns away from a post right behind Pip instead of starting squeezed against it', () => {
    // A checkpoint totem 1.8 units behind the respawn point (camera side at yaw 0).
    const totem = { box: new THREE.Box3(new THREE.Vector3(-0.45, 0, 1.35), new THREE.Vector3(0.45, 2.2, 2.25)) };
    const ground = { box: new THREE.Box3(new THREE.Vector3(-20, -2, -20), new THREE.Vector3(20, 0, 20)) };
    const f = make([totem, ground]);
    f.yaw = 0;
    f.snap(new THREE.Vector3(0, 0, 0));
    expect(f.distance).toBeGreaterThan(f.c.distance * 0.9);
    expect(Math.abs(f.yaw)).toBeLessThan(Math.PI / 2); // nearest clear angle, not a flip
  });

  it('on respawn, resets a low pitch that would put the camera into the ground', () => {
    const ground = { box: new THREE.Box3(new THREE.Vector3(-20, -2, -20), new THREE.Vector3(20, 0, 20)) };
    const f = make([ground]);
    f.pitch = f.c.pitchMin;
    f.snap(new THREE.Vector3(0, 0, 0));
    expect(f.pitch).toBeCloseTo(f.c.defaultPitch);
    expect(f.distance).toBeCloseTo(f.c.distance);
  });

  it('standing right next to a wall does not collapse the distance', () => {
    const wall = { box: new THREE.Box3(new THREE.Vector3(0.2, -5, -5), new THREE.Vector3(1.2, 5, 5)) };
    const f = make([wall]);
    f.yaw = 0; // camera directly behind (+Z), wall to the right, not in the way
    f.snap(new THREE.Vector3(0, 0, 0));
    expect(f.distance).toBeCloseTo(f.c.distance);
  });

  it('keeps the current yaw on snap when the view is clear', () => {
    const f = make();
    f.yaw = 1;
    f.snap(new THREE.Vector3());
    expect(f.yaw).toBeCloseTo(1);
  });

  it('defaults to the close style and can switch back to the original relaxed camera', () => {
    const f = make();
    expect(f.style).toBe('close');
    expect(f.c.distance).toBe(CAMERA_STYLES.close.distance);
    f.setStyle('relaxed');
    expect(f.style).toBe('relaxed');
    for (const k of Object.keys(CAMERA_STYLES.relaxed)) expect(f.c[k]).toBe(CAMERA[k]);
    f.setStyle('nonsense');
    expect(f.style).toBe('close');
  });

  // Run sideways from a camera that starts behind -Z travel, and measure how far yaw swung.
  const swingAfter = (style, seconds) => {
    const f = make();
    f.setStyle(style);
    const t = new THREE.Vector3();
    f.snap(t, { yaw: 0 });
    for (let i = 0; i < seconds * 60; i++) {
      t.x += 7.5 * DT;
      f.update(DT, t, look());
    }
    return Math.abs(f.yaw);
  };

  it('close camera swings behind a turn much sooner than the relaxed one', () => {
    expect(swingAfter('close', 1.2)).toBeGreaterThan(swingAfter('relaxed', 1.2) + 0.5);
    expect(swingAfter('close', 2.5)).toBeGreaterThan(Math.PI / 2 - 0.15); // fully behind
  });

  it('close camera closes a small heading offset (the relaxed one barely moves)', () => {
    const run = (style) => {
      const f = make();
      f.setStyle(style);
      const t = new THREE.Vector3();
      f.snap(t, { yaw: 0.25 }); // slightly off from behind -Z travel
      for (let i = 0; i < 60; i++) {
        t.z -= 7.5 * DT;
        f.update(DT, t, look());
      }
      return Math.abs(f.yaw);
    };
    expect(run('close')).toBeLessThan(0.05);
    expect(run('relaxed')).toBeGreaterThan(0.15);
  });

  it('close camera keeps Pip near the middle of the frame while running and jumping', () => {
    const lagAfter = (style) => {
      const f = make();
      f.setStyle(style);
      const t = new THREE.Vector3();
      f.snap(t, { yaw: 0 });
      for (let i = 0; i < 20; i++) {
        t.z -= 7.5 * DT;
        t.y += 6 * DT; // rising out of a jump
        f.update(DT, t, look());
      }
      return f.pivot.distanceTo(new THREE.Vector3(t.x, t.y + f.c.pivotHeight, t.z));
    };
    expect(lagAfter('close')).toBeLessThan(lagAfter('relaxed') * 0.6);
  });

  it('snap with a yaw puts the camera straight behind that heading', () => {
    const f = make();
    for (let i = 0; i < 300; i++) f.update(DT, new THREE.Vector3(), null); // menu orbit drifts yaw
    f.snap(new THREE.Vector3(), { yaw: 0 });
    expect(f.yaw).toBeCloseTo(0);
    expect(f.camera.position.z).toBeGreaterThan(4);
  });
});
