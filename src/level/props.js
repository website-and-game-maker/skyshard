import * as THREE from 'three';
import { mulberry32 } from './random.js';

// Sky shard: a tall faceted crystal with a bright core so bloom gives it a halo.
export function shardGeometry() {
  const g = new THREE.OctahedronGeometry(0.32, 0);
  g.scale(1, 1.75, 1);
  return g;
}

export function shardMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9ffcff, emissive: 0x29d4ff, emissiveIntensity: 1.8,
    roughness: 0.15, metalness: 0.2, flatShading: true,
  });
}

// A plump heart, extruded with a soft bevel.
export function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.32);
  s.bezierCurveTo(-0.08, -0.22, -0.38, -0.05, -0.38, 0.12);
  s.bezierCurveTo(-0.38, 0.3, -0.18, 0.38, 0, 0.22);
  s.bezierCurveTo(0.18, 0.38, 0.38, 0.3, 0.38, 0.12);
  s.bezierCurveTo(0.38, -0.05, 0.08, -0.22, 0, -0.32);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.07, bevelSegments: 4, curveSegments: 16 });
  g.center();
  return g;
}

export function buildHeart() {
  const mesh = new THREE.Mesh(
    heartGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xff5f86, emissive: 0xff2d64, emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  mesh.castShadow = true;
  return mesh;
}

// Rounded slab with a stone body, a brass band and a glowing rune underneath.
export function roundedSlabGeometry(w, h, d, r = 0.28) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const bevel = Math.min(0.08, h * 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h + bevel, 0); // top face at y = 0
  return g;
}

export function buildMover(def) {
  const [w, h, d] = def.size;
  const group = new THREE.Group();
  const body = new THREE.Mesh(roundedSlabGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.8 }));
  body.castShadow = true;
  body.receiveShadow = true;
  const band = new THREE.Mesh(
    roundedSlabGeometry(w + 0.08, 0.12, d + 0.08),
    new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.35, metalness: 0.8 }),
  );
  band.position.y = -h * 0.45;
  const rune = new THREE.Mesh(
    new THREE.RingGeometry(0.35, Math.min(w, d) * 0.36, 6).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x6ff6ff, emissive: 0x3de0ff, emissiveIntensity: 2.2, side: THREE.DoubleSide }),
  );
  rune.position.y = -h - 0.02;
  // A small hanging crystal so movers read as magical, not mechanical.
  const keel = new THREE.Mesh(shardGeometry(), shardMaterial());
  keel.scale.set(0.9, 0.9, 0.9);
  keel.position.y = -h - 0.65;
  group.add(body, band, rune, keel);
  group.userData.rune = rune;
  group.userData.keel = keel;
  return group;
}

export function buildCrumbler(def, seed) {
  const [w, h, d] = def.size;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd2a978, roughness: 0.95, transparent: true });
  const body = new THREE.Mesh(roundedSlabGeometry(w, h, d, 0.18), mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  // Dark crack lines across the top hint that it won't hold for long.
  const rand = mulberry32(seed);
  const crackMat = new THREE.MeshBasicMaterial({ color: 0x5a4030, transparent: true });
  for (let i = 0; i < 4; i++) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(w * (0.3 + rand() * 0.4), 0.02, 0.05), crackMat);
    crack.position.set((rand() - 0.5) * w * 0.4, 0.005, (rand() - 0.5) * d * 0.6);
    crack.rotation.y = rand() * Math.PI;
    group.add(crack);
  }
  // Pebbles under the slab.
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + rand() * 0.15, 0), mat);
    p.position.set((rand() - 0.5) * w * 0.6, -h - 0.15, (rand() - 0.5) * d * 0.6);
    p.castShadow = true;
    group.add(p);
  }
  group.userData.materials = [mat, crackMat];
  return group;
}

// Checkpoint totem: a carved pillar with a hovering crystal that lights up teal.
export function buildCheckpoint() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfc2b0, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.3, 8), stone);
  base.position.y = 0.15;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.6, 6), stone);
  pillar.position.y = 1.1;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.22, 6), stone);
  cap.position.y = 2.0;
  for (const m of [base, pillar, cap]) { m.castShadow = true; m.receiveShadow = true; }
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x8fa3b8, emissive: 0x243447, emissiveIntensity: 0.6, roughness: 0.2, flatShading: true });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0).scale(1, 1.5, 1), crystalMat);
  crystal.position.y = 2.75;
  crystal.castShadow = true;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6ff6ff, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 8, 48).rotateX(Math.PI / 2), ringMat);
  ring.position.y = 0.08;
  group.add(base, pillar, cap, crystal, ring);
  group.userData = { crystal, crystalMat, ring, ringMat, active: false, pulse: 0 };
  return group;
}

export function setCheckpointActive(cp, active) {
  const u = cp.userData;
  u.active = active;
  u.crystalMat.color.setHex(active ? 0xa8fff6 : 0x8fa3b8);
  u.crystalMat.emissive.setHex(active ? 0x2ee6d6 : 0x243447);
  u.crystalMat.emissiveIntensity = active ? 2.4 : 0.6;
  if (active) u.pulse = 1;
}

// Beacon: a stepped dais, four standing stones, an obelisk crowned with a big
// crystal, orbiting rings, and a light column that brightens when unlocked.
export function buildBeacon(timeUniform) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xeee2cf, roughness: 0.75 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b04c, roughness: 0.3, metalness: 0.85 });
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.12, 12), stone);
  dais.position.y = 0.0;
  dais.receiveShadow = true;
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.05, 6, 64).rotateX(Math.PI / 2), gold);
  inlay.position.y = 0.07;
  group.add(dais, inlay);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), stone);
    s.position.set(Math.cos(a) * 3.0, 1.1, Math.sin(a) * 3.0);
    s.rotation.y = -a;
    s.castShadow = true;
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), gold);
    tip.position.set(s.position.x, 2.45, s.position.z);
    group.add(s, tip);
  }

  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 4.6, 6), stone);
  obelisk.position.y = 2.3;
  obelisk.castShadow = true;
  obelisk.receiveShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.25, 6), gold);
  collar.position.y = 4.5;
  group.add(obelisk, collar);

  const coreMat = new THREE.MeshStandardMaterial({ color: 0xc9b8ff, emissive: 0x6a4cff, emissiveIntensity: 0.7, roughness: 0.15, flatShading: true });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0).scale(1, 1.6, 1), coreMat);
  core.position.y = 6.3;
  core.castShadow = true;
  group.add(core);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5 + i * 0.4, 0.05, 8, 64), gold);
    ring.position.y = 6.3;
    group.add(ring);
    rings.push(ring);
  }

  // Light column: additive cylinder that fades upward.
  const beamUniforms = { uTime: timeUniform, uPower: { value: 0.25 } };
  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uPower; varying vec2 vUv;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.6);
        float bands = 0.75 + 0.25 * sin(vUv.y * 120.0 - uTime * 6.0);
        float edge = sin(vUv.x * 3.14159 * 2.0) * 0.5 + 0.5;
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.62) * fade * bands * uPower * (0.5 + 0.5 * edge), 1.0);
      }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 160, 24, 1, true).translate(0, 80, 0), beamMat);
  beam.position.y = 6.3;
  beam.renderOrder = 5;
  beam.frustumCulled = false;
  group.add(beam);

  group.userData = { core, coreMat, rings, beamUniforms, unlocked: false };
  return group;
}

export function setBeaconUnlocked(beacon, unlocked) {
  const u = beacon.userData;
  u.unlocked = unlocked;
  u.coreMat.color.setHex(unlocked ? 0xfff4d0 : 0xc9b8ff);
  u.coreMat.emissive.setHex(unlocked ? 0xffc84a : 0x6a4cff);
  u.coreMat.emissiveIntensity = unlocked ? 3 : 0.7;
  u.beamUniforms.uPower.value = unlocked ? 1.2 : 0.25;
}

// Bloom-cap: a springy mushroom. Squash animation is driven from index.js.
export function buildMushroom() {
  const group = new THREE.Group();
  const stalk = new THREE.Mesh(
    new THREE.LatheGeometry([0.42, 0.34, 0.3, 0.32, 0.4].map((r, i) => new THREE.Vector2(r, i * 0.25)), 16),
    new THREE.MeshStandardMaterial({ color: 0xf6ead6, roughness: 0.7 }),
  );
  stalk.castShadow = true;
  const capGeo = new THREE.SphereGeometry(1.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  capGeo.scale(1, 0.55, 1);
  const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xff6fa3, roughness: 0.45, emissive: 0x401020, emissiveIntensity: 0.3 }));
  cap.position.y = 1.0;
  cap.castShadow = true;
  const under = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd6c2, roughness: 0.9 }));
  cap.add(under);
  const spotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const rand = mulberry32(8);
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, el = 0.25 + rand() * 0.9;
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(el), Math.cos(el) * 0.55, Math.sin(a) * Math.sin(el)).normalize();
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.14 + rand() * 0.08, 10, 6).scale(1, 0.35, 1), spotMat);
    spot.position.set(Math.cos(a) * Math.sin(el) * 1.22, Math.cos(el) * 1.22 * 0.55, Math.sin(a) * Math.sin(el) * 1.22);
    spot.lookAt(spot.position.clone().add(dir));
    spot.rotateX(Math.PI / 2);
    cap.add(spot);
  }
  group.add(stalk, cap);
  group.userData = { cap, squash: 0 };
  return group;
}

export const MUSHROOM_TOP = 1.0 + 1.25 * 0.55 - 0.04; // walkable height used for the collider

// Bramble patch: a mound with dark violet thorns. Purely visual; collider is a box.
export function buildThorns(size, seed) {
  const [w, h, d] = size;
  const group = new THREE.Group();
  const rand = mulberry32(seed);
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(w / 2, h, d / 2),
    new THREE.MeshStandardMaterial({ color: 0x4b3a5c, roughness: 0.9 }),
  );
  mound.receiveShadow = true;
  group.add(mound);
  const thornMat = new THREE.MeshStandardMaterial({ color: 0x7a3d8f, roughness: 0.4, emissive: 0x2a0d33, emissiveIntensity: 0.5 });
  const n = Math.round(w * d * 5);
  for (let i = 0; i < n; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4 + rand() * 0.3, 5), thornMat);
    const x = (rand() - 0.5) * w * 0.85, z = (rand() - 0.5) * d * 0.85;
    const k = 1 - (x * x) / ((w / 2) ** 2) - (z * z) / ((d / 2) ** 2);
    t.position.set(x, Math.max(0, Math.sqrt(Math.max(k, 0))) * h + 0.1, z);
    t.rotation.set((rand() - 0.5) * 0.8, 0, (rand() - 0.5) * 0.8);
    t.castShadow = true;
    group.add(t);
  }
  return group;
}

// Pooled sparkle bursts for pickups and checkpoints.
export function createSparkles(scene, max = 6) {
  const per = 24;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * per * 3);
  const life = new Float32Array(max * per);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x9ffcff) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `attribute float aLife; varying float vLife;
      void main() { vLife = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv; gl_PointSize = aLife > 0.0 ? 140.0 * aLife / -mv.z : 0.0; }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; varying float vLife;
      void main() { float d = length(gl_PointCoord - 0.5); if (vLife <= 0.0) discard;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.5) * 1.6, smoothstep(0.5, 0.0, d) * vLife); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const bursts = Array.from({ length: max }, () => ({ t: 1, origin: new THREE.Vector3(), dirs: [] }));
  const rand = mulberry32(31);
  let next = 0;
  return {
    points,
    emit(position) {
      const b = bursts[next];
      next = (next + 1) % max;
      b.t = 0;
      b.origin.copy(position);
      b.dirs = Array.from({ length: per }, () => new THREE.Vector3(rand() - 0.5, rand() * 0.9 - 0.2, rand() - 0.5).normalize().multiplyScalar(2 + rand() * 3));
    },
    update(dt) {
      bursts.forEach((b, bi) => {
        b.t = Math.min(1, b.t + dt * 1.6);
        for (let k = 0; k < per; k++) {
          const i = bi * per + k;
          const d = b.dirs[k];
          if (!d || b.t >= 1) { life[i] = 0; continue; }
          const t = b.t;
          pos[i * 3] = b.origin.x + d.x * t;
          pos[i * 3 + 1] = b.origin.y + d.y * t - 2 * t * t;
          pos[i * 3 + 2] = b.origin.z + d.z * t;
          life[i] = 1 - t;
        }
      });
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
    },
  };
}


// ---- World 2 and 3 props --------------------------------------------------------------

// Updraft: a column of rising wind drawn as spiralling translucent ribbons and a glowing vent.
export function buildUpdraft(def, timeUniform) {
  const { radius, height } = def;
  const group = new THREE.Group();
  const uniforms = { uTime: timeUniform, uColor: { value: new THREE.Color(def.color ?? 0xbff8ff) } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float stripes = smoothstep(0.55, 1.0, sin((vUv.x * 6.0 + vUv.y * 3.0 - uTime * 1.6) * 6.2831) * 0.5 + 0.5);
        float fade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
        gl_FragColor = vec4(uColor, stripes * fade * 0.45);
      }`,
  });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.8, height, 24, 1, true).translate(0, height / 2, 0), mat);
  tube.renderOrder = 3;
  const vent = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.85, 0.12, 8, 32).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: def.color ?? 0x6fe0ff, emissiveIntensity: 1.6 }),
  );
  vent.position.y = 0.06;
  group.add(tube, vent);
  return group;
}

// Phase slab: a glassy crystal platform that blinks in and out on a timer.
export function buildBlinker(def) {
  const [w, h, d] = def.size;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: def.color ?? 0xb69cff, emissive: def.color ?? 0x7a5cff, emissiveIntensity: 0.8,
    roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9,
  });
  const body = new THREE.Mesh(roundedSlabGeometry(w, h, d, 0.2), mat);
  body.castShadow = true;
  body.receiveShadow = true;
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
  const edge = new THREE.Mesh(roundedSlabGeometry(w + 0.06, 0.06, d + 0.06, 0.22), edgeMat);
  edge.position.y = 0.01;
  group.add(body, edge);
  group.userData = { mat, edgeMat };
  return group;
}

// Sweeper: a hub post with rotating arms tipped with glowing spikes. Hurts on contact.
export function buildSweeper(def) {
  const group = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.6, def.height ?? 1.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a2e30, roughness: 0.6, metalness: 0.4 }),
  );
  post.position.y = (def.height ?? 1.2) / 2;
  post.castShadow = true;
  const rotor = new THREE.Group();
  rotor.position.y = def.height ?? 1.2;
  const armMat = new THREE.MeshStandardMaterial({ color: def.color ?? 0xff6a3a, emissive: def.color ?? 0xff4a1a, emissiveIntensity: 1.4, roughness: 0.4 });
  const arms = def.arms ?? 1;
  for (let k = 0; k < arms; k++) {
    const arm = new THREE.Group();
    arm.rotation.y = (k / arms) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, def.length, 8).rotateZ(Math.PI / 2).translate(def.length / 2, 0, 0), armMat);
    bar.castShadow = true;
    arm.add(bar);
    for (let s = 1; s <= Math.floor(def.length); s++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), armMat);
      spike.position.set(s, 0.25, 0);
      arm.add(spike);
    }
    rotor.add(arm);
  }
  group.add(post, rotor);
  group.userData.rotor = rotor;
  return group;
}

// Sunstone: a rare golden star-gem with a halo ring. Three are hidden in every level.
export function buildSunstone() {
  const group = new THREE.Group();
  const gemMat = new THREE.MeshStandardMaterial({ color: 0xffe58a, emissive: 0xffa21a, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.3, flatShading: true });
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), gemMat);
  const points = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0).scale(1, 0.35, 1), gemMat);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 6, 40), haloMat);
  group.add(gem, points, halo);
  group.userData = { gem, points, halo, gemMat, haloMat };
  return group;
}

export function setSunstoneOwned(stone, owned) {
  const u = stone.userData;
  u.gemMat.transparent = owned;
  u.gemMat.opacity = owned ? 0.35 : 1;
  u.haloMat.opacity = owned ? 0.15 : 0.6;
}

// Lava pool: a glowing, slowly churning disc. The collider is a hazard box.
export function buildLava(size, timeUniform) {
  const [w, h, d] = size;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 6.0;
        float n = sin(p.x * 1.7 + uTime * 0.8) * sin(p.y * 1.3 - uTime * 0.6) + sin((p.x + p.y) * 2.1 + uTime);
        vec3 col = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.85, 0.3), smoothstep(0.2, 1.6, n));
        gl_FragColor = vec4(col * 1.6, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
  top.position.y = h - 0.02;
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.3, h, d + 0.3).translate(0, h / 2 - 0.06, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a1e20, roughness: 0.9 }),
  );
  const group = new THREE.Group();
  group.add(rim, top);
  return group;
}
