// Level registry. LEVELS is play order; WORLDS groups them for the world map.
// The tutorial (when present) sits first and belongs to no world.
import driftmeadow from './driftmeadow.js';
import windward from './windward.js';
import bramblebrute from './bramblebrute.js';
import cinderSteps from './cinder-steps.js';
import kilnSpire from './kiln-spire.js';
import cinderhorn from './cinderhorn.js';
import moonlitDrift from './moonlit-drift.js';
import auroraSpires from './aurora-spires.js';
import gloamking from './gloamking.js';

export const WORLDS = [
  { id: 'meadow', name: 'Driftmeadow Isles', blurb: 'Sunny meadows where Pip first set out.', color: '#8fd36f', accent: '#ffe27a',
    levels: ['driftmeadow', 'windward', 'bramblebrute'] },
  { id: 'ember', name: 'The Emberwilds', blurb: 'Smouldering isles over a sea of glowing ash.', color: '#ff7a3a', accent: '#ffd27a',
    levels: ['cinder-steps', 'kiln-spire', 'cinderhorn'] },
  { id: 'starfall', name: 'Starfall Reach', blurb: 'Frozen spires under the aurora, where the sky broke.', color: '#8a9cff', accent: '#9ff2ff',
    levels: ['moonlit-drift', 'aurora-spires', 'gloamking'] },
];

export const LEVELS = [driftmeadow, windward, bramblebrute, cinderSteps, kilnSpire, cinderhorn, moonlitDrift, auroraSpires, gloamking];

export const levelById = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
export const worldById = Object.fromEntries(WORLDS.map((w) => [w.id, w]));

export function nextLevelId(id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1].id : null;
}
