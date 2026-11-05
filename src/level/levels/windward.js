// World 1-2: Windward Reach. Introduces updrafts: wind columns that carry Pip up cliffs.
import { on, ring, line, above } from './helpers.js';

const islands = [
  { id: 'start', x: 0, y: 0, z: 0, radius: 8, depth: 8, theme: 'meadow', waterfall: { angle: 2.2 },
    trees: [[-5, 3.5], [5.5, 4]], rocks: [[3, 6], [-6.5, -1]] },
  { id: 's1', x: 0, y: 0.8, z: -12, radius: 2.4, depth: 3, theme: 'meadow' },
  { id: 's2', x: 3, y: 1.6, z: -17, radius: 2.2, depth: 3, theme: 'meadow' },
  { id: 'glade', x: 0, y: 1.6, z: -27, radius: 6.5, depth: 7, theme: 'meadow', trees: [[-4, 1.5], [4.2, 2]], rocks: [[-4.5, -3]] },
  { id: 'perch', x: 0, y: 12, z: -40, radius: 5, depth: 10, theme: 'spire', trees: [[3.5, -2]] },
  { id: 'windmill', x: 0, y: 12.5, z: -64, radius: 5.5, depth: 8, theme: 'meadow', waterfall: { angle: 0.4 }, trees: [[-3.5, -3]] },
  { id: 'nook', x: 9, y: 13, z: -69, radius: 1.8, depth: 3, theme: 'crystal' },
  { id: 'gust', x: -20, y: 13, z: -71, radius: 4, depth: 5, theme: 'crystal', rocks: [[2.5, 1.5]] },
  { id: 'summit', x: -20, y: 24, z: -82, radius: 5.5, depth: 11, theme: 'crystal', trees: [[-3, -2.5]], rocks: [[3.5, 2]] },
  { id: 'crow', x: -27, y: 27, z: -88, radius: 1.6, depth: 3, theme: 'spire' },
  { id: 'beacon', x: 0, y: 24.5, z: -93, radius: 6.5, depth: 9, theme: 'beacon', trees: [[3.5, 4.2]] },
];

const movers = [
  { id: 'ferry', size: [3.2, 0.6, 3.2], from: [0, 12, -47], to: [0, 12, -56], period: 6, phase: 0 },
  { id: 'bridge', size: [3.2, 0.6, 3.2], from: [-12.5, 24, -85], to: [-7, 24, -88.5], period: 5.5, phase: 0 },
];

const crumblers = [
  { id: 'cA', top: [-8, 13, -66], size: [2.6, 0.5, 2.6] },
  { id: 'cB', top: [-12.5, 13.5, -68.5], size: [2.6, 0.5, 2.6] },
];

const updrafts = [
  { id: 'u1', at: [0, 1.6, -31], radius: 1.8, height: 13, lift: 14 },
  { id: 'u2', at: [-20, 13, -73], radius: 1.8, height: 14, lift: 15 },
];

const shards = [
  ...ring(islands, 'start', 4, 5, 0.4),
  on(islands, 's1'), on(islands, 's2'),
  ...ring(islands, 'glade', 3.5, 5, 1.2, 0.9),
  // Up the first updraft.
  ...line([0, 5, -31], [0, 11, -31], 3),
  ...line([0, 13, -36], [0, 13, -43], 3),
  ...line([0, 13.4, -49], [0, 13.4, -55], 3),
  ...ring(islands, 'windmill', 3.2, 4, 0.8),
  above(crumblers[0].top), above(crumblers[1].top),
  on(islands, 'gust', -2, 1),
  ...line([-20, 17, -73], [-20, 24, -73], 3),
  ...ring(islands, 'summit', 3, 4, 0.2),
  [-12.5, 25.2, -85], [-7, 25.2, -88.5],
  ...ring(islands, 'beacon', 4.3, 4, Math.PI / 4),
];

export default {
  id: 'windward',
  name: 'Windward Reach',
  subtitle: 'Ride the wind to the high meadows',
  world: 'meadow',
  env: 'meadow',
  parMs: 120000,
  islands,
  movers,
  crumblers,
  updrafts,
  bouncers: [],
  hazards: [{ id: 'thorns', top: [-3, 24.35, -85.5], size: [2, 0.35, 1.4] }],
  spawn: { x: 0, y: 0, z: 4.5 },
  checkpoints: [
    { id: 'cp1', island: 'perch', dx: 2.2, dz: 1.5 },
    { id: 'cp2', island: 'windmill', dx: 2.5, dz: 2.5 },
    { id: 'cp3', island: 'summit', dx: 2, dz: 2.5 },
  ],
  beacon: { island: 'beacon', dx: 0, dz: 0 },
  shards,
  shardsRequired: 30,
  sunstones: [
    [0, 17, -31], // top of the first updraft: double jump at the peak
    on(islands, 'nook', 0, 0, 1.1), // a long hop east of the windmill
    on(islands, 'crow', 0, 0, 1.1), // a tall climb off the summit
  ],
  hearts: [{ island: 'windmill', dx: -3, dz: 2.5 }, { island: 'summit', dx: -2, dz: 2 }],
  enemySpawns: [
    { kind: 'mossback', island: 'glade', a: [-3.5, -2], b: [3.5, -2], leash: 4.5 },
    { kind: 'gloomwisp', island: 'perch', at: [-3, -9], hover: 3 },
    { kind: 'puffcap', island: 'windmill', at: [-2.5, -3.5] },
    { kind: 'mossback', island: 'summit', a: [-3, -1], b: [3, -1], leash: 3.8 },
    { kind: 'puffcap', island: 'beacon', at: [3.5, -3.5] },
  ],
  killY: -25,
  route: [
    's1', 's2', { island: 'glade', dx: 0, dz: 2 }, { updraft: 'u1' }, { island: 'perch', dx: 0, dz: 1, r: 2 },
    { island: 'perch', dx: 0, dz: -3.6 }, { mover: 'ferry' }, { island: 'windmill', dx: 0, dz: 3.8 },
    { crumbler: 'cA' }, { crumbler: 'cB' }, { island: 'gust', dx: 1.5, dz: 1 }, { updraft: 'u2' },
    { island: 'summit', dx: 0, dz: 1, r: 2 }, { island: 'summit', dx: 3.6, dz: -2.3 }, { mover: 'bridge' },
    { island: 'beacon', dx: -3, dz: 3 },
  ],
};
