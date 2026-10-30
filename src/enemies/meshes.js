// Procedural enemy models. Each builder returns a Group with an `animate(e, t, dt)`
// in userData that poses the model from the AI state.
import * as THREE from 'three';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildMossback() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  const shellMat = std(0x4f7d3c, { roughness: 0.85 });
  const shell = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.7, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), shellMat));
  shell.scale.set(1, 0.85, 1.2);
  shell.position.y = 0.45;
  body.add(shell);
  // Mossy tufts and a few tiny flowers growing on the shell.
  const mossMat = std(0x86c35a, { roughness: 0.9 });
  const flowerMat = std(0xffe27a, { emissive: 0x443300, emissiveIntensity: 0.3 });
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, el = 0.35 + (i % 3) * 0.3;
    const tuft = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.16 + (i % 2) * 0.05, 10, 8), i === 4 ? flowerMat : mossMat));
    tuft.position.set(Math.cos(a) * Math.sin(el) * 0.68, 0.45 + Math.cos(el) * 0.58, Math.sin(a) * Math.sin(el) * 0.82);
    tuft.scale.y = 0.6;
    body.add(tuft);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 32).rotateX(Math.PI / 2), std(0x3b5c2e));
  rim.scale.set(1, 1.2, 1);
  rim.position.y = 0.45;
  body.add(rim);
  const belly = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 10), std(0xe2c095)));
  belly.scale.set(1, 0.42, 1.15);
  belly.position.y = 0.42;
  body.add(belly);

  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.8);
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), std(0x6b4f3a)));
  skull.scale.set(1.05, 0.85, 0.9);
  head.add(skull);
  const eyeMat = std(0xffd36b, { emissive: 0xffa31a, emissiveIntensity: 1.6 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), eyeMat);
    eye.position.set(s * 0.15, 0.08, 0.27);
    head.add(eye);
    const horn = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), std(0xf3e6cc)));
    horn.position.set(s * 0.2, -0.08, 0.26);
    horn.rotation.set(Math.PI / 2.4, 0, -s * 0.5);
    head.add(horn);
  }
  body.add(head);

  const legs = [];
  const legMat = std(0x4a3628);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.5, 0.3, sz * 0.42);
      const leg = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 8), legMat));
      leg.position.y = -0.18;
      pivot.add(leg);
      pivot.userData.phase = sx * sz > 0 ? 0 : Math.PI;
      body.add(pivot);
      legs.push(pivot);
    }
  }

  let gait = 0;
  g.userData.animate = (e, t, dt) => {
    g.position.copy(e.pos);
    g.rotation.y = e.yaw;
    const speed = e.mode === 'charge' ? 3.2 : e.mode === 'patrol' ? 1 : 0;
    gait += dt * 9 * speed;
    for (const leg of legs) leg.rotation.x = Math.sin(gait + leg.userData.phase) * 0.6 * Math.min(speed, 1);
    let hop = Math.abs(Math.sin(gait)) * 0.04 * Math.min(speed, 1);
    let lean = 0;
    if (e.mode === 'alert') {
      hop = Math.abs(Math.sin(e.timer * 18)) * 0.12; // paws the ground
      lean = -0.12;
    } else if (e.mode === 'charge') {
      lean = 0.18;
    } else if (e.mode === 'recover') {
      lean = Math.sin(e.timer * 10) * 0.08 * (1 - e.timer); // dizzy wobble
    }
    body.position.y = hop;
    body.rotation.x = lean;
    const angry = e.mode === 'alert' || e.mode === 'charge';
    eyeMat.emissive.setHex(angry ? 0xff2a1a : 0xffa31a);
    eyeMat.color.setHex(angry ? 0xff6b5a : 0xffd36b);
  };
  return g;
}

export function buildWisp() {
  const g = new THREE.Group();
  const coreMat = std(0x2c1a45, { emissive: 0x4a1f7a, emissiveIntensity: 0.8, roughness: 0.35 });
  const core = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), coreMat));
  g.add(core);
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x9a5cff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 12), haloMat);
  g.add(halo);
  const eye = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), std(0xfff6ff, { emissive: 0xffd6ff, emissiveIntensity: 0.5 }));
  const pupilMat = std(0x9a5cff, { emissive: 0xc58cff, emissiveIntensity: 2 });
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), pupilMat);
  pupil.position.z = 0.14;
  eye.add(white, pupil);
  eye.position.set(0, 0.05, 0.36);
  g.add(eye);
  // Ears: two swept-back points.
  for (const s of [-1, 1]) {
    const ear = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 8), coreMat));
    ear.position.set(s * 0.25, 0.38, -0.05);
    ear.rotation.set(-0.5, 0, -s * 0.45);
    g.add(ear);
  }
  // Wispy tail: a chain of shrinking orbs that trails behind with a sway.
  const tail = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.3 * (1 - i / 7);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), i % 2 ? coreMat : std(0x3d2460, { emissive: 0x6b2fb0, emissiveIntensity: 0.9 }));
    g.add(orb);
    tail.push(orb);
  }
  g.userData.animate = (e, t) => {
    g.position.copy(e.pos);
    g.rotation.y = e.yaw;
    const wind = e.mode === 'windup';
    const k = wind ? Math.min(1, e.timer / 0.75) : 0;
    halo.scale.setScalar(1 + k * 0.6 + Math.sin(t * 5) * 0.05);
    haloMat.opacity = 0.22 + k * 0.35;
    haloMat.color.setHex(wind || e.mode === 'swoop' ? 0xff4fa3 : 0x9a5cff);
    pupilMat.emissive.setHex(wind || e.mode === 'swoop' ? 0xff3d8b : 0xc58cff);
    core.scale.setScalar(1 + Math.sin(t * 3) * 0.04 - k * 0.1);
    tail.forEach((orb, i) => {
      const d = (i + 1) * 0.28;
      orb.position.set(Math.sin(t * 3 - i * 0.7) * 0.12 * (i + 1) * 0.5, -0.1 - i * 0.06 + Math.cos(t * 2.5 - i) * 0.05, -0.25 - d);
    });
  };
  return g;
}

export function buildPuffcap() {
  const g = new THREE.Group();
  const stem = shadowed(new THREE.Mesh(
    new THREE.LatheGeometry([0.5, 0.42, 0.36, 0.38, 0.46].map((r, i) => new THREE.Vector2(r, i * 0.24)), 20),
    std(0xf1e4cf, { roughness: 0.8 }),
  ));
  g.add(stem);
  const face = new THREE.Group();
  face.position.set(0, 0.55, 0.38);
  const dark = std(0x2b1d2e);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), dark);
    eye.position.set(s * 0.13, 0.08, 0);
    eye.scale.set(1, 1.4, 0.5);
    face.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 16), dark);
  mouth.position.set(0, -0.1, 0);
  face.add(mouth);
  g.add(face);
  const capGeo = new THREE.SphereGeometry(0.85, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  capGeo.scale(1, 0.75, 1);
  const capMat = std(0x8a52d8, { roughness: 0.45, emissive: 0x2a0d50, emissiveIntensity: 0.4 });
  const cap = shadowed(new THREE.Mesh(capGeo, capMat));
  cap.position.y = 0.95;
  const spotMat = std(0xf5ff7a, { emissive: 0xc6ff3a, emissiveIntensity: 0.9 });
  for (let i = 0; i < 8; i++) {
    const a = i * 2.39, el = 0.3 + (i % 3) * 0.32;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), spotMat);
    spot.position.set(Math.cos(a) * Math.sin(el) * 0.84, Math.cos(el) * 0.62, Math.sin(a) * Math.sin(el) * 0.84);
    spot.scale.y = 0.4;
    cap.add(spot);
  }
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.85, 28).rotateX(Math.PI / 2), std(0xd9c2ff, { side: THREE.DoubleSide }));
  cap.add(under);
  g.add(cap);
  g.userData.animate = (e, t) => {
    g.position.copy(e.pos);
    g.rotation.y = e.yaw;
    const k = e.mode === 'charging' ? Math.min(1, e.timer / 0.6) : 0;
    const breathe = Math.sin(t * 2) * 0.03;
    cap.scale.set(1 + k * 0.25 + breathe, 1 + k * 0.35 - breathe, 1 + k * 0.25 + breathe);
    mouth.scale.setScalar(1 + k * 1.2);
    spotMat.emissiveIntensity = 0.9 + k * 2;
  };
  return g;
}

export function buildSpore() {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.3, 2),
    std(0xd8ff6a, { emissive: 0x9fe02a, emissiveIntensity: 1.8, roughness: 0.3 }),
  );
  mesh.castShadow = true;
  return mesh;
}

// A soft violet puff where an enemy is defeated.
export function buildPoof() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mat);
    const a = (i / 7) * Math.PI * 2;
    m.userData.dir = new THREE.Vector3(Math.cos(a), 0.4 + (i % 3) * 0.3, Math.sin(a));
    group.add(m);
    puffs.push(m);
  }
  group.visible = false;
  group.userData = { mat, puffs, t: 1 };
  return group;
}
