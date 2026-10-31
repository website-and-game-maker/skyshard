// World 3-1: Moonlit Drift. Night falls: ferries, phase slabs and a long updraft under the stars.
import { on, ring, line, above } from './helpers.js';

const islands = [
  { id: 'start', x: 0, y: 0, z: 0, radius: 7, depth: 8, theme: 'frost', trees: [[-4, 3], [4.5, 2.5]], rocks: [[2.5, -3.5]] },
  { id: 'floe', x: 16, y: 2, z: -20, radius: 4.5, depth: 6, theme: 'frost', trees: [[2, 2]] },
  { id: 'moonlet', x: 8.5, y: 4.5, z: -29.5, radius: 1.5, depth: 3, theme: 'starlit' },
  { id: 'glacier', x: 3, y: 5.5, z: -43, radius: 6, depth: 9, theme: 'starlit', trees: [[-3.5, 2]], rocks: [[3.8, 1]] },
  { id: 'observatory', x: 3, y: 16, z: -55, radius: 5, depth: 11, theme: 'frost', trees: [[3, -2]] },
  { id: 'dock', x: -8, y: 17, z: -67.5, radius: 2.2, depth: 3, theme: 'frost' },
  { id: 'comet', x: -13, y: 18, z: -64.5, radius: 1.6, depth: 3, theme: 'starlit' },
  { id: 'zenith', x: -8, y: 17.5, z: -86, radius: 6, depth: 10, theme: 'starlit', trees: [[3.5, 3.5], [-3.5, -3.5]] },
];

const movers = [
  { id: 'm1', size: [3, 0.6, 3], from: [0, 0.5, -10], to: [8, 0.5, -16], period: 6, phase: 0 },
  { id: 'm2', size: [3.2, 0.6, 3.2], from: [-8, 17, -72], to: [-8, 17, -78.5], period: 6, phase: 0 },
];

const blinkers = [
  { id: 'b1', top: [17, 3, -28], size: [2.8, 0.5, 2.8], period: 3, on: 0.6, phase: 0, color: 0x8ab4ff },
  { id: 'b2', top: [13, 4, -32], size: [2.8, 0.5, 2.8], period: 3, on: 0.6, phase: 0.8, color: 0x8ab4ff },
  { id: 'b3', top: [9, 5, -36], size: [2.8, 0.5, 2.8], period: 3, on: 0.6, phase: 1.6, color: 0x8ab4ff },
];

const crumblers = [
  { id: 'cA', top: [-4, 16.5, -59], size: [2.6, 0.5, 2.6] },
  { id: 'cB', top: [-8, 17, -63], size: [2.6, 0.5, 2.6] },
];

const updrafts = [{ id: 'u1', at: [3, 5.5, -46.5], radius: 1.8, height: 12, lift: 14, color: 0xb8a6ff }];

const shards = [
  ...ring(islands, 'start', 3.5, 5, 0.3),
  ...line([1.5, 1.9, -11], [7, 1.9, -15.5], 3),
  ...ring(islands, 'floe', 2.2, 3, 0.4),
  ...blinkers.map((b) => above(b.top)),
  ...ring(islands, 'glacier', 3.5, 4, 0.3),
  ...line([3, 9, -46.5], [3, 15, -46.5], 3),
  ...ring(islands, 'observatory', 2.8, 4, 0.9),
  above(crumblers[0].top), above(crumblers[1].top),
  ...line([-8, 18, -72], [-8, 18, -78.5], 3),
  on(islands, 'dock'),
  ...ring(islands, 'zenith', 4, 5, 0.6),
];

export default {
  id: 'moonlit-drift',
  name: 'Moonlit Drift',
  subtitle: 'The stars come out to watch',
  world: 'starfall',
  env: 'starfall',
  parMs: 130000,
  islands,
  movers,
  blinkers,
  crumblers,
  updrafts,
  spawn: { x: 0, y: 0, z: 4 },
  checkpoints: [
    { id: 'cp1', island: 'floe', dx: 1.5, dz: 2.2 },
    { id: 'cp2', island: 'glacier', dx: 3, dz: 3 },
    { id: 'cp3', island: 'observatory', dx: -2, dz: 2.5 },
  ],
  beacon: { island: 'zenith', dx: 0, dz: 0 },
  shards,
  shardsRequired: 30,
  sunstones: [
    on(islands, 'moonlet', 0, 0, 1.1),
    [3, 19.2, -46.5], // top of the updraft
    on(islands, 'comet', 0, 0, 1.1),
  ],
  hearts: [{ island: 'glacier', dx: -3.5, dz: -2 }, { island: 'zenith', dx: -3, dz: 3 }],
  enemySpawns: [
    { kind: 'spikeling', island: 'floe', a: [-2, -1.5], b: [2, -1.5], leash: 3 },
    { kind: 'gloomwisp', island: 'glacier', at: [9, 5], hover: 3 },
    { kind: 'mossback', island: 'glacier', a: [-3, -3], b: [3, -3], leash: 4.5 },
    { kind: 'puffcap', island: 'observatory', at: [-2.5, -2.5] },
    { kind: 'spikeling', island: 'zenith', a: [-3, -2], b: [3, -2], leash: 4 },
    { kind: 'gloomwisp', island: 'zenith', at: [4, -4], hover: 3 },
  ],
  killY: -25,
  route: [
    { island: 'start', dx: 0, dz: -5.9, r: 0.3 }, { mover: 'm1', lead: 0.95 }, { island: 'floe', dx: -2.5, dz: 1.5 }, { island: 'floe', dx: 1, dz: -3.6 },
    { blinker: 'b1' }, { blinker: 'b2' }, { blinker: 'b3' }, { island: 'glacier', dx: 2, dz: 4 }, { updraft: 'u1' },
    { island: 'observatory', dx: 0, dz: 1, r: 1.8 }, { island: 'observatory', dx: -3.3, dz: -2.3 },
    { crumbler: 'cA' }, { crumbler: 'cB' }, { island: 'dock', dx: 0, dz: -1.1, r: 0.5 }, { mover: 'm2' }, { island: 'zenith', dx: 0, dz: 4 },
  ],
};
