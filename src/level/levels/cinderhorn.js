// World 2 boss: Cinderhorn, a magma ram. It leaps and slams, sending rings of fire across
// the floor (jump over them). After three slams it's winded: stomp it then.
import { makeArena } from './arena.js';

export default makeArena({
  id: 'cinderhorn',
  name: 'The Caldera',
  subtitle: 'Boss: Cinderhorn',
  world: 'ember',
  env: 'ember',
  theme: 'ash',
  edgeTheme: 'ember',
  decor: { startTrees: [] },
  boss: { type: 'cinder', name: 'Cinderhorn', hp: 3 },
});
