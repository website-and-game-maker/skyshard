// World 1 boss: Bramblebrute, an ancient Mossback grown wild with thorns.
// It charges in straight lines; dodge and it rams the arena rim, then stomp it while it's dizzy.
import { makeArena } from './arena.js';

export default makeArena({
  id: 'bramblebrute',
  name: "Bramblebrute's Thicket",
  subtitle: 'Boss: Bramblebrute',
  world: 'meadow',
  env: 'meadow',
  theme: 'meadow',
  boss: { type: 'bramble', name: 'Bramblebrute', hp: 3 },
});
