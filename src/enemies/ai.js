// Enemy brains as plain state machines (no meshes), so they can be unit tested.
import * as THREE from 'three';

export const MOSSBACK = { patrolSpeed: 1.8, sight: 7.5, alertTime: 0.55, chargeSpeed: 6.5, chargeTime: 1.3, recoverTime: 1.0, radius: 0.75 };
export const WISP = { sight: 9, windupTime: 0.75, swoopSpeed: 10, swoopTime: 1.5, returnSpeed: 3.5, restTime: 1.3, radius: 0.55 };
export const PUFFCAP = { range: 13, chargeTime: 0.6, cooldown: 2.4, projectileSpeed: 7, projectileLife: 4, radius: 0.7, projectileRadius: 0.32 };

const flat = new THREE.Vector3();

function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

const chestOf = (player, out) => out.copy(player.position).setY(player.position.y + (player.height ?? 1.1) * 0.55);

// ---- Mossback: a mossy beetle that patrols, spots Pip, paws the ground, then charges.

export function createMossback({ home, a, b, leash }) {
  return {
    kind: 'mossback',
    home: home.clone(),
    a: a.clone(),
    b: b.clone(),
    leash,
    pos: a.clone(),
    yaw: 0,
    dir: 1,
    mode: 'patrol',
    timer: 0,
    charge: new THREE.Vector3(),
    alive: true,
  };
}

export function mossbackCanSee(e, player) {
  if (!player) return false;
  const p = player.position;
  return (
    horizontalDistance(e.pos, p) < MOSSBACK.sight &&
    Math.abs(p.y - e.pos.y) < 1.6 &&
    horizontalDistance(e.home, p) < e.leash + 1.5
  );
}

function face(e, x, z) {
  e.yaw = Math.atan2(x - e.pos.x, z - e.pos.z);
}

function clampToLeash(e) {
  flat.set(e.pos.x - e.home.x, 0, e.pos.z - e.home.z);
  const d = flat.length();
  if (d <= e.leash) return false;
  flat.multiplyScalar(e.leash / d);
  e.pos.x = e.home.x + flat.x;
  e.pos.z = e.home.z + flat.z;
  return true;
}

export function updateMossback(e, dt, player) {
  if (!e.alive) return;
  e.timer += dt;
  switch (e.mode) {
    case 'patrol': {
      const goal = e.dir > 0 ? e.b : e.a;
      const dx = goal.x - e.pos.x, dz = goal.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      const step = MOSSBACK.patrolSpeed * dt;
      if (d <= step || d < 1e-4) {
        e.pos.x = goal.x;
        e.pos.z = goal.z;
        e.dir *= -1;
      } else {
        e.pos.x += (dx / d) * step;
        e.pos.z += (dz / d) * step;
        face(e, goal.x, goal.z);
      }
      if (mossbackCanSee(e, player)) {
        e.mode = 'alert';
        e.timer = 0;
      }
      break;
    }
    case 'alert':
      face(e, player?.position.x ?? e.pos.x, player?.position.z ?? e.pos.z + 1);
      if (e.timer >= MOSSBACK.alertTime) {
        e.mode = 'charge';
        e.timer = 0;
        e.charge.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      }
      break;
    case 'charge':
      e.pos.addScaledVector(e.charge, MOSSBACK.chargeSpeed * dt);
      if (clampToLeash(e) || e.timer >= MOSSBACK.chargeTime) {
        e.mode = 'recover';
        e.timer = 0;
      }
      break;
    case 'recover':
      if (e.timer >= MOSSBACK.recoverTime) {
        e.mode = 'patrol';
        e.timer = 0;
        // Head back towards whichever patrol end is further away.
        e.dir = e.pos.distanceToSquared(e.a) > e.pos.distanceToSquared(e.b) ? -1 : 1;
      }
      break;
    default:
      break;
  }
  e.pos.y = e.home.y;
}

export const mossbackBody = (e, out = new THREE.Vector3()) => out.copy(e.pos).setY(e.pos.y + 0.55);

// ---- Gloomwisp: a hovering shadow that winds up, then swoops at where Pip was.

export function createWisp({ home, phase = 0, orbit = 0, kind = 'gloomwisp' }) {
  return {
    kind,
    orbit,
    home: home.clone(),
    pos: home.clone(),
    yaw: 0,
    mode: 'hover',
    timer: 0,
    clock: phase,
    target: new THREE.Vector3(),
    dirV: new THREE.Vector3(),
    travelled: 0,
    reach: 0,
    alive: true,
  };
}

const tmp = new THREE.Vector3();

export function updateWisp(e, dt, player) {
  if (!e.alive) return;
  e.timer += dt;
  e.clock += dt;
  switch (e.mode) {
    case 'hover': {
      const t = e.clock;
      const r = e.orbit || 1.2;
      e.pos.set(e.home.x + Math.cos(t * 0.7) * r, e.home.y + Math.sin(t * 1.6) * 0.35, e.home.z + Math.sin(t * 0.7) * r);
      if (player && chestOf(player, tmp).distanceTo(e.pos) < WISP.sight) {
        e.mode = 'windup';
        e.timer = 0;
      }
      break;
    }
    case 'windup':
      if (player) {
        chestOf(player, e.target);
        e.yaw = Math.atan2(e.target.x - e.pos.x, e.target.z - e.pos.z);
      }
      // Rear back slightly while charging up.
      e.pos.y += dt * 0.6;
      if (e.timer >= WISP.windupTime) {
        e.mode = 'swoop';
        e.timer = 0;
        e.dirV.subVectors(e.target, e.pos);
        e.reach = e.dirV.length() + 2;
        e.dirV.normalize();
        e.travelled = 0;
      }
      break;
    case 'swoop': {
      const step = WISP.swoopSpeed * dt;
      e.pos.addScaledVector(e.dirV, step);
      e.travelled += step;
      if (e.travelled >= e.reach || e.timer >= WISP.swoopTime) {
        e.mode = 'return';
        e.timer = 0;
      }
      break;
    }
    case 'return': {
      tmp.subVectors(e.home, e.pos);
      const d = tmp.length();
      const step = WISP.returnSpeed * dt;
      if (d <= step) {
        e.pos.copy(e.home);
        e.mode = 'rest';
        e.timer = 0;
      } else {
        e.pos.addScaledVector(tmp, step / d);
        e.yaw = Math.atan2(tmp.x, tmp.z);
      }
      break;
    }
    case 'rest':
      if (e.timer >= WISP.restTime) {
        e.mode = 'hover';
        e.timer = 0;
        e.clock = Math.PI / 2 / 1.6; // continue the bob from the home point smoothly
      }
      break;
    default:
      break;
  }
}

export const wispBody = (e, out = new THREE.Vector3()) => out.copy(e.pos);

// ---- Puffcap: a rooted mushroom that inflates and spits slow spore balls.

export function createPuffcap({ home }) {
  return { kind: 'puffcap', home: home.clone(), pos: home.clone(), yaw: 0, mode: 'idle', timer: 0, cooldown: 1, alive: true };
}

export function puffcapInRange(e, player) {
  if (!player) return false;
  const p = player.position;
  return horizontalDistance(e.pos, p) < PUFFCAP.range && Math.abs(p.y - e.pos.y) < 6;
}

// Returns a projectile to spawn, or null.
export function updatePuffcap(e, dt, player) {
  if (!e.alive) return null;
  e.timer += dt;
  e.cooldown = Math.max(0, e.cooldown - dt);
  const sees = puffcapInRange(e, player);
  if (sees) e.yaw = Math.atan2(player.position.x - e.pos.x, player.position.z - e.pos.z);
  if (e.mode === 'idle') {
    if (sees && e.cooldown === 0) {
      e.mode = 'charging';
      e.timer = 0;
    }
    return null;
  }
  // charging
  if (e.timer < PUFFCAP.chargeTime) return null;
  e.mode = 'idle';
  e.timer = 0;
  e.cooldown = PUFFCAP.cooldown;
  if (!sees) return null;
  const origin = e.pos.clone().setY(e.pos.y + 1.45);
  origin.x += Math.sin(e.yaw) * 0.6;
  origin.z += Math.cos(e.yaw) * 0.6;
  const vel = chestOf(player, new THREE.Vector3()).sub(origin).normalize().multiplyScalar(PUFFCAP.projectileSpeed);
  return { pos: origin, vel, life: PUFFCAP.projectileLife, alive: true };
}

export const puffcapBody = (e, out = new THREE.Vector3()) => out.copy(e.pos).setY(e.pos.y + 0.8);

// Projectiles fly straight and pop on terrain or when they time out.
export function updateProjectile(p, dt, colliders = []) {
  if (!p.alive) return;
  p.pos.addScaledVector(p.vel, dt);
  p.life -= dt;
  if (p.life <= 0) p.alive = false;
  for (const c of colliders) {
    if (c.box.containsPoint(p.pos)) {
      p.alive = false;
      break;
    }
  }
}
