// Test helper: drives Pip's real movement code along a level's `route` so unit tests can
// prove every level is finishable. Not imported by the game.
import * as THREE from 'three';
import { groundHeightAt } from '../colliders.js';
import { moverAt, blinkerAt } from '../mechanics.js';

const DT = 1 / 60;

// Turn one route entry into { target(t) -> {x,y,z,r}, wait?(t), after?(t), updraft?, spring? }.
export function legFromRoute(def, entry) {
  const islandById = Object.fromEntries((def.islands ?? []).map((i) => [i.id, i]));
  const find = (list, id, what) => {
    const v = (def[list] ?? []).find((m) => m.id === id);
    if (!v) throw new Error(`${def.id}: route names unknown ${what} "${id}"`);
    return v;
  };
  if (typeof entry === 'string') entry = { island: entry };
  if (entry.island) {
    const i = islandById[entry.island];
    if (!i) throw new Error(`${def.id}: route names unknown island "${entry.island}"`);
    const r = entry.dx !== undefined || entry.dz !== undefined ? (entry.r ?? 0.8) : i.radius * (entry.frac ?? 0.8);
    return { name: entry.island, target: () => ({ x: i.x + (entry.dx ?? 0), y: i.y, z: i.z + (entry.dz ?? 0), r }), spring: entry.spring };
  }
  if (entry.mover) {
    const m = find('movers', entry.mover, 'mover');
    const near = (end, lead, tol = 0.6) => (t) => {
      const { top } = moverAt(m, t + lead);
      const e = end === 'from' ? m.from : m.to;
      return Math.hypot(top[0] - e[0], top[1] - e[1], top[2] - e[2]) < tol;
    };
    return {
      name: entry.mover,
      target: (t) => {
        const { top } = moverAt(m, t);
        return { x: top[0], y: top[1], z: top[2], r: Math.min(m.size[0], m.size[2]) / 2 - 0.2 };
      },
      wait: near(entry.board ?? 'from', entry.lead ?? 0.45),
      after: near(entry.board === 'to' ? 'from' : 'to', 0.3),
      riding: true,
    };
  }
  if (entry.crumbler) {
    const c = find('crumblers', entry.crumbler, 'crumbler');
    return { name: entry.crumbler, target: () => ({ x: c.top[0], y: c.top[1], z: c.top[2], r: Math.min(c.size[0], c.size[2]) / 2 - 0.2 }) };
  }
  if (entry.blinker) {
    const b = find('blinkers', entry.blinker, 'blinker');
    return {
      name: entry.blinker,
      target: () => ({ x: b.top[0], y: b.top[1], z: b.top[2], r: Math.min(b.size[0], b.size[2]) / 2 - 0.2 }),
      // Leave when the slab has just come back, so there's a full "on" window to land.
      wait: (t) => blinkerAt(b, t + 0.6).u < 0.3,
    };
  }
  if (entry.updraft) {
    const u = find('updrafts', entry.updraft, 'updraft');
    return { name: entry.updraft, target: () => ({ x: u.at[0], y: u.at[1], z: u.at[2], r: 0.6 }), updraft: u };
  }
  throw new Error(`${def.id}: bad route entry ${JSON.stringify(entry)}`);
}

export function createSim(level, PlayerController) {
  const pc = new PlayerController({ world: level, spawn: level.spawn.clone() });
  return { pc, level, t: 0, yaw: 0, events: [], track: [] };
}

function stepSim(sim, input) {
  const { pc, level } = sim;
  pc.update(DT, input, sim.yaw);
  // Pass the controller itself so updrafts can push its velocity.
  sim.events.push(...level.update(DT, pc, sim.t));
  sim.t += DT;
  input.jumpPressed = false;
  const p = pc.position;
  if (Math.round(sim.t / DT) % 6 === 0) sim.track.push(`${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} g${+pc.grounded}`);
}

export function runLeg(sim, leg) {
  const { pc, level } = sim;
  const input = { moveX: 0, moveY: 0, jump: false, jumpPressed: false };
  if (leg.wait) {
    for (let k = 0; k < 60 * 14 && !leg.wait(sim.t); k++) stepSim(sim, input);
  }
  let jumps = 0;
  let sprung = false;
  let reachedVent = false;
  for (let k = 0; k < 60 * 10; k++) {
    const tgt = leg.target(sim.t);
    const p = pc.position;
    const dx = tgt.x - p.x, dz = tgt.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (p.y < level.killY) return { ok: false, why: `fell; track ${sim.track.slice(-30, -8).join(' | ')}` };

    if (leg.updraft) {
      const u = leg.updraft;
      if (dist < 0.9) reachedVent = true;
      if (reachedVent && p.y > u.at[1] + u.height - 2.5) return { ok: true };
      sim.yaw = Math.atan2(dx, dz) + Math.PI;
      input.moveY = dist > 0.3 ? 1 : 0;
      input.jump = false;
      if (pc.grounded && !reachedVent) {
        const ahead = new THREE.Vector3(dx, 0, dz).normalize();
        const probe = p.clone().addScaledVector(ahead, 0.75);
        if (groundHeightAt(level.colliders, probe.x, probe.z, p.y + 0.3) < p.y - 0.4 && dist > 0.9) {
          input.jump = true;
          input.jumpPressed = true;
        }
      }
      stepSim(sim, input);
      continue;
    }

    const onTarget = pc.grounded && dist <= tgt.r && Math.abs(p.y - tgt.y) < 0.25;
    if (onTarget) {
      if (leg.after) {
        input.moveY = 0;
        for (let w = 0; w < 60 * 14 && !leg.after(sim.t); w++) {
          // Keep centred on a moving platform while riding it.
          const tt = leg.target(sim.t);
          const ddx = tt.x - pc.position.x, ddz = tt.z - pc.position.z;
          sim.yaw = Math.atan2(ddx, ddz) + Math.PI;
          input.moveY = Math.hypot(ddx, ddz) > 0.4 ? 0.6 : 0;
          stepSim(sim, input);
          if (pc.position.y < level.killY) return { ok: false, why: `fell off while riding; track ${sim.track.slice(-40, -10).join(' | ')}` };
        }
      }
      return { ok: true };
    }

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
    stepSim(sim, input);
  }
  return { ok: false, why: `timeout at ${pc.position.toArray().map((n) => n.toFixed(1))}` };
}

// Walk the whole route, then into the beacon. Returns { ok, why?, leg?, sim }.
export function playRoute(level, PlayerController, { beforeGoal } = {}) {
  const def = level.def;
  const sim = createSim(level, PlayerController);
  const settle = { target: () => ({ ...level.spawn, r: 0.3 }) };
  for (let k = 0; k < 30; k++) runLeg(sim, settle);
  for (const entry of def.route ?? []) {
    const leg = legFromRoute(def, entry);
    const result = runLeg(sim, leg);
    if (!result.ok) return { ...result, leg: leg.name, sim };
  }
  beforeGoal?.(sim);
  const b = level.beaconPosition;
  const toBeacon = { name: 'beacon', target: () => ({ x: b.x, y: b.y, z: b.z + 1.9, r: 0.4 }) };
  const result = runLeg(sim, toBeacon);
  if (!result.ok) return { ...result, leg: 'beacon', sim };
  return { ok: true, sim };
}
