// Boss arenas share one shape: a landing island, two stepping stones and a wide arena.
// The beacon is sunk in the middle of the arena and rises when the boss is beaten.
import { on, ring } from './helpers.js';

export function makeArena({ id, name, subtitle, world, env, theme, edgeTheme = theme, boss, decor = {}, extraHazards = [] }) {
  const islands = [
    { id: 'start', x: 0, y: 0, z: 0, radius: 6, depth: 7, theme: edgeTheme, trees: decor.startTrees ?? [[-3.5, 2]], rocks: [[3, 2.5]] },
    { id: 'step1', x: 0, y: 0.6, z: -10, radius: 2.4, depth: 3, theme: edgeTheme },
    { id: 'step2', x: 0, y: 1.2, z: -15.5, radius: 2.4, depth: 3, theme: edgeTheme },
    { id: 'arena', x: 0, y: 1.5, z: -32, radius: 14, depth: 12, theme,
      rocks: [[-12, -4], [12, 3], [-5, -12], [6, -12], [11, -8], [-11, 6]] },
    { id: 'perchL', x: -16.5, y: 3, z: -37, radius: 1.5, depth: 3, theme: edgeTheme },
    { id: 'perchR', x: 16.5, y: 3, z: -27, radius: 1.5, depth: 3, theme: edgeTheme },
  ];
  return {
    id,
    name,
    subtitle,
    world,
    env,
    boss: { island: 'arena', arenaRadius: 11, hp: 3, ...boss },
    parMs: 150000,
    islands,
    hazards: extraHazards,
    spawn: { x: 0, y: 0, z: 3 },
    checkpoints: [{ id: 'cp1', island: 'step2', dx: 1.4, dz: 0.8 }],
    beacon: { island: 'arena', dx: 0, dz: 0 },
    shards: [
      ...ring(islands, 'start', 3, 4, 0.4),
      on(islands, 'step1'), on(islands, 'step2'),
      ...ring(islands, 'arena', 8, 10, 0.2),
    ],
    shardsRequired: 0,
    sunstones: [
      on(islands, 'step2', 0, 0, 3.4), // a double jump above the last stepping stone
      on(islands, 'perchL', 0, 0, 1.1),
      on(islands, 'perchR', 0, 0, 1.1),
    ],
    hearts: [{ island: 'arena', dx: -7, dz: 5 }, { island: 'arena', dx: 7, dz: 5 }],
    enemySpawns: [],
    killY: -25,
    route: ['step1', 'step2', { island: 'arena', dx: 0, dz: 9 }],
  };
}
