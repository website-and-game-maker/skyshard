// End-to-end check that the level can actually be finished with Pip's real movement
// code: an autopilot runs, jumps and double-jumps along the critical path from the
// spawn to the beacon, riding platforms and the mushroom on the way.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLevel } from './index.js';
import { islandById, movers, crumblers } from './layout.js';
import { groundHeightAt } from './colliders.js';
import { moverAt } from './mechanics.js';
import { PlayerController } from '../player/PlayerController.js';

const DT = 1 / 60;

const island = (id, frac = 0.85) => () => {
  const i = islandById[id];
  return { x: i.x, y: i.y, z: i.z, r: i.radius * frac };
};
const point = (id, dx, dz) => () => {
  const i = islandById[id];
  return { x: i.x + dx, y: i.y, z: i.z + dz, r: 0.8 };
};
const crumble = (id) => () => {
  const c = crumblers.find((v) => v.id === id);
  return { x: c.top[0], y: c.top[1], z: c.top[2], r: c.size[0] / 2 };
};
const moverDef = (id) => movers.find((m) => m.id === id);
const mover = (id) => (t) => {
  const m = moverDef(id);
  const { top } = moverAt(m, t);
  return { x: top[0], y: top[1], z: top[2], r: m.size[0] / 2 };
};
// True once the platform will be within `tol` of an end of its path `lead` seconds from now.
const moverNear = (id, end, lead = 0.45, tol = 0.6) => (t) => {
  const m = moverDef(id);
  const { top } = moverAt(m, t + lead);
  const e = end === 'from' ? m.from : m.to;
  return Math.hypot(top[0] - e[0], top[1] - e[1], top[2] - e[2]) < tol;
};

const ROUTE = [
  { name: 'step1', target: island('step1') },
  { name: 'step2', target: island('step2') },
  { name: 'step3', target: island('step3') },
  { name: 'hollow', target: point('hollow', 0, 2) },
  { name: 'hollow far edge', target: point('hollow', 0, -5.5) },
  { name: 'ferry', target: mover('ferry'), wait: moverNear('ferry', 'from') },
  { name: 'grove', target: point('grove', 0, 0), wait: moverNear('ferry', 'to', 0.3) },
  { name: 'crumble1', target: crumble('crumble1') },
  { name: 'crumble2', target: crumble('crumble2') },
  { name: 'crumble3', target: crumble('crumble3') },
  { name: 'ledge', target: island('ledge') },
  { name: 'lift', target: mover('lift'), wait: moverNear('lift', 'from') },
  { name: 'heights', target: point('heights', 0, 5), wait: moverNear('lift', 'to', 0.3) },
  { name: 'heights east', target: point('heights', 5, -4) },
  { name: 'springrock', target: island('springrock'), spring: true },
  { name: 'spire', target: island('spire', 0.7) },
  { name: 'spire east', target: point('spire', 4.5, -1) },
  { name: 'skyferry', target: mover('skyferry'), wait: moverNear('skyferry', 'from') },
  { name: 'beacon', target: point('beacon', -2.6, 0), wait: moverNear('skyferry', 'to', 0.3) },
];

function runLeg(sim, leg) {
  const { pc, level } = sim;
  const input = { moveX: 0, moveY: 0, jump: false, jumpPressed: false };
  const step = () => {
    pc.update(DT, input, sim.yaw);
    sim.events.push(...level.update(DT, pc.body ? { ...pc.body, grounded: pc.grounded } : pc, sim.t));
    sim.t += DT;
    input.jumpPressed = false;
    const p = pc.position;
    if (Math.round(sim.t / DT) % 6 === 0) sim.track.push(`${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} g${+pc.grounded}`);
  };
  // Wait (standing still) for a moving platform to come round.
  if (leg.wait) {
    for (let k = 0; k < 60 * 12 && !leg.wait(sim.t); k++) step();
  }
  let jumps = 0;
  let sprung = false;
  for (let k = 0; k < 60 * 8; k++) {
    const tgt = leg.target(sim.t);
    const p = pc.position;
    const dx = tgt.x - p.x, dz = tgt.z - p.z;
    const dist = Math.hypot(dx, dz);
    const onTarget = pc.grounded && dist <= tgt.r && Math.abs(p.y - tgt.y) < 0.2;
    if (onTarget) return { ok: true };
    if (p.y < level.killY) return { ok: false, why: `fell; track ${sim.track.slice(-32, -10).join(' | ')}` };

    sim.yaw = Math.atan2(dx, dz) + Math.PI; // forward (moveY = 1) points at the target
    input.moveY = dist > 0.25 ? 1 : 0;
    input.jump = true;

    if (pc.grounded) {
      jumps = 0;
      const ahead = new THREE.Vector3(dx, 0, dz).normalize();
      const probe = p.clone().addScaledVector(ahead, 0.75);
      const groundAhead = groundHeightAt(level.colliders, probe.x, probe.z, p.y + 0.3);
      const edge = groundAhead < p.y - 0.4;
      const climb = tgt.y > p.y + 0.3 && dist - tgt.r < 2.2;
      if ((edge || climb) && dist > tgt.r) {
        input.jumpPressed = true;
        jumps = 1;
      }
    } else if (pc.velocity.y > 15) {
      sprung = true;
    } else if (jumps < 2 && pc.velocity.y < 1.0 && dist > tgt.r && p.y < tgt.y + 2.5 && !(leg.spring && !sprung)) {
      input.jumpPressed = true;
      jumps = 2;
    }
    step();
  }
  return { ok: false, why: `timeout at ${pc.position.toArray().map((n) => n.toFixed(1))}` };
}

describe('critical path playthrough (real Pip physics)', () => {
  it('reaches the beacon from the spawn without falling', () => {
    const scene = new THREE.Scene();
    const level = createLevel({ scene, quality: 'low' });
    const pc = new PlayerController({ world: level, spawn: level.spawn.clone() });
    const sim = { pc, level, t: 0, yaw: 0, events: [], track: [] };
    for (let k = 0; k < 30; k++) runLeg(sim, { target: () => ({ ...level.spawn, r: 0.3 }) });

    for (const leg of ROUTE) {
      const result = runLeg(sim, leg);
      expect(result, `leg "${leg.name}"`).toEqual({ ok: true });
    }

    const checkpoints = sim.events.filter((e) => e.type === 'checkpoint').map((e) => e.index);
    expect(checkpoints).toEqual([1, 2, 3]);
    const beaconVisit = sim.events.find((e) => e.type === 'beaconLocked' || e.type === 'goal');
    expect(beaconVisit).toBeTruthy();
    expect(level.shardsCollected).toBeGreaterThan(5);
  });

  it('the springy mushroom launches Pip high enough to reach the spire', () => {
    const scene = new THREE.Scene();
    const level = createLevel({ scene, quality: 'low' });
    const spring = level.colliders.find((c) => c.bouncy);
    const top = spring.box.getCenter(new THREE.Vector3()).setY(spring.box.max.y + 1);
    const pc = new PlayerController({ world: level, spawn: top });
    let peak = -Infinity;
    for (let k = 0; k < 120; k++) {
      pc.update(DT, {}, 0);
      peak = Math.max(peak, pc.position.y);
    }
    expect(peak).toBeGreaterThan(islandById.spire.y + 1.5);
  });
});
