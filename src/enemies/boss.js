// Boss brains. One state machine, three temperaments:
//   bramble  – Bramblebrute charges in straight lines and gets dizzy when it rams the arena rim.
//   cinder   – Cinderhorn leaps at Pip and slams, sending fire rings across the floor (jump them).
//              After three slams it is winded and can be stomped.
//   gloam    – The Gloamking circles overhead firing orbs, then dives; it is stunned after landing.
// Every boss takes `hp` stomps (or ground pounds) and only while it is dizzy. Each hit makes it faster.
import * as THREE from 'three';

export const BOSS = {
  radius: 1.5, // body radius for contact
  introTime: 1.6,
  dizzyTime: 2.6,
  hurtTime: 1.1,
  bramble: { stalkSpeed: 2.6, stalkTime: 1.6, windup: 0.9, chargeSpeed: 13 },
  cinder: { stalkSpeed: 2.2, stalkTime: 1.2, windup: 0.7, leapTime: 1.0, leapHeight: 6, slamsPerDizzy: 3, waveSpeed: 8.5, waveWidth: 0.7 },
  gloam: { flyHeight: 6.5, orbitSpeed: 0.9, orbitTime: 5, shotEvery: 1.25, shotSpeed: 8, diveTime: 0.9, riseTime: 1.2 },
};

const tmp = new THREE.Vector3();

export function createBoss({ type = 'bramble', name = 'Boss', home, arenaRadius = 10, hp = 3 }) {
  return {
    kind: 'boss',
    type,
    name,
    home: home.clone(),
    arenaRadius,
    hp,
    maxHp: hp,
    pos: home.clone().add(new THREE.Vector3(0, type === 'gloam' ? BOSS.gloam.flyHeight : 0, -arenaRadius * 0.4)),
    yaw: 0,
    mode: 'intro',
    timer: 0,
    clock: 0,
    dir: new THREE.Vector3(0, 0, 1),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    slams: 0,
    shotTimer: 0,
    waves: [], // { r, alive } expanding fire rings centred on `center`
    center: new THREE.Vector3(),
    active: false, // wakes when Pip enters the arena
    alive: true,
  };
}

// Faster with every hit: 1, 1.2, 1.4 ...
const rage = (e) => 1 + (e.maxHp - e.hp) * 0.2;

export const bossVulnerable = (e) => e.mode === 'dizzy';

const set = (e, mode) => {
  e.mode = mode;
  e.timer = 0;
};

function face(e, x, z) {
  e.yaw = Math.atan2(x - e.pos.x, z - e.pos.z);
}

function towardPlayer(e, player, speed, dt) {
  if (!player) return;
  tmp.set(player.position.x - e.pos.x, 0, player.position.z - e.pos.z);
  const d = tmp.length();
  face(e, player.position.x, player.position.z);
  if (d > 1.2) e.pos.addScaledVector(tmp, Math.min(d - 1.2, speed * dt) / d);
}

function clampToArena(e, margin = 0) {
  tmp.set(e.pos.x - e.home.x, 0, e.pos.z - e.home.z);
  const d = tmp.length();
  const max = e.arenaRadius - margin;
  if (d <= max) return false;
  tmp.multiplyScalar(max / d);
  e.pos.x = e.home.x + tmp.x;
  e.pos.z = e.home.z + tmp.z;
  return true;
}

const inArena = (e, player) =>
  !!player &&
  Math.hypot(player.position.x - e.home.x, player.position.z - e.home.z) < e.arenaRadius + 1 &&
  Math.abs(player.position.y - e.home.y) < 4;

// Returns a projectile to spawn (gloam orbs) or null.
export function updateBoss(e, dt, player) {
  if (!e.alive) return null;
  e.timer += dt;
  e.clock += dt;
  const k = rage(e);
  let shot = null;

  // Fire rings expand outward from wherever the slam landed.
  for (const w of e.waves) {
    if (!w.alive) continue;
    w.r += BOSS.cinder.waveSpeed * k * dt;
    if (w.r > e.arenaRadius + 1) w.alive = false;
  }
  e.waves = e.waves.filter((w) => w.alive);

  if (!e.active) {
    if (inArena(e, player)) {
      e.active = true;
      set(e, 'intro');
    } else {
      e.pos.y = e.home.y + (e.type === 'gloam' ? BOSS.gloam.flyHeight + Math.sin(e.clock) * 0.3 : 0);
      return null;
    }
  }

  switch (e.mode) {
    case 'intro':
      if (player) face(e, player.position.x, player.position.z);
      if (e.timer >= BOSS.introTime) set(e, e.type === 'gloam' ? 'orbit' : 'stalk');
      break;

    case 'stalk': {
      const c = BOSS[e.type];
      towardPlayer(e, player, c.stalkSpeed * k, dt);
      clampToArena(e, 1);
      if (e.timer >= c.stalkTime / k) set(e, 'windup');
      break;
    }

    case 'windup':
      if (player) face(e, player.position.x, player.position.z);
      if (e.timer >= BOSS[e.type].windup / k) {
        if (e.type === 'bramble') {
          e.dir.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
          set(e, 'charge');
        } else {
          // Cinderhorn leaps to where Pip is standing (kept inside the arena).
          e.from.copy(e.pos);
          e.to.copy(player ? player.position : e.home).setY(e.home.y);
          tmp.subVectors(e.to, e.home).setY(0);
          if (tmp.length() > e.arenaRadius - 1.5) tmp.setLength(e.arenaRadius - 1.5);
          e.to.copy(e.home).add(tmp);
          set(e, 'leap');
        }
      }
      break;

    case 'charge':
      e.pos.addScaledVector(e.dir, BOSS.bramble.chargeSpeed * k * dt);
      if (clampToArena(e, 1)) set(e, 'dizzy'); // rammed the rim
      break;

    case 'leap': {
      const c = BOSS.cinder;
      const u = Math.min(1, e.timer / c.leapTime);
      e.pos.lerpVectors(e.from, e.to, u);
      e.pos.y = e.home.y + Math.sin(u * Math.PI) * c.leapHeight;
      if (u >= 1) {
        e.pos.y = e.home.y;
        e.center.copy(e.pos);
        e.waves.push({ r: 0.5, alive: true });
        e.slams += 1;
        if (e.slams >= c.slamsPerDizzy) {
          e.slams = 0;
          set(e, 'dizzy');
        } else {
          set(e, 'stalk');
        }
        return { slam: true, position: e.pos.clone() };
      }
      break;
    }

    case 'orbit': {
      const c = BOSS.gloam;
      const a = e.clock * c.orbitSpeed * k;
      const r = e.arenaRadius * 0.75;
      e.pos.set(e.home.x + Math.cos(a) * r, e.home.y + c.flyHeight + Math.sin(e.clock * 2) * 0.4, e.home.z + Math.sin(a) * r);
      if (player) face(e, player.position.x, player.position.z);
      e.shotTimer += dt;
      if (player && e.shotTimer >= c.shotEvery / k) {
        e.shotTimer = 0;
        const origin = e.pos.clone().setY(e.pos.y - 0.6);
        const aim = player.position.clone().setY(player.position.y + 0.6);
        const vel = aim.sub(origin).normalize().multiplyScalar(c.shotSpeed);
        shot = { pos: origin, vel, life: 4, alive: true };
      }
      if (e.timer >= c.orbitTime) {
        e.from.copy(e.pos);
        e.to.copy(player ? player.position : e.home).setY(e.home.y);
        tmp.subVectors(e.to, e.home).setY(0);
        if (tmp.length() > e.arenaRadius - 2) tmp.setLength(e.arenaRadius - 2);
        e.to.copy(e.home).add(tmp);
        set(e, 'dive');
      }
      break;
    }

    case 'dive': {
      const u = Math.min(1, e.timer / BOSS.gloam.diveTime);
      e.pos.lerpVectors(e.from, e.to, u * u);
      if (u >= 1) {
        e.pos.y = e.home.y;
        if (e.hp < e.maxHp) {
          // Once hurt it lands hard enough to send a ring of shadow fire.
          e.center.copy(e.pos);
          e.waves.push({ r: 0.5, alive: true });
        }
        set(e, 'dizzy');
        return { slam: true, position: e.pos.clone() };
      }
      break;
    }

    case 'dizzy':
      if (e.timer >= BOSS.dizzyTime) set(e, e.type === 'gloam' ? 'rise' : 'stalk');
      break;

    case 'hurt':
      // Hop back toward the middle, briefly untouchable.
      tmp.subVectors(e.home, e.pos).setY(0);
      e.pos.addScaledVector(tmp, Math.min(1, dt * 2));
      e.pos.y = e.home.y + Math.sin(Math.min(1, e.timer / BOSS.hurtTime) * Math.PI) * 2;
      if (e.timer >= BOSS.hurtTime) {
        e.pos.y = e.home.y;
        if (e.type === 'gloam') {
          e.from.copy(e.pos);
          set(e, 'rise');
        } else set(e, 'stalk');
      }
      break;

    case 'rise': {
      const u = Math.min(1, e.timer / BOSS.gloam.riseTime);
      e.pos.y = e.home.y + u * BOSS.gloam.flyHeight;
      if (u >= 1) {
        set(e, 'orbit');
        e.clock = Math.atan2(e.pos.z - e.home.z, e.pos.x - e.home.x) / (BOSS.gloam.orbitSpeed * k);
      }
      break;
    }

    default:
      break;
  }
  if (e.type !== 'gloam' && e.mode !== 'leap' && e.mode !== 'hurt') e.pos.y = e.home.y;
  return shot;
}

// Called when Pip stomps the boss. Returns 'hit', 'defeated' or null (not vulnerable).
export function hitBoss(e) {
  if (!bossVulnerable(e)) return null;
  e.hp -= 1;
  e.waves = [];
  if (e.hp <= 0) {
    e.alive = false;
    return 'defeated';
  }
  set(e, 'hurt');
  return 'hit';
}

export const bossBody = (e, out = new THREE.Vector3()) => out.copy(e.pos).setY(e.pos.y + 1.2);

// Does a fire ring touch Pip? Only while Pip is near the floor: jumping clears it.
export function waveHits(e, player) {
  if (!player || !e.waves.length) return null;
  const p = player.position;
  if (p.y > e.home.y + 0.7) return null;
  const d = Math.hypot(p.x - e.center.x, p.z - e.center.z);
  for (const w of e.waves) {
    if (Math.abs(d - w.r) < BOSS.cinder.waveWidth) return e.center;
  }
  return null;
}
