// Final boss: the Gloamking, the shadow that shattered the sky. It circles overhead firing
// orbs, then dives; it is stunned after landing. Once hurt, its landings send shadow rings.
import { makeArena } from './arena.js';

export default makeArena({
  id: 'gloamking',
  name: 'Crown of Night',
  subtitle: 'Final boss: the Gloamking',
  world: 'starfall',
  env: 'starfall',
  theme: 'starlit',
  edgeTheme: 'frost',
  decor: { startTrees: [[-3.5, 2]] },
  boss: { type: 'gloam', name: 'The Gloamking', hp: 4 },
});
