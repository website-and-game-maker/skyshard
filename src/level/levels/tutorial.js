// Tutorial: "First Flight". One lesson per island, heading north (-z) like Driftmeadow.
// Each lesson's tip appears when Pip walks into its zone; `action` is the move that
// ticks it off (main listens for it). Gaps are sized so the taught move is needed:
// the terrace ledge is out of single-jump reach, and the gap after the rune can only
// be crossed on the bridge the ground pound raises.
// Text tokens like {jump} are replaced with the right key or button for the device.

const islands = [
  { id: 'nest', x: 0, y: 0, z: 0, radius: 8, depth: 7, theme: 'meadow', waterfall: { angle: 2.2 },
    trees: [[-5.2, 3.2], [5.4, 3.6]], rocks: [[6.4, -1.5], [-6, -2.5]] },
  { id: 'hop1', x: 0, y: 0.8, z: -12.6, radius: 2.4, depth: 3, theme: 'meadow' },
  { id: 'hop2', x: 2.4, y: 1.6, z: -17.6, radius: 2.4, depth: 3, theme: 'meadow' },
  { id: 'terrace', x: 0, y: 2.2, z: -25, radius: 5, depth: 6, theme: 'meadow', trees: [[-3.4, 2.4]] },
  { id: 'upper', x: 0, y: 5.6, z: -35, radius: 4.2, depth: 6, theme: 'crystal' },
  { id: 'dashland', x: 0, y: 5.6, z: -50.5, radius: 4.2, depth: 6, theme: 'crystal' },
  { id: 'arena', x: 0, y: 5.6, z: -80, radius: 7.5, depth: 8, theme: 'meadow', waterfall: { angle: -0.8 },
    trees: [[-5.6, -3.2]], rocks: [[5.8, 2.6]] },
  { id: 'springpad', x: 0, y: 5.6, z: -93, radius: 3, depth: 4, theme: 'crystal' },
  { id: 'summit', x: 0, y: 13, z: -104, radius: 7, depth: 9, theme: 'beacon', trees: [[4.2, -3.6]] },
];

const byId = Object.fromEntries(islands.map((i) => [i.id, i]));
const at = (id, dx = 0, dz = 0, lift = 0.9) => [byId[id].x + dx, byId[id].y + lift, byId[id].z + dz];

// Rune plates react to a ground pound. Each one raises the slabs listed in `raises`.
const switches = [{ id: 'rune', top: [0, 5.85, -51.5], radius: 1.3, raises: ['bridge1', 'bridge2', 'bridge3'] }];

// Static slabs; ones with `hiddenUntil` stay invisible and passable until that switch is pounded.
const platforms = [
  { id: 'bridge1', top: [0, 5.6, -58.5], size: [3, 0.5, 3], hiddenUntil: 'rune' },
  { id: 'bridge2', top: [0, 5.6, -63.5], size: [3, 0.5, 3], hiddenUntil: 'rune' },
  { id: 'bridge3', top: [0, 5.6, -68.5], size: [3, 0.5, 3], hiddenUntil: 'rune' },
];

const tips = [
  { id: 'move', at: [0, 0, 4.5], radius: 3, action: 'move', title: 'Run',
    text: 'Use {move} to run. Grab the glowing shards!' },
  { id: 'camera', at: [0, 0, -2.5], radius: 3.2, action: 'camera', title: 'Look around',
    text: 'Turn the camera with {camera}. One shard is hiding behind you.' },
  { id: 'jump', at: [0, 0, -6.5], radius: 2.6, action: 'jump', title: 'Jump',
    text: 'Press {jump} to jump the gap. Hold it longer to jump higher.' },
  { id: 'doubleJump', at: [0, 2.2, -25], radius: 4.2, action: 'doubleJump', title: 'Double jump',
    text: 'That ledge is too high. Press {jump} again in mid-air to double jump.' },
  { id: 'dash', at: [0, 5.6, -35], radius: 3.6, action: 'dash', title: 'Dash',
    text: 'Long gap ahead. Jump, then press {dash} in mid-air to dash across.' },
  { id: 'pound', at: [0, 5.6, -49], radius: 3, action: 'pound', title: 'Ground pound',
    text: 'Jump over the glowing rune and press {pound} to slam it. Something will rise.' },
  { id: 'stomp', at: [0, 5.6, -73.5], radius: 3, action: 'stomp', title: 'Enemies',
    text: 'Mossbacks charge when they see you. Jump on their heads, or ground pound them.' },
  { id: 'spring', at: [0, 5.6, -87], radius: 3, action: 'spring', title: 'Bloom-cap',
    text: 'Land on the mushroom to bounce up to the summit.' },
  { id: 'beacon', at: [0, 13, -100], radius: 4, action: 'goal', title: 'Light the beacon',
    text: 'The beacon wakes once you hold enough shards. Step into it to finish.' },
];

const shards = [
  // Nest: a path forward plus one tucked behind the spawn (the camera lesson).
  at('nest', 0, 1.5), at('nest', 0, -1.5), at('nest', 0, -4.5), at('nest', 0, 7.2),
  at('hop1'), at('hop2'),
  at('terrace', -2, 0), at('terrace', 2, 0), at('terrace', 0, -3),
  // Up on the double-jump ledge, then strung across the dash gap.
  at('upper', 0, 1.5), [0, 7.4, -41], [0, 7.4, -43.5],
  at('dashland', -2.4, 0), at('dashland', 2.4, 0),
  // Along the bridge the rune raises.
  [0, 6.5, -58.5], [0, 6.5, -63.5], [0, 6.5, -68.5],
  // Arena ring.
  at('arena', -3.5, 0), at('arena', 3.5, 0), at('arena', 0, -4), at('arena', -3, -5), at('arena', 3, -5),
  // Up the bloom-cap's column and on the summit.
  [0, 13, -93], at('summit', -3, 3), at('summit', 3, 3),
];

const enemySpawns = [
  { kind: 'mossback', island: 'arena', a: [-4, -2], b: [4, -2], leash: 5.5 },
  { kind: 'puffcap', island: 'arena', at: [4.5, -5] },
];

export default {
  id: 'tutorial',
  name: 'First Flight',
  subtitle: 'Tutorial',
  world: 'tutorial', // belongs to no world on the map
  islands,
  movers: [],
  crumblers: [],
  bouncers: [{ id: 'bloom', island: 'springpad', dx: 0, dz: 0, strength: 26 }],
  hazards: [],
  switches,
  platforms,
  spawn: { x: 0, y: 0, z: 4.5 },
  checkpoints: [
    { id: 'cp1', island: 'upper', dx: 2.2, dz: 1.6 },
    { id: 'cp2', island: 'arena', dx: 1.8, dz: 4.6 },
  ],
  beacon: { island: 'summit', dx: 0, dz: -1.5, radius: 2.2 },
  shards,
  shardsRequired: 18,
  enemySpawns,
  hearts: [{ island: 'arena', dx: -5, dz: 3 }],
  killY: -18,
  tips,
};
