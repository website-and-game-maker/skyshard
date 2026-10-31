import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSwitches, slabRise, poundHits } from './switches.js';

function setup() {
  const root = new THREE.Group();
  const colliders = [];
  const setColliderPresent = (c, on) => {
    const i = colliders.indexOf(c);
    if (on && i < 0) colliders.push(c);
    if (!on && i >= 0) colliders.splice(i, 1);
  };
  const sw = createSwitches({
    root, colliders, setColliderPresent,
    switches: [{ id: 'rune', top: [0, 1, 0], radius: 1.2, raises: ['a', 'b'] }],
    platforms: [
      { id: 'a', top: [0, 1, -5], size: [3, 0.5, 3], hiddenUntil: 'rune' },
      { id: 'b', top: [0, 1, -10], size: [3, 0.5, 3], hiddenUntil: 'rune' },
      { id: 'c', top: [5, 1, 0], size: [2, 0.5, 2] },
    ],
  });
  return { sw, colliders };
}

const solidAt = (colliders, x, z) => colliders.some((c) => c.box.containsPoint(new THREE.Vector3(x, 0.9, z)));

describe('rune switches', () => {
  it('hidden slabs are not solid until the rune is pounded', () => {
    const { sw, colliders } = setup();
    expect(solidAt(colliders, 0, -5)).toBe(false);
    expect(solidAt(colliders, 5, 0)).toBe(true); // ordinary slab
    expect(sw.pound(new THREE.Vector3(4, 1, 4))).toEqual([]); // missed the plate
    expect(sw.pound(new THREE.Vector3(0.5, 1, 0.3))).toEqual([{ type: 'switch', id: 'rune' }]);
    expect(sw.pound(new THREE.Vector3(0, 1, 0))).toEqual([]); // only once
    for (let k = 0; k < 120; k++) sw.update(1 / 60, k / 60);
    expect(solidAt(colliders, 0, -5)).toBe(true);
    expect(solidAt(colliders, 0, -10)).toBe(true);
  });

  it('reset hides the slabs again', () => {
    const { sw, colliders } = setup();
    sw.pound(new THREE.Vector3(0, 1, 0));
    for (let k = 0; k < 120; k++) sw.update(1 / 60, 0);
    sw.reset();
    expect(solidAt(colliders, 0, -5)).toBe(false);
  });

  it('rise curve and hit test', () => {
    expect(slabRise(null).solid).toBe(false);
    expect(slabRise(5)).toMatchObject({ solid: true, opacity: 1, drop: 0 });
    expect(poundHits({ top: [0, 1, 0], radius: 1 }, { x: 0, y: 3, z: 0 })).toBe(false);
  });
});
