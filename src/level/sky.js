import * as THREE from 'three';
import { mulberry32 } from './random.js';

export const SUN_DIRECTION = new THREE.Vector3(-0.45, 0.62, 0.64).normalize();
export const FOG_COLOR = new THREE.Color(0xf6dccb);

// Sky dome: a vertical gradient (soft blue zenith to peach horizon), a sun with a
// wide halo, and slow high cirrus made from 2D value noise. Rendered behind everything.
const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // depth = far plane
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uBelow;
  uniform vec3 uSunDir;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += noise(p) * a; p *= 2.02; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
    col = mix(col, uZenith, smoothstep(0.2, 0.85, h));
    col = mix(col, uBelow, smoothstep(0.0, -0.25, h));

    float sd = max(dot(d, uSunDir), 0.0);
    col += vec3(1.0, 0.82, 0.6) * pow(sd, 8.0) * 0.35;
    col += vec3(1.0, 0.9, 0.75) * pow(sd, 64.0) * 0.6;
    col += vec3(1.0, 0.97, 0.9) * smoothstep(0.9993, 0.9997, sd) * 4.0;

    if (h > 0.02) {
      vec2 uv = d.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.006, uTime * 0.002);
      float c = smoothstep(0.52, 0.85, fbm(uv));
      vec3 cloudCol = mix(vec3(1.0, 0.96, 0.93), vec3(1.0, 0.88, 0.78), pow(sd, 3.0));
      col = mix(col, cloudCol, c * smoothstep(0.02, 0.25, h) * 0.75);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSky(scene) {
  const uniforms = {
    uZenith: { value: new THREE.Color(0x5d97e0) },
    uMid: { value: new THREE.Color(0x9cc6f0) },
    uHorizon: { value: FOG_COLOR.clone() },
    uBelow: { value: new THREE.Color(0xf2c9c4) },
    uSunDir: { value: SUN_DIRECTION.clone() },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  dome.name = 'sky';
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);
  return {
    dome,
    update(t, cameraPos) {
      uniforms.uTime.value = t;
      if (cameraPos) dome.position.copy(cameraPos);
    },
  };
}

// Hemisphere fill plus a warm sun that casts shadows. The shadow frustum follows
// the player so a modest shadow map stays sharp anywhere in the level.
export function createLights(scene, quality) {
  const hemi = new THREE.HemisphereLight(0xd6e8ff, 0xe8b894, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0da, 2.7);
  sun.castShadow = true;
  const size = quality === 'low' ? 1024 : 2048;
  sun.shadow.mapSize.set(size, size);
  const cam = sun.shadow.camera;
  cam.left = -28; cam.right = 28; cam.top = 28; cam.bottom = -28;
  cam.near = 1; cam.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  const focus = new THREE.Vector3();
  function follow(target) {
    focus.copy(target);
    // Snap to a grid of shadow texels to stop shimmering as the player moves.
    const texel = (cam.right - cam.left) / size;
    focus.x = Math.round(focus.x / texel) * texel;
    focus.z = Math.round(focus.z / texel) * texel;
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(SUN_DIRECTION, 70);
  }
  follow(new THREE.Vector3(0, 0, 0));
  return { hemi, sun, follow };
}

// A sea of soft cumulus far below the islands, plus a few drifting clouds at
// island height. Each cloud is a cluster of squashed spheres in one InstancedMesh.
export function createClouds(scene, quality) {
  const rand = mulberry32(77);
  const puffs = [];
  const seaCount = quality === 'low' ? 70 : 150;
  for (let i = 0; i < seaCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = 10 + Math.sqrt(rand()) * 230;
    addCloud(puffs, rand, Math.cos(a) * r, -34 - rand() * 10, Math.sin(a) * r - 45, 5 + rand() * 7, 0.5 + rand() * 0.8);
  }
  const highCount = quality === 'low' ? 8 : 16;
  for (let i = 0; i < highCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = 70 + rand() * 120;
    addCloud(puffs, rand, Math.cos(a) * r, 5 + rand() * 35, Math.sin(a) * r - 45, 3 + rand() * 4, 1.5 + rand() * 1.5);
  }
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, emissive: 0xffe7d6, emissiveIntensity: 0.28 });
  const mesh = new THREE.InstancedMesh(geo, mat, puffs.length);
  mesh.name = 'clouds';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  puffs.forEach((p, i) => {
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s * p.flat, p.s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, new THREE.Color().setHSL(0.07, 0.4, 0.88 + rand() * 0.1));
  });
  mesh.frustumCulled = false;
  scene.add(mesh);

  // A soft floor under the cloud sea so there is never an empty void below.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(420, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf7e2d6, fog: true }),
  );
  floor.position.set(0, -42, -45);
  scene.add(floor);

  const group = { mesh, floor };
  return {
    ...group,
    update(t) {
      mesh.position.x = Math.sin(t * 0.02) * 6;
      mesh.position.z = Math.cos(t * 0.017) * 4;
    },
  };
}

function addCloud(puffs, rand, x, y, z, size, flat) {
  const n = 4 + Math.floor(rand() * 4);
  for (let k = 0; k < n; k++) {
    const s = size * (0.45 + rand() * 0.55);
    puffs.push({
      x: x + (rand() - 0.5) * size * 2.2,
      y: y + rand() * size * 0.35,
      z: z + (rand() - 0.5) * size * 1.4,
      s,
      flat: 0.55 + rand() * 0.2 * flat,
    });
  }
}

// Floating pollen around the camera. A tiny ShaderMaterial draws round soft points.
export function createMotes(scene, quality) {
  const count = quality === 'low' ? 0 : 260;
  if (!count) return { update() {}, points: null };
  const rand = mulberry32(5);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 60;
    pos[i * 3 + 1] = (rand() - 0.5) * 30;
    pos[i * 3 + 2] = (rand() - 0.5) * 60;
    seed[i] = rand() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCenter; attribute float aSeed; varying float vA;
      void main() {
        vec3 p = position;
        p += vec3(sin(uTime * 0.3 + aSeed), sin(uTime * 0.21 + aSeed * 1.7) * 0.6, cos(uTime * 0.27 + aSeed)) * 1.5;
        // Wrap motes into a 60x30x60 box centred on the camera.
        p = uCenter + mod(p - uCenter + vec3(30.0, 15.0, 30.0), vec3(60.0, 30.0, 60.0)) - vec3(30.0, 15.0, 30.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 70.0 / -mv.z;
        vA = 0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 3.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * (0.25 + 0.45 * vA);
        gl_FragColor = vec4(1.0, 0.93, 0.75, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return {
    points,
    update(t, center) {
      uniforms.uTime.value = t;
      if (center) uniforms.uCenter.value.copy(center);
    },
  };
}
