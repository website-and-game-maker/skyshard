// World 2-2: Kiln Spire. A vertical climb on hot-air vents past spinning sweepers.
import { on, ring, line, above } from './helpers.js';

const islands = [
  { id: 'base', x: 0, y: 0, z: 0, radius: 7, depth: 8, theme: 'ash', rocks: [[4, 3], [-4.5, 2]] },
  { id: 'ledge1', x: 0, y: 10, z: -12, radius: 4.5, depth: 8, theme: 'ember' },
  { id: 'flue', x: -6, y: 11, z: -16, radius: 1.6, depth: 3, theme: 'ember' },
  { id: 'gear', x: 9, y: 10.5, z: -18, radius: 5, depth: 8, theme: 'ash' },
  { id: 'terrace', x: 15, y: 13, z: -36, radius: 5.5, depth: 9, theme: 'ember', rocks: [[-3.5, 2.5]] },
  { id: 'chimney', x: 8, y: 24, z: -41, radius: 5, depth: 10, theme: 'ash' },
  { id: 'kiln', x: -7, y: 25.5, z: -58.5, radius: 6.5, depth: 11, theme: 'ember', rocks: [[-4.5, 2]] },
  { id: 'crest', x: -7, y: 26, z: -71, radius: 5.5, depth: 9, theme: 'ash' },
];

const vent = { color: 0xffa04a };
const updrafts = [
  { id: 'u1', at: [0, 0, -3], radius: 1.8, height: 12, lift: 14, ...vent },
  { id: 'u2', at: [15, 13, -38], radius: 1.8, height: 13, lift: 14.5, ...vent },
];

const blinkers = [
  { id: 'b1', top: [16, 11.5, -23], size: [2.8, 0.5, 2.8], period: 2.8, on: 0.6, phase: 0 },
  { id: 'b2', top: [19, 12.5, -28], size: [2.8, 0.5, 2.8], period: 2.8, on: 0.6, phase: 0.8 },
  { id: 'b3', top: [3, 27, -62], size: [2.8, 0.5, 2.8], period: 2.4, on: 0.45, phase: 0 },
];

const crumblers = [
  { id: 'cA', top: [1, 24.5, -46], size: [2.6, 0.5, 2.6] },
  { id: 'cB', top: [-4, 25, -49.5], size: [2.6, 0.5, 2.6] },
];

const shards = [
  ...ring(islands, 'base', 3.8, 5, 0.6),
  ...line([0, 4, -3], [0, 9, -3], 3),
  ...ring(islands, 'ledge1', 2.5, 3, 0.5),
  ...ring(islands, 'gear', 2.2, 4, 0.3, 1.9),
  above(blinkers[0].top), above(blinkers[1].top),
  ...ring(islands, 'terrace', 3.2, 4, 1.4),
  ...line([15, 17, -38], [15, 23, -38], 3),
  ...ring(islands, 'chimney', 2.8, 3, 0.6),
  above(crumblers[0].top), above(crumblers[1].top),
  ...ring(islands, 'kiln', 3.8, 5, 0.1),
  ...ring(islands, 'crest', 3.5, 4, Math.PI / 4),
];

export default {
  id: 'kiln-spire',
  name: 'Kiln Spire',
  subtitle: 'Up the chimney of the world',
  world: 'ember',
  env: 'ember',
  parMs: 140000,
  islands,
  updrafts,
  blinkers,
  crumblers,
  sweepers: [
    { id: 'sw1', center: [9, 10.5, -18], length: 4.2, arms: 3, speed: 1.1, height: 0.7 },
    { id: 'sw2', center: [-7, 25.5, -58.5], length: 5.2, arms: 2, speed: -1.5, height: 0.7 },
  ],
  hazards: [
    { id: 'lava1', style: 'lava', top: [-3.5, 0.1, -3.5], size: [2.4, 0.25, 2] },
    { id: 'lava2', style: 'lava', top: [11, 24.1, -40], size: [2.2, 0.25, 2.4] },
  ],
  spawn: { x: 0, y: 0, z: 4.5 },
  checkpoints: [
    { id: 'cp1', island: 'ledge1', dx: 2, dz: 1.5 },
    { id: 'cp2', island: 'terrace', dx: 2.5, dz: 2.5 },
    { id: 'cp3', island: 'kiln', dx: 3, dz: 3.5 },
  ],
  beacon: { island: 'crest', dx: 0, dz: 0 },
  shards,
  shardsRequired: 30,
  sunstones: [
    [0, 14.2, -3], // top of the first vent: double jump at the peak
    on(islands, 'flue', 0, 0, 1.1),
    [3, 30, -62], // above the fast slab beside the kiln
  ],
  hearts: [{ island: 'terrace', dx: -3, dz: -1 }, { island: 'kiln', dx: -3, dz: -3 }],
  enemySpawns: [
    { kind: 'puffcap', island: 'ledge1', at: [-2.5, -2] },
    { kind: 'emberbat', island: 'gear', at: [3, -8], hover: 3, orbit: 2.5 },
    { kind: 'spikeling', island: 'terrace', a: [-2.5, -2], b: [2.5, -3], leash: 3.8 },
    { kind: 'emberbat', island: 'chimney', at: [-4, -6], hover: 3, orbit: 2 },
    { kind: 'puffcap', island: 'crest', at: [3, -3] },
    { kind: 'spikeling', island: 'crest', a: [-3, -1], b: [3, -1], leash: 3.8 },
  ],
  killY: -25,
  route: [
    { updraft: 'u1' }, { island: 'ledge1', dx: 0, dz: 1, r: 1.6 }, { island: 'gear', dx: -1, dz: 3.8 },
    { island: 'gear', dx: 3.8, dz: -1 }, { blinker: 'b1' }, { blinker: 'b2' }, { island: 'terrace', dx: 1.5, dz: 3.5 },
    { updraft: 'u2' }, { island: 'chimney', dx: 2, dz: 0, r: 1.8 }, { island: 'chimney', dx: -3.5, dz: -3 },
    { crumbler: 'cA' }, { crumbler: 'cB' }, { island: 'kiln', dx: 2.5, dz: 4.5 }, { island: 'kiln', dx: 5.2, dz: -1 },
    { island: 'kiln', dx: 1, dz: -5.6 }, { island: 'crest', dx: 0, dz: 4 },
  ],
};
