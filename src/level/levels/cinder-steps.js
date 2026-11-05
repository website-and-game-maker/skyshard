// World 2-1: Cinder Steps. Phase slabs that blink in and out, lava pools, a spinning
// sweeper to jump, Spikelings (ground pound them) and Emberbats.
import { on, ring, line, above } from './helpers.js';

const islands = [
  { id: 'start', x: 0, y: 0, z: 0, radius: 7, depth: 8, theme: 'ash', rocks: [[3.5, 3], [-4, -2], [-2, 4.5]] },
  { id: 'forge', x: 0, y: 2, z: -28, radius: 6.5, depth: 8, theme: 'ash', rocks: [[4.5, -3]] },
  { id: 'mill', x: 0, y: 2.5, z: -41, radius: 6, depth: 8, theme: 'ember' },
  { id: 'anvil', x: 0, y: 3, z: -67, radius: 5.5, depth: 8, theme: 'ash', rocks: [[-3, -3]] },
  { id: 'ashspur', x: -10, y: 4, z: -67, radius: 1.8, depth: 3, theme: 'ember' },
  { id: 'crown', x: 0, y: 8, z: -88, radius: 6, depth: 10, theme: 'ember', rocks: [[4, -2.5]] },
  { id: 'beacon', x: 0, y: 8.5, z: -101, radius: 6, depth: 9, theme: 'ash', rocks: [[-4, 3]] },
];

const blink = (id, top, phase, period = 3, size = [3, 0.5, 3]) => ({ id, top, size, period, on: 0.65, phase });
const blinkers = [
  blink('b1', [0, 0.5, -10], 0),
  blink('b2', [3, 1.2, -14.5], 0.7),
  blink('b3', [0, 1.9, -19], 1.4),
  blink('b4', [6, 4.5, -71], 0, 3.2, [2.8, 0.5, 2.8]),
  blink('b5', [9.5, 6, -75.5], 0.9, 3.2, [2.8, 0.5, 2.8]),
  blink('b6', [6.5, 7.5, -80], 1.8, 3.2, [2.8, 0.5, 2.8]),
];

const movers = [
  { id: 'ferry', size: [3.2, 0.6, 3.2], from: [0, 2.5, -50.5], to: [0, 2.5, -59], period: 6, phase: 0 },
];

const shards = [
  ...ring(islands, 'start', 3.5, 5, 0.3),
  ...blinkers.slice(0, 3).map((b) => above(b.top)),
  ...ring(islands, 'forge', 3.5, 5, 0.9),
  ...ring(islands, 'mill', 2.5, 4, 0.4, 1.9), // over the sweeper arms: grab them mid-jump
  ...line([0, 3.4, -50.5], [0, 3.4, -59], 3),
  ...ring(islands, 'anvil', 3, 4, 0.8),
  ...blinkers.slice(3).map((b) => above(b.top)),
  ...ring(islands, 'crown', 3.5, 5, 0.2),
  ...ring(islands, 'beacon', 4, 4, Math.PI / 4),
];

export default {
  id: 'cinder-steps',
  name: 'Cinder Steps',
  subtitle: 'Mind the flicker, mind the lava',
  world: 'ember',
  env: 'ember',
  parMs: 140000,
  islands,
  blinkers,
  movers,
  sweepers: [{ id: 'sw1', center: [0, 2.5, -41], length: 4.8, arms: 2, speed: 1.4, height: 0.7 }],
  hazards: [
    { id: 'lava1', style: 'lava', top: [-3, 2.1, -30], size: [2.6, 0.25, 2.4] },
    { id: 'lava2', style: 'lava', top: [3, 3.1, -68], size: [2.2, 0.25, 2.2] },
    { id: 'lava3', style: 'lava', top: [-3, 8.1, -90], size: [2.6, 0.25, 2.2] },
  ],
  spawn: { x: 0, y: 0, z: 4 },
  checkpoints: [
    { id: 'cp1', island: 'forge', dx: 3, dz: 3 },
    { id: 'cp2', island: 'anvil', dx: -2.5, dz: 2.5 },
    { id: 'cp3', island: 'crown', dx: 2.5, dz: 2.5 },
  ],
  beacon: { island: 'beacon', dx: 0, dz: 0 },
  shards,
  shardsRequired: 30,
  sunstones: [
    [4, 4.6, -55], // beside the ferry, over the lava sea: leap off and back
    on(islands, 'ashspur', 0, 0, 1.1),
    [9.5, 10, -75.5], // a double jump above the middle slab
  ],
  hearts: [{ island: 'mill', dx: -4.5, dz: -1 }, { island: 'crown', dx: -3, dz: 2.5 }],
  enemySpawns: [
    { kind: 'spikeling', island: 'forge', a: [-3, -3], b: [3, -3], leash: 4.5 },
    { kind: 'emberbat', island: 'mill', at: [0, -13], hover: 3, orbit: 2.5 },
    { kind: 'puffcap', island: 'anvil', at: [-2.5, -3] },
    { kind: 'emberbat', island: 'anvil', at: [5, -8], hover: 4, orbit: 2 },
    { kind: 'spikeling', island: 'crown', a: [-3, -2], b: [3, -2], leash: 4 },
    { kind: 'mossback', island: 'beacon', a: [-3, -3], b: [3, -3], leash: 4 },
  ],
  killY: -25,
  route: [
    { island: 'start', dx: 0, dz: -5.4 }, { blinker: 'b1' }, { blinker: 'b2' }, { blinker: 'b3' }, { island: 'forge', dx: 0, dz: 4 },
    { island: 'forge', dx: 0, dz: -5 }, { island: 'mill', dx: 0, dz: 3 }, { island: 'mill', dx: 3.5, dz: 0 }, { island: 'mill', dx: 0, dz: -5.2 },
    { mover: 'ferry' }, { island: 'anvil', dx: 0, dz: 3.5 }, { island: 'anvil', dx: 3, dz: -2 },
    { blinker: 'b4' }, { blinker: 'b5' }, { blinker: 'b6' }, { island: 'crown', dx: 2, dz: 3.5 },
    { island: 'crown', dx: 0, dz: -4.8 }, { island: 'beacon', dx: 0, dz: 4 },
  ],
};
