// Pooled particle effects for Pip: dust puffs, sparkles, a dash trail and the ground-pound shockwave.
import * as THREE from 'three';

const MAX = 160;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.parts = [];

    // Expanding ring for ground pound landings.
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
    this.ringT = 0;

    // Blob shadow so depth is readable when jumping (real shadows can be off on low quality).
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x1b1440, transparent: true, opacity: 0.35, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), this.shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    scene.add(this.shadow);
  }

  spawn({ pos, vel, life = 0.5, size = 0.2, grow = 1, color = 0xffffff, gravity = 0, drag = 2 }) {
    if (this.parts.length >= MAX) this.parts.shift();
    this.parts.push({ pos: pos.clone(), vel: vel.clone(), life, max: life, size, grow, color: new THREE.Color(color), gravity, drag });
  }

  dust(at, count = 8, strength = 2.5, color = 0xf6f0e4) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const v = new THREE.Vector3(Math.cos(a) * strength, 0.6 + Math.random() * 0.8, Math.sin(a) * strength);
      this.spawn({ pos: at.clone().add(new THREE.Vector3(0, 0.08, 0)), vel: v, life: 0.35 + Math.random() * 0.25, size: 0.14 + Math.random() * 0.08, grow: 2.2, color, drag: 5 });
    }
  }

  sparkle(at, count = 10, color = 0x6ff6ff) {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 2);
      this.spawn({ pos: at.clone(), vel: v, life: 0.45, size: 0.09, grow: 0, color, gravity: -4, drag: 3 });
    }
  }

  trail(at, color = 0x7ff3ff) {
    const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3);
    this.spawn({ pos: at.clone().add(jitter), vel: new THREE.Vector3(0, 0.3, 0), life: 0.35, size: 0.24, grow: -0.6, color, drag: 1 });
  }

  shockwave(at) {
    this.ring.position.copy(at).y += 0.05;
    this.ringT = 0.45;
    this.ring.visible = true;
    this.dust(at, 18, 6, 0xffffff);
    this.sparkle(at.clone().add(new THREE.Vector3(0, 0.2, 0)), 12);
  }

  // groundY: height of the surface under Pip, or null when there is nothing below.
  update(dt, playerPos, groundY) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.vel.y += p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
    }
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const t = 1 - p.life / p.max; // 0..1
      const s = Math.max(0.001, p.size * (1 + p.grow * t) * (1 - t * t));
      _m.compose(p.pos, _q, _s.set(s, s, s));
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.copy(p.color));
    }
    this.mesh.count = ps.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    if (this.ringT > 0) {
      this.ringT -= dt;
      const t = 1 - this.ringT / 0.45;
      const r = 0.5 + t * 3.2;
      this.ring.scale.set(r, r, r);
      this.ringMat.opacity = 0.8 * (1 - t);
      if (this.ringT <= 0) this.ring.visible = false;
    }

    if (groundY == null) {
      this.shadow.visible = false;
    } else {
      const h = Math.max(0, playerPos.y - groundY);
      this.shadow.visible = true;
      this.shadow.position.set(playerPos.x, groundY + 0.02, playerPos.z);
      const s = THREE.MathUtils.clamp(1 - h * 0.06, 0.45, 1);
      this.shadow.scale.set(s, s, s);
      this.shadowMat.opacity = 0.38 * THREE.MathUtils.clamp(1 - h * 0.05, 0.25, 1);
    }
  }

  dispose() {
    for (const o of [this.mesh, this.ring, this.shadow]) {
      o.removeFromParent();
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}
