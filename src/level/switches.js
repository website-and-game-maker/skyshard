// Rune plates and the slabs they raise. A plate only reacts to a ground pound that
// lands on it; it then lights up and its hidden slabs rise into place and become solid.
import * as THREE from 'three';
import { boxCollider } from './colliders.js';
import { roundedSlabGeometry } from './props.js';

const PLATE_HEIGHT = 0.25;
const RISE_TIME = 0.9; // seconds for a raised slab to float up and fade in
const RISE_DROP = 2.5; // how far below its resting place a slab starts
const STAGGER = 0.25; // delay between consecutive slabs

function buildPlate(radius) {
  const group = new THREE.Group();
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.08, PLATE_HEIGHT, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a8fb5, roughness: 0.75 }),
  );
  stone.position.y = -PLATE_HEIGHT / 2;
  stone.castShadow = true;
  stone.receiveShadow = true;
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0xffd36e, emissive: 0xffb02e, emissiveIntensity: 1.2, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.55, radius * 0.75, 6).rotateX(-Math.PI / 2), runeMat);
  ring.position.y = 0.01;
  const star = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.28, 4).rotateX(-Math.PI / 2), runeMat);
  star.position.y = 0.012;
  group.add(stone, ring, star);
  group.userData = { ring, star, runeMat };
  return group;
}

function buildSlab([w, h, d]) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9d4ff, roughness: 0.5, emissive: 0x5a7cff, emissiveIntensity: 0.25, transparent: true,
  });
  const mesh = new THREE.Mesh(roundedSlabGeometry(w, h, d, 0.2), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.mat = mat;
  return mesh;
}

// Pure state for one hidden slab: null until raised, then the time since it started rising.
export function slabRise(timer) {
  if (timer === null) return { solid: false, opacity: 0, drop: RISE_DROP };
  const k = Math.min(1, Math.max(0, timer / RISE_TIME));
  const ease = 1 - (1 - k) * (1 - k);
  return { solid: k >= 0.6, opacity: ease, drop: (1 - ease) * RISE_DROP };
}

// Did a pound that landed at `pos` hit this plate?
export function poundHits(plate, pos) {
  const dx = pos.x - plate.top[0], dz = pos.z - plate.top[2];
  return dx * dx + dz * dz <= (plate.radius + 0.35) ** 2 && Math.abs(pos.y - plate.top[1]) < 0.6;
}

export function createSwitches({ root, colliders, switches = [], platforms = [], setColliderPresent }) {
  const plates = switches.map((def) => {
    const mesh = buildPlate(def.radius);
    mesh.position.set(...def.top);
    root.add(mesh);
    colliders.push(boxCollider([def.top[0], def.top[1] - PLATE_HEIGHT / 2, def.top[2]], [def.radius * 1.5, PLATE_HEIGHT, def.radius * 1.5]));
    return { def, mesh, on: false, pulse: 0 };
  });

  const slabs = platforms.map((def) => {
    const mesh = buildSlab(def.size);
    root.add(mesh);
    const [w, h, d] = def.size;
    const collider = boxCollider([def.top[0], def.top[1] - h / 2, def.top[2]], [w, h, d]);
    colliders.push(collider);
    return { def, mesh, collider, timer: def.hiddenUntil ? null : RISE_TIME, solid: true };
  });

  function place(slab) {
    const r = slabRise(slab.timer);
    const [x, y, z] = slab.def.top;
    slab.mesh.position.set(x, y - r.drop, z);
    slab.mesh.visible = r.opacity > 0.01;
    slab.mesh.userData.mat.opacity = r.opacity;
    slab.mesh.userData.mat.transparent = r.opacity < 1;
    if (r.solid !== slab.solid) {
      slab.solid = r.solid;
      setColliderPresent(slab.collider, r.solid);
    }
  }

  const api = {
    // Called when a ground pound lands. Returns events for plates it switched on.
    pound(pos) {
      const events = [];
      for (const p of plates) {
        if (p.on || !poundHits(p.def, pos)) continue;
        p.on = true;
        p.pulse = 1;
        let k = 0;
        for (const s of slabs) {
          if (s.def.hiddenUntil === p.def.id && s.timer === null) s.timer = -STAGGER * k++;
        }
        events.push({ type: 'switch', id: p.def.id });
      }
      return events;
    },
    update(dt, t) {
      for (const s of slabs) {
        if (s.timer !== null && s.timer < RISE_TIME) s.timer += dt;
        place(s);
      }
      for (const p of plates) {
        const u = p.mesh.userData;
        p.pulse = Math.max(0, p.pulse - dt * 1.5);
        u.runeMat.emissiveIntensity = p.on ? 2.6 + p.pulse * 4 : 0.8 + Math.sin(t * 3) * 0.5;
        u.star.rotation.y = t * (p.on ? 1.5 : 0.4);
      }
    },
    reset() {
      for (const p of plates) { p.on = false; p.pulse = 0; }
      for (const s of slabs) {
        s.timer = s.def.hiddenUntil ? null : RISE_TIME;
        place(s);
      }
    },
  };
  api.reset();
  return api;
}
