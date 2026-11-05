// The tutorial must be finishable with Pip's real movement code, and each lesson's
// move must actually be needed: an autopilot plays it from spawn to beacon.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLevel } from './index.js';
import tutorial from './levels/tutorial.js';
import { groundHeightAt } from './colliders.js';
import { PlayerController } from '../player/PlayerController.js';

const DT = 1 / 60;
const byId = Object.fromEntries(tutorial.islands.map((i) => [i.id, i]));
const point = (id, dx = 0, dz = 0, r = 0.8) => ({ x: byId[id].x + dx, y: byId[id].y, z: byId[id].z + dz, r });
const slab = (id) => {
  const p = tutorial.platforms.find((v) => v.id === id);
  return { x: p.top[0], y: p.top[1], z: p.top[2], r: p.size[0] / 2 - 0.3 };
};
const rune = tutorial.switches[0];

function makeSim() {
  const level = createLevel({ scene: new THREE.Scene(), quality: 'low', layout: tutorial });
  const pc = new PlayerController({ world: level, spawn: level.spawn.clone() });
  const sim = { pc, level, t: 0, yaw: 0, events: [], actions: [] };
  for (const name of ['jump', 'doubleJump', 'dash', 'pound', 'spring']) pc.on(name, () => sim.actions.push(name));
  pc.on('pound', ({ position }) => level.pound(position));
  return sim;
}

function step(sim, input) {
  const { pc, level } = sim;
  pc.update(DT, input, sim.yaw);
  sim.events.push(...level.update(DT, pc.body ? { ...pc.body, grounded: pc.grounded } : pc, sim.t));
  sim.t += DT;
  input.jumpPressed = input.dashPressed = input.poundPressed = false;
}

// Run to `tgt`, jumping at edges. `dash`: dash after the double jump. `pound`: slam down on arrival.
function runLeg(sim, tgt, { dash = false, pound = false, spring = false } = {}) {
  const { pc, level } = sim;
  const input = { moveX: 0, moveY: 0, jump: true };
  let jumps = 0;
  let dashed = false;
  let sprung = false;
  for (let k = 0; k < 60 * 10; k++) {
    const p = pc.position;
    const dx = tgt.x - p.x, dz = tgt.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (pc.grounded && dist <= tgt.r && Math.abs(p.y - tgt.y) < 0.35) return { ok: true };
    if (p.y < level.killY) return { ok: false, why: `fell near ${p.toArray().map((n) => n.toFixed(1))}` };
    sim.yaw = Math.atan2(dx, dz) + Math.PI;
    input.moveY = dist > 0.25 ? 1 : 0;
    if (pc.grounded) {
      jumps = 0;
      dashed = false;
      const ahead = new THREE.Vector3(dx, 0, dz).normalize();
      const probe = p.clone().addScaledVector(ahead, 0.75);
      const edge = groundHeightAt(level.colliders, probe.x, probe.z, p.y + 0.3) < p.y - 0.4;
      const climb = tgt.y > p.y + 0.3 && dist - tgt.r < 2.2;
      if ((edge || climb || spring || (pound && dist < tgt.r + 0.5)) && dist > 0.2) {
        input.jumpPressed = true;
        jumps = 1;
      }
    } else if (pc.velocity.y > 15) {
      sprung = true;
    } else if (pound && dist < 0.5 && pc.velocity.y < 1) {
      input.poundPressed = true;
    } else if (jumps < 2 && pc.velocity.y < 1 && dist > tgt.r && !(spring && !sprung) && !pound) {
      input.jumpPressed = true;
      jumps = 2;
    } else if (dash && jumps === 2 && !dashed && pc.velocity.y < -1) {
      input.dashPressed = true;
      dashed = true;
    }
    step(sim, input);
  }
  return { ok: false, why: `timeout at ${pc.position.toArray().map((n) => n.toFixed(1))}` };
}

const wait = (sim, seconds) => {
  for (let k = 0; k < seconds * 60; k++) step(sim, {});
};

describe('tutorial playthrough (real Pip physics)', () => {
  it('reaches the beacon using every lesson', () => {
    const sim = makeSim();
    wait(sim, 0.5);
    const legs = [
      ['nest far side', point('nest', 0, -6)],
      ['hop1', point('hop1')],
      ['hop2', point('hop2')],
      ['terrace', point('terrace', 0, -2)],
      ['upper (double jump)', point('upper', 0, 0)],
      ['dashland (dash)', point('dashland', 0, 1), { dash: true }],
      ['rune (pound)', { x: rune.top[0], y: rune.top[1], z: rune.top[2], r: 0.6 }, { pound: true }],
    ];
    for (const [name, tgt, opts] of legs) expect(runLeg(sim, tgt, opts), name).toEqual({ ok: true });
    expect(sim.events.some((e) => e.type === 'switch' && e.id === 'rune')).toBe(true);
    wait(sim, 2);
    const rest = [
      ['bridge1', slab('bridge1')],
      ['bridge2', slab('bridge2')],
      ['bridge3', slab('bridge3')],
      ['arena', point('arena', 0, 4)],
      ['springpad', point('springpad', 0, 2, 0.6)],
    ];
    for (const [name, tgt, opts] of rest) expect(runLeg(sim, tgt, opts), name).toEqual({ ok: true });
    // Standing on the bloom-cap launches Pip; steer to the summit.
    expect(runLeg(sim, point('summit', 0, 2), { spring: true }), 'summit').toEqual({ ok: true });

    for (const a of ['jump', 'doubleJump', 'dash', 'pound', 'spring']) expect(sim.actions, a).toContain(a);
    const tips = sim.events.filter((e) => e.type === 'tip').map((e) => e.id);
    expect(tips).toEqual(expect.arrayContaining(['move', 'jump', 'doubleJump', 'dash', 'pound', 'stomp', 'spring', 'beacon']));
    expect(sim.events.filter((e) => e.type === 'checkpoint').map((e) => e.index)).toEqual([1, 2]);
  });

  it('the terrace ledge is out of single-jump reach', () => {
    const rise = byId.upper.y - byId.terrace.y;
    expect(rise).toBeGreaterThan(12.6 ** 2 / (2 * 34)); // jumpSpeed^2 / 2g
  });

  it('the gap past the rune cannot be jumped before the bridge rises', () => {
    const sim = makeSim();
    const start = point('dashland', 0, -2);
    sim.pc.position.set(start.x, start.y + 0.05, start.z);
    wait(sim, 0.3);
    const r = runLeg(sim, point('arena', 0, 4), { dash: true });
    expect(r.ok).toBe(false);
  });

  it('needs enough shards to light the beacon, and has spares', () => {
    expect(tutorial.shardsRequired).toBeLessThan(tutorial.shards.length);
    expect(tutorial.shardsRequired).toBeGreaterThan(tutorial.shards.length / 2);
  });
});
