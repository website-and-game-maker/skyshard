// Skyshard, level 1: "Driftmeadow". Pure data, no three.js objects, so it can be
// validated in unit tests. Island y values are the walkable top surface.
// The route runs from the meadow at the origin north (-z) and climbs to the beacon.

export const SHARD_HEIGHT = 0.9; // shards float this far above the surface they belong to

export const islands = [
  { id: 'meadow', x: 0, y: 0, z: 0, radius: 9, depth: 8, theme: 'meadow', waterfall: { angle: 2.4 },
    trees: [[-5, 3.5], [6, 4], [-6.5, -2], [5.5, -4.5]], rocks: [[3, 6], [-3, -6.5], [7.2, 0.5]] },
  { id: 'step1', x: 0, y: 0.6, z: -12, radius: 2.2, depth: 3, theme: 'meadow' },
  { id: 'step2', x: 3.5, y: 1.3, z: -16.5, radius: 2.2, depth: 3, theme: 'meadow' },
  { id: 'step3', x: 0.5, y: 2, z: -21.5, radius: 2.4, depth: 3, theme: 'meadow' },
  { id: 'hollow', x: 0, y: 2, z: -32, radius: 7, depth: 7, theme: 'meadow',
    trees: [[-4.5, -4.5], [4.8, -3.8]], rocks: [[-5.6, 1.8]] },
  { id: 'grove', x: 0, y: 2.5, z: -61, radius: 8, depth: 8, theme: 'meadow', waterfall: { angle: -0.6 },
    trees: [[5, -5], [-5.5, -2.5], [5.5, 3]], rocks: [[-2, 5.5], [6.5, -1]] },
  { id: 'bonus', x: 19.5, y: 5, z: -61, radius: 2.5, depth: 3.5, theme: 'crystal' },
  { id: 'ledge', x: -24, y: 6.5, z: -61, radius: 2, depth: 3, theme: 'meadow' },
  { id: 'heights', x: -31, y: 14, z: -73, radius: 7.5, depth: 9, theme: 'crystal', waterfall: { angle: 1.2 },
    trees: [[-5, -3], [3.5, -5]], rocks: [[-6, 2.5], [5.5, 1]] },
  { id: 'springrock', x: -19.5, y: 13, z: -80, radius: 3, depth: 4, theme: 'crystal' },
  { id: 'hopstone', x: -13.5, y: 16, z: -84, radius: 1.8, depth: 2.5, theme: 'crystal' },
  { id: 'spire', x: -6, y: 19, z: -89, radius: 6.5, depth: 10, theme: 'spire',
    trees: [[-1, 5]], rocks: [[3.8, 3.5]] },
  { id: 'beacon', x: 17, y: 19.5, z: -91, radius: 6.5, depth: 9, theme: 'beacon',
    trees: [[3.5, 4.2], [-3.2, -4.4]], rocks: [] },
];

export const islandById = Object.fromEntries(islands.map((i) => [i.id, i]));

// Moving platforms are given by the centre of their top face at both ends of a
// ping-pong path. They ease in and out with a cosine so riders aren't jerked.
export const movers = [
  { id: 'ferry', size: [3.2, 0.6, 3.2], from: [0, 2, -42.5], to: [0, 2, -51], period: 6, phase: 0 },
  { id: 'sideferry', size: [2.8, 0.6, 2.8], from: [10, 3.5, -61], to: [15, 3.5, -61], period: 5, phase: Math.PI / 2 },
  { id: 'lift', size: [3.2, 0.6, 3.2], from: [-29, 6.5, -63], to: [-29, 14, -63], period: 7, phase: 0 },
  { id: 'skyferry', size: [3.2, 0.6, 3.2], from: [2.5, 19, -90], to: [8.8, 19, -90], period: 5.5, phase: Math.PI },
];

// Crumbling slabs shake when stepped on, fall, then reform.
export const crumblers = [
  { id: 'crumble1', top: [-11.5, 3.5, -62], size: [2.6, 0.5, 2.6] },
  { id: 'crumble2', top: [-15.5, 4.5, -64.5], size: [2.6, 0.5, 2.6] },
  { id: 'crumble3', top: [-19.5, 5.5, -62.5], size: [2.6, 0.5, 2.6] },
];

// Bloom-cap mushrooms. `strength` is the launch speed in units/s (matches Pip's springSpeed).
export const bouncers = [{ id: 'spring', island: 'springrock', dx: 0, dz: 0, strength: 28 }];

// Thorn patches: solid, but touching them hurts.
export const hazards = [{ id: 'thorns', top: [-9.2, 19, -91.8], size: [2.4, 0.35, 1.6] }];

export const spawn = { x: 0, y: 0, z: 4.5 };

export const checkpoints = [
  { id: 'cp1', island: 'hollow', dx: 1.6, dz: 3.4 },
  { id: 'cp2', island: 'heights', dx: 1.5, dz: 5 },
  { id: 'cp3', island: 'spire', dx: -2.5, dz: 2.5 },
];

export const beacon = { island: 'beacon', dx: 0, dz: 0, radius: 2.2 };

function onIsland(id, dx, dz, lift = SHARD_HEIGHT) {
  const i = islandById[id];
  return [i.x + dx, i.y + lift, i.z + dz];
}

function ring(id, r, n, offset = 0, cz = 0) {
  return Array.from({ length: n }, (_, k) => {
    const a = offset + (k / n) * Math.PI * 2;
    return onIsland(id, Math.cos(a) * r, cz + Math.sin(a) * r);
  });
}

export const shards = [
  // Meadow: a welcome ring and the stepping stones.
  ...ring('meadow', 4, 6, 0.3, -1),
  onIsland('step1', 0, 0), onIsland('step2', 0, 0), onIsland('step3', 0, 0),
  // Hollow, guarded by the first Mossback.
  onIsland('hollow', -3, -1), onIsland('hollow', 0, -1), onIsland('hollow', 3, -1),
  onIsland('hollow', -4.6, -3), onIsland('hollow', 4.4, -2),
  // Over the ferry's route.
  [0, 3.2, -44], [0, 3.2, -47], [0, 3.2, -50],
  // Grove.
  onIsland('grove', -3, 2), onIsland('grove', 3, 2), onIsland('grove', 0, -3),
  onIsland('grove', -5, -5), onIsland('grove', 5.5, -1.5),
  // Side ferry and the bonus islet (worth the detour).
  [11, 4.7, -61], [14, 4.7, -61],
  onIsland('bonus', -1, 0), onIsland('bonus', 1, 0), onIsland('bonus', 0, 0, 2.6),
  // Crumbling stairs.
  [-11.5, 4.4, -62], [-15.5, 5.4, -64.5], [-19.5, 6.4, -62.5], onIsland('ledge', 0, 0),
  // Riding the lift.
  [-29, 9, -63], [-29, 11.5, -63], [-29, 14, -63.6],
  // Crystal Heights.
  ...ring('heights', 3.2, 6, 0.5),
  // Spring rock and the arc to the spire.
  onIsland('springrock', 0, 0, 3.2), [-15.5, 22, -83], [-11.5, 23, -85.5], onIsland('hopstone', 0, 0),
  // Spire.
  onIsland('spire', -2.5, 1), onIsland('spire', 2.5, 1), onIsland('spire', 0, -3.5), onIsland('spire', -4, -1.2),
  // Sky ferry.
  [4.5, 20.2, -90], [7.5, 20.2, -90],
  // Beacon island.
  ...ring('beacon', 4.3, 4, Math.PI / 4),
];

export const SHARDS_REQUIRED = 40;

// Enemy placements. Mossbacks walk between a and b and never stray beyond `leash`
// from home, which is chosen to keep them on their island.
export const enemySpawns = [
  { kind: 'mossback', island: 'hollow', a: [-4, -1.5], b: [4, -1.5], leash: 5 },
  { kind: 'mossback', island: 'grove', a: [2, 4], b: [2, -5], leash: 6 },
  { kind: 'mossback', island: 'spire', a: [-3, -2], b: [3, -2], leash: 4.5 },
  { kind: 'puffcap', island: 'grove', at: [-4, -4] },
  { kind: 'puffcap', island: 'heights', at: [-4, -4.5] },
  { kind: 'puffcap', island: 'spire', at: [3.5, -2.5] },
  { kind: 'gloomwisp', island: 'heights', at: [-2, -3], hover: 2.6 },
  { kind: 'gloomwisp', island: 'heights', at: [4, 2], hover: 2.6 },
  { kind: 'gloomwisp', island: 'springrock', at: [6, -3], hover: 7 },
];

export const KILL_Y = -25;

// Health pickups, one per later section.
export const hearts = [
  { island: 'grove', dx: -6, dz: 3 },
  { island: 'heights', dx: 0, dz: -5.5 },
  { island: 'spire', dx: 3, dz: 3 },
];

export default {
  id: 'driftmeadow',
  name: 'Driftmeadow',
  world: 'meadow',
  subtitle: 'Where the sky first broke',
  env: 'meadow',
  islands, movers, crumblers, bouncers, hazards, spawn, checkpoints, beacon, shards,
  shardsRequired: SHARDS_REQUIRED, enemySpawns, hearts, killY: KILL_Y,
};
