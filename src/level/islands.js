import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm3, mulberry32 } from './random.js';

export const THEMES = {
  meadow: { grass: [0x8fd36f, 0x5fae5a], rock: [0xd2c1ae, 0xa48c79, 0x705f58], foliage: [0x6cbf5c, 0x93d66c], blossom: [0xffe27a, 0xffffff, 0xff9fb8] },
  crystal: { grass: [0x86d9be, 0x4fa898], rock: [0xc4bdd6, 0x938bb2, 0x5f587e], foliage: [0xf4a9cb, 0xffc6dc], blossom: [0xffffff, 0xc8a6ff, 0x9ff2ff] },
  spire: { grass: [0xb5dc7a, 0x86b95f], rock: [0xdac7a6, 0xb0916f, 0x7d6551], foliage: [0xf2b45c, 0xf7d071], blossom: [0xff8a65, 0xffe082, 0xffffff] },
  beacon: { grass: [0xc2e690, 0x8fcc72], rock: [0xe6d8c2, 0xbca487, 0x8a7361], foliage: [0xfff0b0, 0xffd27a], blossom: [0xffffff, 0xffe9a8, 0x9ff2ff] },
};

const RIM = 0.94; // fraction of the radius where the flat top starts to roll over

// One island: a flat grassy top that rolls over a rounded lip into a rocky,
// noise-carved cone with sediment bands. Vertex colours carry all the shading
// detail, so the whole island is one draw call.
export function buildIslandGeometry(island, segments = 56) {
  const { radius: r, depth, theme } = island;
  const pal = THEMES[theme] ?? THEMES.meadow;
  const seed = Math.floor(Math.abs(island.x * 13 + island.z * 7 + r * 31)) % 9973;
  const g0 = new THREE.Color(pal.grass[0]), g1 = new THREE.Color(pal.grass[1]);
  const rk = pal.rock.map((c) => new THREE.Color(c));
  const dirt = new THREE.Color(0x8a6a50);

  // Profile rings from the centre of the top to the tip of the cone: [radiusFactor, y, kind].
  const rings = [];
  const topRings = Math.max(3, Math.round(r / 1.2));
  for (let i = 1; i <= topRings; i++) rings.push([RIM * (i / topRings), 0, 'top']);
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    rings.push([RIM + (1 - RIM) * Math.sin(a), -0.32 * (1 - Math.cos(a)), 'lip']);
  }
  rings.push([0.98, -0.55, 'dirt']);
  const sideRings = Math.max(6, Math.round(depth * 1.6));
  for (let i = 1; i <= sideRings; i++) {
    const t = i / sideRings;
    rings.push([0.97 * Math.pow(1 - t, 0.75) + 0.0001, -0.55 - t * (depth - 0.55), 'rock']);
  }

  const positions = [];
  const colors = [];
  const col = new THREE.Color();
  positions.push(0, 0, 0);
  colors.push(g0.r, g0.g, g0.b);
  for (const [f, y, kind] of rings) {
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const cx = Math.cos(a), sz = Math.sin(a);
      let rr = r * f, yy = y;
      if (kind === 'top') {
        // Gentle dips only, never above the collider surface.
        yy = -Math.max(0, fbm3(cx * f * 3, 0, sz * f * 3, seed)) * 0.06;
        col.lerpColors(g0, g1, Math.min(1, f * 0.7 + (fbm3(cx * f * 4, 1, sz * f * 4, seed) + 0.5) * 0.4));
      } else if (kind === 'lip') {
        col.copy(g1).multiplyScalar(0.92);
      } else if (kind === 'dirt') {
        rr *= 1 + fbm3(cx * 2, 0, sz * 2, seed) * 0.03;
        col.copy(dirt);
      } else {
        const t = (-y - 0.55) / (depth - 0.55);
        const n = fbm3(cx * 1.6, y * 0.35, sz * 1.6, seed + 3);
        rr *= 1 + n * 0.32 * (0.4 + t);
        yy += fbm3(cx * 3, y, sz * 3, seed + 5) * 0.4;
        const band = 0.5 + 0.5 * Math.sin(y * 2.3 + n * 4);
        col.lerpColors(rk[0], rk[1], band);
        col.lerp(rk[2], Math.min(1, t * 0.9 + Math.max(0, n) * 0.5));
      }
      positions.push(cx * rr, yy, sz * rr);
      colors.push(col.r, col.g, col.b);
    }
  }
  const tipIndex = positions.length / 3;
  positions.push(0, -depth - 0.4, 0);
  colors.push(rk[2].r * 0.8, rk[2].g * 0.8, rk[2].b * 0.8);

  const indices = [];
  const ringStart = (k) => 1 + k * segments;
  for (let s = 0; s < segments; s++) indices.push(0, ringStart(0) + ((s + 1) % segments), ringStart(0) + s);
  for (let k = 0; k < rings.length - 1; k++) {
    for (let s = 0; s < segments; s++) {
      const a = ringStart(k) + s, b = ringStart(k) + ((s + 1) % segments);
      const c = ringStart(k + 1) + s, d = ringStart(k + 1) + ((s + 1) % segments);
      indices.push(a, b, c, b, d, c);
    }
  }
  const last = ringStart(rings.length - 1);
  for (let s = 0; s < segments; s++) indices.push(last + s, last + ((s + 1) % segments), tipIndex);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export const islandMaterial = () =>
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });

// Wind sway shared by grass, flowers and leaves. Patches the standard shader so
// lighting and shadows still work; instance position offsets the phase.
export function addWind(material, timeUniform, strength = 0.18) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float h = clamp(position.y / 0.6, 0.0, 1.0);
          float w = sin(uWindTime * 1.7 + ip.x * 0.35 + ip.z * 0.27) + 0.5 * sin(uWindTime * 3.1 + ip.x * 0.9);
          transformed.x += w * ${strength.toFixed(3)} * h * h;
          transformed.z += w * ${(strength * 0.6).toFixed(3)} * h * h;
        }`,
      );
  };
  material.customProgramCacheKey = () => `wind${strength}`;
  return material;
}

function bladeGeometry() {
  // A curved, tapered blade with a darker base.
  const g = new THREE.BufferGeometry();
  const pts = [];
  const cols = [];
  const segs = 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = 0.055 * (1 - t);
    const z = t * t * 0.12;
    pts.push(-w, t * 0.55, z, w, t * 0.55, z);
    const c = 0.62 + 0.38 * t;
    cols.push(c, c, c, c, c, c);
  }
  const idx = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Point blade normals up so grass shades like the ground it grows from.
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

// Scatter positions on an island top, skipping keep-out circles (shards, props, paths).
function scatter(island, count, rand, avoid, margin = 0.85) {
  const out = [];
  let tries = 0;
  while (out.length < count && tries < count * 6) {
    tries++;
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * island.radius * margin;
    const x = island.x + Math.cos(a) * rr, z = island.z + Math.sin(a) * rr;
    if (avoid.some((c) => (x - c[0]) ** 2 + (z - c[1]) ** 2 < c[2] * c[2])) continue;
    out.push([x, z]);
  }
  return out;
}

export function createVegetation(group, islandList, { quality, windTime, avoid = [] }) {
  const rand = mulberry32(2024);
  const density = quality === 'low' ? 3 : 11; // blades per square unit
  const bladeSpots = [];
  const flowerSpots = [];
  for (const isl of islandList) {
    const area = Math.PI * isl.radius * isl.radius;
    const pal = THEMES[isl.theme] ?? THEMES.meadow;
    for (const [x, z] of scatter(isl, Math.round(area * density), rand, [], 0.9)) bladeSpots.push({ x, y: isl.y, z, pal });
    for (const [x, z] of scatter(isl, Math.round(area * 0.35), rand, avoid, 0.85)) flowerSpots.push({ x, y: isl.y, z, pal });
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const e = new THREE.Euler();
  const c = new THREE.Color();

  const grassMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), windTime);
  const grass = new THREE.InstancedMesh(bladeGeometry(), grassMat, bladeSpots.length);
  bladeSpots.forEach((b, i) => {
    e.set(0, rand() * Math.PI * 2, 0);
    q.setFromEuler(e);
    const k = 0.5 + rand() * 0.55;
    m.compose(p.set(b.x, b.y - 0.03, b.z), q, s.set(k, k * (0.6 + rand() * 0.6), k));
    grass.setMatrixAt(i, m);
    c.setHex(b.pal.grass[rand() < 0.5 ? 0 : 1]).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.3) * 0.08);
    grass.setColorAt(i, c);
  });
  grass.receiveShadow = quality !== 'low';
  grass.name = 'grass';
  group.add(grass);

  // Flowers: a five-petal star on a short stem, tinted per instance.
  const petal = new THREE.CylinderGeometry(0.11, 0.05, 0.04, 5, 1).translate(0, 0.24, 0);
  const stem = new THREE.CylinderGeometry(0.012, 0.012, 0.24, 3).translate(0, 0.12, 0);
  const flowerGeo = mergeGeometries([colorize(petal, 1), colorize(stem, 0.35, 0x4c8f3e)]);
  const flowerMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), windTime, 0.05);
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerSpots.length);
  flowerSpots.forEach((f, i) => {
    e.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
    q.setFromEuler(e);
    const k = 0.55 + rand() * 0.35;
    m.compose(p.set(f.x, f.y, f.z), q, s.set(k, k, k));
    flowers.setMatrixAt(i, m);
    flowers.setColorAt(i, c.setHex(f.pal.blossom[Math.floor(rand() * f.pal.blossom.length)]));
  });
  flowers.castShadow = false;
  flowers.name = 'flowers';
  group.add(flowers);
  return { grass, flowers };
}

// Bake a uniform vertex colour (or a white multiplier) into a geometry.
export function colorize(geo, shade = 1, hex = 0xffffff) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex).multiplyScalar(shade);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Minimal merge for non-indexed geometries sharing position/normal/color.
export function mergeGeometries(list) {
  const attrs = ['position', 'normal', 'color'];
  const out = new THREE.BufferGeometry();
  for (const name of attrs) {
    const parts = list.map((g) => (g.index ? g.toNonIndexed() : g).attributes[name]);
    if (parts.some((a) => !a)) continue;
    const total = parts.reduce((n, a) => n + a.array.length, 0);
    const arr = new Float32Array(total);
    let o = 0;
    for (const a of parts) { arr.set(a.array, o); o += a.array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, parts[0].itemSize));
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
}

// Rounded tree: a gently bent tapered trunk and a crown of lumpy, noise-sculpted
// spheres. Leaves are darker underneath (baked ambient occlusion).
export function buildTree(theme, seed) {
  const pal = THEMES[theme] ?? THEMES.meadow;
  const rand = mulberry32(seed);
  const height = 2.6 + rand() * 1.4;
  const bend = (rand() - 0.5) * 0.6;
  const trunk = new THREE.CylinderGeometry(0.16, 0.32, height, 8, 6, false).translate(0, height / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i) / height;
    tp.setX(i, tp.getX(i) + bend * y * y);
  }
  trunk.computeVertexNormals();
  const trunkMesh = new THREE.Mesh(trunk, new THREE.MeshStandardMaterial({ color: 0x8b6b55, roughness: 0.95 }));
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;

  const crowns = [];
  const n = 3 + Math.floor(rand() * 3);
  const c0 = new THREE.Color(pal.foliage[0]), c1 = new THREE.Color(pal.foliage[1]);
  for (let k = 0; k < n; k++) {
    const r = 0.8 + rand() * 0.55;
    const ico = new THREE.IcosahedronGeometry(r, 2);
    ico.deleteAttribute('normal');
    ico.deleteAttribute('uv');
    const g = mergeVertices(ico); // shared vertices give smooth, rounded foliage
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const d = 1 + fbm3(v.x * 1.4, v.y * 1.4, v.z * 1.4, seed + k) * 0.35;
      v.multiplyScalar(d);
      pos.setXYZ(i, v.x, v.y, v.z);
      const up = (v.y / r + 1) / 2;
      col.lerpColors(c0, c1, up * 0.8 + rand() * 0.2).multiplyScalar(0.62 + 0.38 * up);
      cols.set([col.r, col.g, col.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const a = (k / n) * Math.PI * 2 + rand();
    const spread = k === 0 ? 0 : 0.7;
    g.translate(bend + Math.cos(a) * spread, height + (k === 0 ? 0.35 : rand() * 0.5 - 0.2), Math.sin(a) * spread);
    crowns.push(g.index ? g.toNonIndexed() : g);
  }
  const crown = new THREE.Mesh(
    mergeGeometries(crowns),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
  );
  crown.castShadow = true;
  crown.receiveShadow = true;
  const tree = new THREE.Group();
  tree.add(trunkMesh, crown);
  tree.userData.crown = crown;
  tree.userData.phase = rand() * 10;
  return tree;
}

export function buildRock(seed, size = 1, theme = 'meadow') {
  const pal = THEMES[theme] ?? THEMES.meadow;
  const g = new THREE.IcosahedronGeometry(size, 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + fbm3(v.x * 1.8, v.y * 1.8, v.z * 1.8, seed) * 0.4);
    v.y *= 0.6;
    pos.setXYZ(i, v.x, Math.max(v.y, -0.1 * size), v.z);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: pal.rock[1], roughness: 0.95 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Animated falling water: a curved ribbon over the island lip, with scrolling
// streaks and foam at the top, fading into the clouds below.
const waterVertex = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uLength;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float y = vUv.y * uLength;
    float streak = noise(vec2(vUv.x * 9.0, y * 0.35 - uTime * uSpeed));
    streak = smoothstep(0.35, 0.9, streak + noise(vec2(vUv.x * 23.0, y * 0.8 - uTime * uSpeed * 1.4)) * 0.3);
    vec3 deep = vec3(0.16, 0.52, 0.86);
    vec3 col = mix(deep, vec3(0.82, 0.95, 1.0), streak * 0.75);
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float foam = (1.0 - smoothstep(0.0, 0.05, abs(vUv.y - 0.12))) * 0.7; // white water at the lip
    col = mix(col, vec3(1.0), foam);
    float alpha = (0.78 + 0.22 * streak) * edge * smoothstep(1.0, 0.55, vUv.y);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }
`;

export function createWaterMaterial(timeUniform, length, speed = 1.6) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSpeed: { value: speed }, uLength: { value: length } }]),
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
}

export function buildWaterfall(island, angle, timeUniform) {
  const group = new THREE.Group();
  const width = 1.5;
  const drop = island.depth + 14;
  const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  const side = new THREE.Vector3(-out.z, 0, out.x);

  // Ribbon: rows from the stream on top, over the lip, then down and slightly outward.
  const rows = 40;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    let o, y;
    if (t < 0.12) {
      const k = t / 0.12;
      o = island.radius * (0.8 + 0.2 * k);
      y = 0.03 - k * k * 0.2;
    } else {
      const k = (t - 0.12) / 0.88;
      o = island.radius + 0.25 + Math.sqrt(k) * 2.2;
      y = -0.2 - k * drop;
    }
    for (const sx of [-1, 1]) {
      const p = out.clone().multiplyScalar(o).addScaledVector(side, (sx * width) / 2);
      pos.push(p.x, y, p.z);
      uv.push(sx < 0 ? 0 : 1, t);
    }
  }
  for (let i = 0; i < rows; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = createWaterMaterial(timeUniform, drop);
  mat.uniforms.uTime = timeUniform;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  const ribbon = new THREE.Mesh(geo, mat);
  ribbon.renderOrder = 2;
  group.add(ribbon);
  group.position.set(island.x, island.y, island.z);
  return group;
}

// Background islands give the sky depth. Low detail, no colliders, and fogged.
export function createDistantIslands(group, quality) {
  const rand = mulberry32(99);
  const count = quality === 'low' ? 6 : 12;
  const mat = islandMaterial();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.4;
    const dist = 95 + rand() * 90;
    const isl = {
      x: Math.cos(a) * dist, y: -8 + rand() * 40, z: Math.sin(a) * dist - 45,
      radius: 5 + rand() * 10, depth: 8 + rand() * 12,
      theme: ['meadow', 'crystal', 'spire', 'beacon'][i % 4],
    };
    const mesh = new THREE.Mesh(buildIslandGeometry(isl, 28), mat);
    mesh.position.set(isl.x, isl.y, isl.z);
    mesh.userData.bob = { base: isl.y, phase: rand() * 6, amp: 0.6 + rand() };
    group.add(mesh);
    const trees = Math.floor(isl.radius / 4);
    for (let k = 0; k < trees; k++) {
      const t = buildTree(isl.theme, 500 + i * 10 + k);
      const ta = rand() * Math.PI * 2, tr = rand() * isl.radius * 0.6;
      t.position.set(Math.cos(ta) * tr, 0, Math.sin(ta) * tr);
      t.scale.setScalar(1.3);
      t.traverse((o) => { o.castShadow = false; });
      mesh.add(t);
    }
  }
}
