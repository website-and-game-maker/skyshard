import * as THREE from 'three';

// Round islands are approximated by three overlapping boxes inscribed in the circle
// (wide-flat, square, narrow-tall). Their union hugs the disc, so walking off the
// visual edge drops Pip within ~0.4 units of the rim instead of at a square corner.
const ROUND_PROFILE = [
  [0.92, 0.38],
  [0.7, 0.7],
  [0.38, 0.92],
];

export function islandColliders({ x, y, z, radius }, thickness = 2) {
  return ROUND_PROFILE.map(([hx, hz]) => ({
    box: new THREE.Box3(
      new THREE.Vector3(x - radius * hx, y - thickness, z - radius * hz),
      new THREE.Vector3(x + radius * hx, y, z + radius * hz),
    ),
  }));
}

export function boxCollider(center, size, extra = {}) {
  const half = new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2);
  const c = new THREE.Vector3(center[0], center[1], center[2]);
  return { box: new THREE.Box3(c.clone().sub(half), c.clone().add(half)), ...extra };
}

// Top surface height under (x, z), or -Infinity. Used by tests and enemy placement.
export function groundHeightAt(colliders, x, z, maxY = Infinity) {
  let best = -Infinity;
  for (const c of colliders) {
    const b = c.box;
    if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y <= maxY + 1e-6) {
      if (b.max.y > best) best = b.max.y;
    }
  }
  return best;
}
