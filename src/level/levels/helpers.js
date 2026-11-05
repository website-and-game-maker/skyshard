// Small helpers for writing level data. All return plain [x, y, z] arrays.
export const SHARD_HEIGHT = 0.9;

export function islandIndex(islands) {
  return Object.fromEntries(islands.map((i) => [i.id, i]));
}

// A point above an island's surface, offset by (dx, dz).
export function on(islands, id, dx = 0, dz = 0, lift = SHARD_HEIGHT) {
  const i = islands.find((v) => v.id === id);
  if (!i) throw new Error(`unknown island ${id}`);
  return [i.x + dx, i.y + lift, i.z + dz];
}

// n points in a circle of radius r on an island.
export function ring(islands, id, r, n, offset = 0, lift = SHARD_HEIGHT) {
  return Array.from({ length: n }, (_, k) => {
    const a = offset + (k / n) * Math.PI * 2;
    return on(islands, id, Math.cos(a) * r, Math.sin(a) * r, lift);
  });
}

// n evenly spaced points from a to b (inclusive), e.g. shards along a jump or a ferry route.
export function line(a, b, n) {
  return Array.from({ length: n }, (_, k) => {
    const t = n === 1 ? 0.5 : k / (n - 1);
    return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
  });
}

// Shards hovering over a slab top ([x, y, z]).
export const above = (top, lift = SHARD_HEIGHT) => [top[0], top[1] + lift, top[2]];
