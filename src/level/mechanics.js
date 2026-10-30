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
