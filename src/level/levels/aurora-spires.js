// World 3-2: Aurora Spires. Everything Pip has learned, stacked up toward the aurora.
import { on, ring, line, above } from './helpers.js';

const islands = [
  { id: 'start', x: 0, y: 0, z: 0, radius: 7, depth: 8, theme: 'starlit', trees: [[-4, 2.5]], rocks: [[4, 3]] },
  { id: 's1', x: 0, y: 1, z: -11.5, radius: 2.4, depth: 4, theme: 'frost' },
  { id: 'prism', x: 0, y: 11, z: -20, radius: 5, depth: 10, theme: 'frost' },
  { id: 'halo', x: -2, y: 14.5, z: -42, radius: 5.5, depth: 9, theme: 'starlit', trees: [[3.5, 2]] },
  { id: 'shardlet', x: 6, y: 15, z: -36, radius: 1.6, depth: 3, theme: 'frost' },
  { id: 'crown', x: -2, y: 25, z: -53, radius: 5, depth: 11, theme: 'frost', trees: [[-3, 2.5]] },
  { id: 'apex', x: 19, y: 26.5, z: -66, radius: 6, depth: 11, theme: 'starlit', trees: [[3.5, -3.5]] },
];

const updrafts = [
  { id: 'u1', at: [0, 1, -11.5], radius: 1.8, height: 11, lift: 13.5, color: 0xb8a6ff },
  { id: 'u2', at: [-2, 14.5, -45], radius: 1.8, height: 12, lift: 14, color: 0xb8a6ff },
];

const blinkers = [
  { id: 'b1', top: [-7, 12, -25], size: [2.8, 0.5, 2.8], period: 2.6, on: 0.55, phase: 0, color: 0x8ab4ff },
  { id: 'b2', top: [-11, 13, -29.5], size: [2.8, 0.5, 2.8], period: 2.6, on: 0.55, phase: 0.8, color: 0x8ab4ff },
  { id: 'b3', top: [-8, 14, -34.5], size: [2.8, 0.5, 2.8], period: 2.6, on: 0.55, phase: 1.6, color: 0x8ab4ff },
];

const movers = [{ id: 'm1', size: [3, 0.6, 3], from: [5, 25, -55], to: [12, 25, -61], period: 5.5, phase: 0 }];

const shards = [
  ...ring(islands, 'start', 3.5, 5, 0.6),
  on(islands, 's1', 0, 1.5),
  ...line([0, 4, -11.5], [0, 10, -11.5], 3),
  ...ring(islands, 'prism', 2.3, 4, 0.4, 1.9),
  ...blinkers.map((b) => above(b.top)),
  ...ring(islands, 'halo', 3.6, 4, 0.2),
  ...line([-2, 18, -45], [-2, 24, -45], 3),
  ...ring(islands, 'crown', 3, 3, 1.2),
  ...line([5, 26, -55], [12, 26, -61], 3),
  ...ring(islands, 'apex', 4, 5, 0.5),
];

export default {
  id: 'aurora-spires',
  name: 'Aurora Spires',
  subtitle: 'Climb into the light',
  world: 'starfall',
  env: 'starfall',
  parMs: 130000,
  islands,
  updrafts,
  blinkers,
  movers,
  bouncers: [{ id: 'spring', island: 'crown', dx: -3, dz: -2.5, strength: 26 }],
  sweepers: [
    { id: 'sw1', center: [0, 11, -20], length: 4, arms: 2, speed: 1.6, height: 0.7, color: 0x9ab8ff },
    { id: 'sw2', center: [19, 26.5, -66], length: 4.6, arms: 3, speed: -1.1, height: 0.7, color: 0x9ab8ff },
  ],
  spawn: { x: 0, y: 0, z: 4 },
  checkpoints: [
    { id: 'cp1', island: 'prism', dx: -2, dz: 3 },
    { id: 'cp2', island: 'halo', dx: 2.5, dz: 3 },
    { id: 'cp3', island: 'crown', dx: -2.5, dz: 2.5 },
  ],
  beacon: { island: 'apex', dx: 0, dz: -0.5 },
  shards,
  shardsRequired: 32,
  sunstones: [
    [0, 14.6, -11.5], // top of the first updraft
    on(islands, 'shardlet', 0, 0, 1.1),
    [-5, 34, -55.5], // launch off the crown mushroom
  ],
  hearts: [{ island: 'halo', dx: -3.5, dz: -2 }, { island: 'crown', dx: 0, dz: 3 }],
  enemySpawns: [
    { kind: 'gloomwisp', island: 'prism', at: [-5, -5], hover: 3 },
    { kind: 'spikeling', island: 'halo', a: [-3, -1], b: [3, -1], leash: 4 },
    { kind: 'puffcap', island: 'halo', at: [3.5, -3] },
    { kind: 'gloomwisp', island: 'crown', at: [6, -2], hover: 3 },
    { kind: 'spikeling', island: 'apex', a: [-4, 2.5], b: [-1, 4.5], leash: 4.8 },
  ],
  killY: -25,
  route: [
    { updraft: 'u1' }, { island: 'prism', dx: 0, dz: 1, r: 1.8 },
    { island: 'prism', dx: -3.8, dz: -1.5 }, { blinker: 'b1' }, { blinker: 'b2' }, { blinker: 'b3' },
    { island: 'halo', dx: -1, dz: 4 }, { updraft: 'u2' }, { island: 'crown', dx: 0, dz: 1, r: 1.8 },
    { island: 'crown', dx: 3.5, dz: 1.5 }, { mover: 'm1' }, { island: 'apex', dx: -3.5, dz: 3 }, { island: 'apex', dx: 0, dz: 3.2 },
  ],
};
