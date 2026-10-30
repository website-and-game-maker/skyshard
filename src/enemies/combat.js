// Contact rules between Pip (an upright box, origin at the feet) and enemies.
import * as THREE from 'three';

const KNOCK_H = 8;
const KNOCK_UP = 6;

export function playerBox(player, out = new THREE.Box3(), grow = 0) {
  const p = player.position;
  const hw = (player.halfWidth ?? 0.35) + grow;
  out.min.set(p.x - hw, p.y - grow, p.z - hw);
  out.max.set(p.x + hw, p.y + (player.height ?? 1.1) + grow, p.z + hw);
  return out;
}

const box = new THREE.Box3();
const sphere = new THREE.Sphere();

export function touchesSphere(player, center, radius) {
  sphere.center.copy(center);
  sphere.radius = radius;
  return playerBox(player, box).intersectsSphere(sphere);
}

// Landing on top (falling, feet above the enemy's middle) or ground-pounding wins.
export function isStomp(player, center) {
  if (player.groundPounding) return true;
  const vy = player.velocity?.y ?? 0;
  return vy <= 0.5 && player.position.y >= center.y - 0.05;
}

export function knockbackFrom(source, player) {
  const k = new THREE.Vector3(player.position.x - source.x, 0, player.position.z - source.z);
  if (k.lengthSq() < 1e-6) k.set(0, 0, 1);
  k.normalize().multiplyScalar(KNOCK_H);
  k.y = KNOCK_UP;
  return k;
}

// Touching a hazard collider (thorns). Uses a slightly grown box so standing on one counts.
export function touchesHazard(player, collider) {
  return playerBox(player, box, 0.05).intersectsBox(collider.box);
}
