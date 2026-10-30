// Pip, built entirely from code: a rig of nested groups animated procedurally.
// The rig is driven by `animate(dt, motion)` where motion comes from the controller.
import * as THREE from 'three';

export const PALETTE = {
  body: 0xf4efe6,
  hood: 0x3cc8c0,
  hoodDark: 0x2a9d97,
  scarf: 0xff7a59,
  scarfTip: 0xffb347,
  eye: 0x1d1b2e,
  cheek: 0xff9aa2,
  shard: 0x6ff6ff,
};

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });
}

// A teardrop/egg body from a lathe so Pip has a soft, rounded silhouette.
function eggGeometry(radius, height, segments = 32) {
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -Math.PI / 2 + t * Math.PI;
    // Wider at the bottom, narrower at the top.
    const r = Math.cos(a) * radius * (1 - 0.18 * t);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), (Math.sin(a) * 0.5 + 0.5) * height));
  }
  return new THREE.LatheGeometry(pts, segments);
}

// Hood "ear" that curls back: a tapered tube along a bezier curve.
function earGeometry(side) {
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06 * side, 0.2, 0.04),
    new THREE.Vector3(0.16 * side, 0.32, 0.2),
    new THREE.Vector3(0.22 * side, 0.22, 0.42),
  );
  const geo = new THREE.TubeGeometry(curve, 16, 0.09, 12, false);
  // Taper the tube toward its tip.
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const segs = 16, radial = 12;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const s = lerp(1, 0.25, t);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(s).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export class PipModel {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'Pip';
    this.materials = [];
    const M = (c, e) => { const m = mat(c, e); this.materials.push(m); return m; };

    const bodyMat = M(PALETTE.body, { roughness: 0.55 });
    const hoodMat = M(PALETTE.hood, { roughness: 0.5 });
    const hoodDark = M(PALETTE.hoodDark, { roughness: 0.6 });
    const eyeMat = M(PALETTE.eye, { roughness: 0.25 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const cheekMat = M(PALETTE.cheek, { roughness: 0.8, transparent: true, opacity: 0.75 });
    this.scarfMat = M(PALETTE.scarf, { roughness: 0.7, side: THREE.DoubleSide });
    this.shardMat = M(PALETTE.shard, { emissive: PALETTE.shard, emissiveIntensity: 1.6, roughness: 0.2 });
    this.materials.push(shineMat);

    // Rig: root (world placement + facing) > squash (scale) > hips (bob/tilt) > body, head...
    this.squash = new THREE.Group();
    this.root.add(this.squash);
    this.hips = new THREE.Group();
    this.squash.add(this.hips);

    const body = new THREE.Mesh(eggGeometry(0.34, 0.62), bodyMat);
    body.position.y = 0.12;
    this.hips.add(body);
    this.body = body;

    // Hood covers the back and top of the head.
    this.head = new THREE.Group();
    this.head.position.y = 0.7;
    this.hips.add(this.head);
    // The hood is the head's outer shell; the face is a cream oval pushed out of its front.
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.335, 40, 28), hoodMat);
    hood.scale.set(1.05, 0.98, 1.02);
    this.head.add(hood);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 28), bodyMat);
    face.scale.set(0.82, 0.74, 0.55);
    face.position.set(0, -0.025, -0.2);
    this.head.add(face);
    // A soft rim where the hood opening meets the face.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.03, 12, 48), hoodDark);
    rim.scale.set(1.04, 0.93, 1);
    rim.position.set(0, -0.025, -0.255);
    this.head.add(rim);
    // Tuft on top of the hood.
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 12), hoodMat);
    tuft.position.set(0, 0.34, -0.02);
    tuft.rotation.x = -0.4;
    this.head.add(tuft);

    this.ears = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.16 * side, 0.22, 0.04);
      pivot.rotation.z = -0.25 * side;
      const ear = new THREE.Mesh(earGeometry(side), hoodMat);
      pivot.add(ear);
      this.head.add(pivot);
      this.ears.push({ pivot, side, base: pivot.rotation.clone() });
    }

    // Eyes: tall ovals with a highlight, set on the face's front.
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(0.1 * side, 0.0, -0.345);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), eyeMat);
      ball.scale.set(0.85, 1.3, 0.5);
      eye.add(ball);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), shineMat);
      shine.position.set(0.012 * side, 0.025, -0.02);
      eye.add(shine);
      eye.rotation.y = 0.3 * side;
      this.head.add(eye);
      this.eyes.push(eye);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), cheekMat);
      cheek.position.set(0.155 * side, -0.085, -0.322);
      cheek.rotation.y = Math.PI + 0.55 * side;
      this.head.add(cheek);
    }

    // Glowing shard on the chest.
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), this.shardMat);
    shard.scale.set(0.8, 1.3, 0.5);
    shard.position.set(0, 0.36, -0.29);
    this.hips.add(shard);
    this.shard = shard;

    // Stubby arms.
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.3 * side, 0.42, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 6, 12), bodyMat);
      arm.position.y = -0.1;
      shoulder.add(arm);
      shoulder.rotation.z = 0.35 * side;
      this.hips.add(shoulder);
      this.arms.push({ shoulder, side });
    }

    // Feet sit under the root so they can plant while the body bobs.
    this.feet = [];
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), hoodDark);
      foot.scale.set(0.9, 0.6, 1.3);
      foot.position.set(0.14 * side, 0.06, 0);
      this.squash.add(foot);
      this.feet.push({ mesh: foot, side });
    }

    // Scarf: a knot at the neck plus a ribbon tail simulated as a verlet chain in world space.
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.06, 10, 32), this.scarfMat);
    knot.rotation.x = Math.PI / 2;
    knot.position.y = 0.55;
    knot.scale.set(1, 1, 1.2);
    this.hips.add(knot);
    this.scarfAnchor = new THREE.Object3D();
    this.scarfAnchor.position.set(0.12, 0.55, 0.22);
    this.hips.add(this.scarfAnchor);
    this.scarfCount = 9;
    this.scarfSeg = 0.11;
    this.scarfPts = Array.from({ length: this.scarfCount }, () => ({ p: new THREE.Vector3(), o: new THREE.Vector3() }));
    this.scarfInit = false;
    // Two crossed ribbons (flat and upright) so the tail reads from any camera angle.
    const ribbon = new THREE.BufferGeometry();
    const n = this.scarfCount;
    const verts = new Float32Array(n * 4 * 3);
    ribbon.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const colors = new Float32Array(n * 4 * 3);
    const a = new THREE.Color(PALETTE.scarf), b = new THREE.Color(PALETTE.scarfTip), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.copy(a).lerp(b, i / (n - 1));
      for (let k = 0; k < 2; k++) colors.set([c.r, c.g, c.b, c.r, c.g, c.b], (k * n + i) * 6);
    }
    ribbon.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const idx = [];
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < n - 1; i++) {
        const q = (k * n + i) * 2;
        idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
      }
    }
    ribbon.setIndex(idx);
    this.ribbonMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    this.materials.push(this.ribbonMat);
    this.ribbon = new THREE.Mesh(ribbon, this.ribbonMat);
    this.ribbon.frustumCulled = false;
    this.ribbon.castShadow = true;

    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

    // Animation state.
    this.time = 0;
    this.runPhase = 0;
    this.squashY = 1;
    this.squashV = 0;
    this.lean = 0;
    this.spin = 0;
    this.blink = 0;
    this.nextBlink = 2;
    this.tilt = 0;
  }

  // Called by Player after the model is added to the scene, since the scarf lives in world space.
  attachScarf(scene) {
    scene.add(this.ribbon);
  }

  // Kick the squash spring: >1 stretches tall, <1 squashes flat.
  impulse(amount) {
    this.squashV += amount;
  }

  startSpin() {
    this.spin = Math.PI * 2;
  }

  animate(dt, m) {
    // m: { position, facing, speed, vy, grounded, state, runSpeed, invulnerable, dashing, pounding }
    this.time += dt;
    const t = this.time;
    const root = this.root;
    root.position.copy(m.position);
    root.rotation.y = m.facing;

    // Squash & stretch: a damped spring around 1, plus stretch along vertical speed in the air.
    const k = 260, c = 16;
    this.squashV += (-(this.squashY - 1) * k - this.squashV * c) * dt;
    this.squashY += this.squashV * dt;
    let sy = this.squashY;
    if (!m.grounded && m.state !== 'pound') sy *= 1 + Math.min(Math.abs(m.vy) * 0.012, 0.18);
    if (m.dashing) sy *= 0.82;
    sy = THREE.MathUtils.clamp(sy, 0.55, 1.5);
    const sxz = 1 / Math.sqrt(sy);
    this.squash.scale.set(sxz, sy, m.dashing ? sxz * 1.25 : sxz);

    const speed01 = Math.min(m.speed / m.runSpeed, 1.2);
    const moving = m.grounded && speed01 > 0.05;
    if (moving) this.runPhase += dt * (6 + 9 * speed01);
    const ph = this.runPhase;

    // Body bob and lean into motion.
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.07 * speed01 : Math.sin(t * 2.2) * 0.012;
    this.hips.position.y = 0.08 + bob;
    const targetLean = m.dashing ? 0.55 : m.grounded ? speed01 * 0.22 : -m.vy * 0.012;
    this.lean = damp(this.lean, targetLean, 12, dt);
    this.hips.rotation.x = -this.lean;
    this.hips.rotation.z = moving ? Math.sin(ph) * 0.06 * speed01 : 0;

    // Flip during the double jump and wind-up of ground pound.
    if (this.spin > 0) {
      this.spin = Math.max(0, this.spin - dt * 18);
      this.hips.rotation.x -= this.spin;
    }

    // Feet: alternate stride on the ground, tuck in the air.
    for (const f of this.feet) {
      const s = f.side;
      if (moving) {
        const a = ph + (s > 0 ? Math.PI : 0);
        f.mesh.position.z = Math.cos(a) * 0.16 * speed01;
        f.mesh.position.y = 0.06 + Math.max(0, Math.sin(a)) * 0.12 * speed01;
      } else if (!m.grounded) {
        f.mesh.position.z = damp(f.mesh.position.z, m.state === 'pound' ? 0 : 0.06 * s, 10, dt);
        f.mesh.position.y = damp(f.mesh.position.y, m.state === 'pound' ? 0.02 : 0.14, 10, dt);
      } else {
        f.mesh.position.z = damp(f.mesh.position.z, 0, 14, dt);
        f.mesh.position.y = damp(f.mesh.position.y, 0.06, 14, dt);
      }
    }

    // Arms swing opposite the feet; raised in the air; tucked while dashing/pounding.
    for (const a of this.arms) {
      const s = a.side;
      let rx = 0, rz = 0.35 * s;
      if (moving) rx = Math.cos(ph + (s > 0 ? 0 : Math.PI)) * 0.9 * speed01;
      else if (!m.grounded) { rz = (1.4 + Math.sin(t * 20) * 0.08) * s; rx = -0.3; }
      else rz = (0.35 + Math.sin(t * 2.2) * 0.05) * s;
      if (m.dashing) { rx = 1.3; rz = 0.2 * s; }
      if (m.state === 'pound') { rx = -0.4; rz = 2.4 * s; }
      a.shoulder.rotation.x = damp(a.shoulder.rotation.x, rx, 16, dt);
      a.shoulder.rotation.z = damp(a.shoulder.rotation.z, rz, 16, dt);
    }

    // Head: slight counter-bob, look tilt, ears trail with motion.
    this.tilt = damp(this.tilt, m.grounded ? 0 : THREE.MathUtils.clamp(m.vy * 0.02, -0.25, 0.25), 8, dt);
    this.head.rotation.x = this.lean * 0.4 + this.tilt;
    this.head.rotation.z = Math.sin(t * 1.3) * 0.03;
    for (const e of this.ears) {
      const flop = (moving ? Math.sin(ph * 2) * 0.12 : Math.sin(t * 2 + e.side) * 0.05) + this.lean * 0.6 + (m.grounded ? 0 : m.vy * 0.025);
      e.pivot.rotation.x = e.base.x - flop;
      e.pivot.rotation.z = e.base.z - 0.06 * e.side * Math.sin(t * 3 + e.side);
    }

    // Blinking.
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0.12; this.nextBlink = 2 + Math.random() * 3; }
    this.blink = Math.max(0, this.blink - dt);
    const eyeY = this.blink > 0 ? 0.15 : m.state === 'hurt' ? 0.4 : 1;
    for (const e of this.eyes) e.scale.y = damp(e.scale.y, eyeY, 30, dt);

    // Chest shard pulses.
    this.shard.rotation.y = t * 2;
    this.shardMat.emissiveIntensity = 1.3 + Math.sin(t * 4) * 0.4 + (m.dashing ? 1.5 : 0);

    // Blink the whole model while invulnerable.
    this.root.visible = !m.invulnerable || Math.floor(t * 16) % 2 === 0;
    this.ribbon.visible = this.root.visible;

    this._updateScarf(dt, m);
  }

  _updateScarf(dt, m) {
    this.root.updateMatrixWorld(true);
    const anchor = this.scarfAnchor.getWorldPosition(_v1);
    const pts = this.scarfPts;
    if (!this.scarfInit) {
      const back = _v2.set(Math.sin(m.facing), 0, Math.cos(m.facing));
      pts.forEach((pt, i) => { pt.p.copy(anchor).addScaledVector(back, i * this.scarfSeg); pt.o.copy(pt.p); });
      this.scarfInit = true;
    }
    const h = Math.min(dt, 1 / 30);
    const back = _v5.set(Math.sin(m.facing), 0, Math.cos(m.facing));
    const wind = _v3.set(Math.sin(this.time * 1.7) * 0.6, 0.15, Math.cos(this.time * 1.3) * 0.6);
    pts[0].p.copy(anchor);
    pts[0].o.copy(anchor);
    for (let i = 1; i < pts.length; i++) {
      const pt = pts[i];
      const vel = _v2.copy(pt.p).sub(pt.o).multiplyScalar(0.94);
      pt.o.copy(pt.p);
      pt.p.add(vel).addScaledVector(wind, h * h * 10).y -= 3.5 * h * h;
      // Rest pose drifts up and back, like it's caught in the sky breeze.
      pt.p.addScaledVector(back, h * h * 30).y += h * h * 5;
    }
    // Distance constraints, a few iterations.
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1].p, b = pts[i].p;
        const d = _v2.copy(b).sub(a);
        const len = d.length() || 1e-6;
        const diff = (len - this.scarfSeg) / len;
        if (i === 1) b.addScaledVector(d, -diff);
        else { a.addScaledVector(d, diff * 0.5); b.addScaledVector(d, -diff * 0.5); }
      }
      // Keep the tail from passing through Pip's body.
      const center = _v4.copy(m.position); center.y += 0.42;
      for (let i = 1; i < pts.length; i++) {
        const d = _v2.copy(pts[i].p).sub(center);
        const len = d.length();
        if (len < 0.4) pts[i].p.copy(center).addScaledVector(d, 0.4 / (len || 1e-6));
        if (pts[i].p.y < m.position.y + 0.04) pts[i].p.y = m.position.y + 0.04;
      }
    }
    // Build the ribbon: width across the scarf, perpendicular to its direction and the up axis.
    const pos = this.ribbon.geometry.attributes.position;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i].p;
      const next = pts[Math.min(i + 1, n - 1)].p, prev = pts[Math.max(i - 1, 0)].p;
      const dir = _v2.copy(next).sub(prev).normalize();
      const flat = _v4.crossVectors(dir, _up);
      if (flat.lengthSq() < 1e-6) flat.set(1, 0, 0);
      flat.normalize();
      const upright = _v3.crossVectors(flat, dir).normalize();
      const w = 0.085 * (1 - (i / n) * 0.35);
      pos.setXYZ(i * 2, p.x + flat.x * w, p.y + flat.y * w, p.z + flat.z * w);
      pos.setXYZ(i * 2 + 1, p.x - flat.x * w, p.y - flat.y * w, p.z - flat.z * w);
      const j = (n + i) * 2;
      pos.setXYZ(j, p.x + upright.x * w, p.y + upright.y * w, p.z + upright.z * w);
      pos.setXYZ(j + 1, p.x - upright.x * w, p.y - upright.y * w, p.z - upright.z * w);
    }
    pos.needsUpdate = true;
    this.ribbon.geometry.computeVertexNormals();
  }

  resetScarf() {
    this.scarfInit = false;
  }

  dispose() {
    this.root.traverse((o) => o.geometry?.dispose());
    this.ribbon.geometry.dispose();
    this.ribbon.removeFromParent();
    this.materials.forEach((m) => m.dispose());
  }
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
