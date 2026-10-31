// Pure gameplay rules for the level (no meshes), so they are easy to unit test.

const TAU = Math.PI * 2;

// Moving platform position and velocity at sim time t. The path is a ping-pong
// with cosine easing: s(t) = (1 - cos(wt + phase)) / 2, so speed is zero at the ends.
export function moverAt(def, t) {
  const w = TAU / def.period;
  const s = (1 - Math.cos(w * t + def.phase)) / 2;
  const ds = (w * Math.sin(w * t + def.phase)) / 2;
  const top = [0, 1, 2].map((i) => def.from[i] + (def.to[i] - def.from[i]) * s);
  const velocity = [0, 1, 2].map((i) => (def.to[i] - def.from[i]) * ds);
  return { top, velocity };
}

// Is the player standing on top of a box? Feet within the footprint (allowing the
// player's half width to hang over) and close to the top face.
export function isStandingOn(player, box, tolerance = 0.15) {
  const p = player.position;
  const hw = (player.halfWidth ?? 0.35) * 0.8;
  return (
    p.x >= box.min.x - hw && p.x <= box.max.x + hw &&
    p.z >= box.min.z - hw && p.z <= box.max.z + hw &&
    Math.abs(p.y - box.max.y) <= tolerance
  );
}

// Crumbling slab lifecycle: solid -> shaking -> falling -> gone -> reforming -> solid.
export const CRUMBLE_TIMES = { shaking: 0.65, falling: 1.1, gone: 1.8, reforming: 0.6 };
const NEXT = { shaking: 'falling', falling: 'gone', gone: 'reforming', reforming: 'solid' };

export function createCrumbleState() {
  return { phase: 'solid', timer: 0 };
}

// Advance one crumbler. Returns true while the slab should be solid (has a collider).
export function stepCrumble(state, dt, playerOnTop) {
  if (state.phase === 'solid') {
    if (playerOnTop) {
      state.phase = 'shaking';
      state.timer = 0;
    }
    return true;
  }
  state.timer += dt;
  while (state.phase !== 'solid' && state.timer >= CRUMBLE_TIMES[state.phase]) {
    state.timer -= CRUMBLE_TIMES[state.phase];
    state.phase = NEXT[state.phase];
    if (state.phase === 'solid') state.timer = 0;
  }
  return state.phase === 'solid' || state.phase === 'shaking';
}

// Pickup test against the player's body centre.
export function touchesPickup(player, pos, radius = 0.9) {
  const p = player.position;
  const cy = p.y + (player.height ?? 1.1) / 2;
  const dx = p.x - pos[0], dy = cy - pos[1], dz = p.z - pos[2];
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

// Horizontal trigger zone (checkpoints, beacon).
export function inZone(player, center, radius, height = 3) {
  const p = player.position;
  const dx = p.x - center[0], dz = p.z - center[2];
  return dx * dx + dz * dz <= radius * radius && p.y >= center[1] - 0.5 && p.y <= center[1] + height;
}

// Phase slab timing. Each cycle is `period` seconds: solid for the first `on` fraction,
// gone for the rest. `warn` is true in the last 0.6 s before it vanishes so it can flicker.
export function blinkerAt(def, t) {
  const period = def.period ?? 3;
  const on = (def.on ?? 0.6) * period;
  const u = (((t + (def.phase ?? 0)) % period) + period) % period;
  return { solid: u < on, warn: u < on && u > on - 0.6, u };
}

// Sweeper arm angle at time t (radians around +y).
export function sweeperAngle(def, t) {
  return (def.phase ?? 0) + (def.speed ?? 1.2) * t;
}

// Does Pip touch any arm of a sweeper? Arms are horizontal segments from the hub at
// height center.y + height, with a hit radius of `thickness` (default 0.55).
export function sweeperHits(def, t, player) {
  const [cx, cy, cz] = def.center;
  const armY = cy + (def.height ?? 1.2);
  const p = player.position;
  const h = player.height ?? 1.1;
  const r = def.thickness ?? 0.55;
  if (armY < p.y - r || armY > p.y + h + r) return false;
  const arms = def.arms ?? 1;
  const base = sweeperAngle(def, t);
  for (let k = 0; k < arms; k++) {
    // Same rotation convention as three.js rotation.y: local +x maps to (cos a, -sin a).
    const a = base + (k / arms) * Math.PI * 2;
    const ux = Math.cos(a), uz = -Math.sin(a);
    const rx = p.x - cx, rz = p.z - cz;
    const s = Math.max(0, Math.min(def.length, rx * ux + rz * uz));
    const dx = rx - ux * s, dz = rz - uz * s;
    if (dx * dx + dz * dz <= (r + (player.halfWidth ?? 0.35)) ** 2) return true;
  }
  return false;
}

// Is Pip inside an updraft column? `at` is the centre of the vent on the ground.
export function inUpdraft(def, player) {
  const p = player.position;
  const dx = p.x - def.at[0], dz = p.z - def.at[2];
  return dx * dx + dz * dz <= def.radius * def.radius && p.y >= def.at[1] - 0.3 && p.y <= def.at[1] + def.height;
}

// Vertical speed an updraft pushes toward: full lift low down, easing to a hover at the top.
export function updraftLift(def, y) {
  const k = Math.min(1, Math.max(0, (y - def.at[1]) / def.height));
  return (def.lift ?? 14) * (1 - k * k);
}
