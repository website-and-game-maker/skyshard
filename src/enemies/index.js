import * as THREE from 'three';
import {
  createMossback, updateMossback, mossbackBody, MOSSBACK,
  createWisp, updateWisp, wispBody, WISP,
  createPuffcap, updatePuffcap, puffcapBody, PUFFCAP, updateProjectile,
} from './ai.js';
import { touchesSphere, isStomp, knockbackFrom, touchesHazard } from './combat.js';
import { buildMossback, buildWisp, buildPuffcap, buildSpore, buildPoof } from './meshes.js';

const KINDS = {
  mossback: { create: createMossback, step: updateMossback, body: mossbackBody, radius: MOSSBACK.radius, build: buildMossback },
  gloomwisp: { create: createWisp, step: updateWisp, body: wispBody, radius: WISP.radius, build: buildWisp },
  puffcap: { create: createPuffcap, step: updatePuffcap, body: puffcapBody, radius: PUFFCAP.radius, build: buildPuffcap },
};

const MAX_SPORES = 12;

export function createEnemies({ scene, level } = {}) {
  const root = new THREE.Group();
  root.name = 'enemies';
  scene.add(root);
  const spawns = level?.enemySpawns ?? [];
  const colliders = level?.colliders ?? [];

  const enemies = spawns.map((spawn) => {
    const kind = KINDS[spawn.kind];
    const mesh = kind.build();
    root.add(mesh);
    return { spawn, kind, mesh, state: kind.create(spawn) };
  });

  const spores = Array.from({ length: MAX_SPORES }, () => {
    const mesh = buildSpore();
    mesh.visible = false;
    root.add(mesh);
    return { mesh, p: null };
  });

  const poofs = Array.from({ length: 4 }, () => {
    const g = buildPoof();
    root.add(g);
    return g;
  });
  let nextPoof = 0;
  const poof = (pos) => {
    const g = poofs[nextPoof];
    nextPoof = (nextPoof + 1) % poofs.length;
    g.position.copy(pos);
    g.visible = true;
    g.userData.t = 0;
  };

  const body = new THREE.Vector3();
  let time = 0;

  return {
    root,
    get list() {
      return enemies.map((e) => e.state);
    },

    update(dt = 0, player = null) {
      const events = [];
      time += dt;
      let hurt = null;
      let stomped = false;

      for (const e of enemies) {
        const s = e.state;
        if (!s.alive) continue;
        const shot = e.kind.step(s, dt, player);
        if (shot) {
          const slot = spores.find((sp) => !sp.p);
          if (slot) slot.p = shot;
        }
        if (!player || stomped) continue;
        e.kind.body(s, body);
        if (!touchesSphere(player, body, e.kind.radius)) continue;
        if (isStomp(player, body)) {
          s.alive = false;
          stomped = true;
          poof(body);
          events.push({ type: 'stomp', kind: s.kind, position: body.clone() });
        } else if (!player.invulnerable && !hurt) {
          hurt = knockbackFrom(body, player);
          if (s.kind === 'mossback' && s.mode === 'charge') {
            s.mode = 'recover'; // bonk: it stops after hitting Pip
            s.timer = 0;
          }
        }
      }

      for (const sp of spores) {
        if (!sp.p) continue;
        updateProjectile(sp.p, dt, colliders);
        if (sp.p.alive && player && !player.invulnerable && !hurt && touchesSphere(player, sp.p.pos, PUFFCAP.projectileRadius)) {
          hurt = knockbackFrom(sp.p.pos, player);
          sp.p.alive = false;
        }
        if (!sp.p.alive) {
          poof(sp.p.pos);
          sp.p = null;
        }
      }

      if (player && !player.invulnerable && !hurt) {
        for (const c of colliders) {
          if (c.hazard && touchesHazard(player, c)) {
            hurt = knockbackFrom(c.box.getCenter(new THREE.Vector3()), player);
            break;
          }
        }
      }
      if (hurt) events.push({ type: 'hurt', knockback: hurt });

      animate(dt);
      return events;
    },

    reset() {
      for (const e of enemies) e.state = e.kind.create(e.spawn);
      for (const sp of spores) sp.p = null;
      for (const g of poofs) g.visible = false;
      animate(0);
    },

    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => m.dispose());
      });
    },
  };

  function animate(dt) {
    for (const e of enemies) {
      e.mesh.visible = e.state.alive;
      if (e.state.alive) e.mesh.userData.animate(e.state, time, dt);
    }
    for (const sp of spores) {
      sp.mesh.visible = !!sp.p;
      if (sp.p) {
        sp.mesh.position.copy(sp.p.pos);
        sp.mesh.rotation.y += dt * 4;
        sp.mesh.scale.setScalar(1 + Math.sin(time * 14) * 0.08);
      }
    }
    for (const g of poofs) {
      if (!g.visible) continue;
      const u = g.userData;
      u.t += dt * 2;
      if (u.t >= 1) {
        g.visible = false;
        continue;
      }
      u.mat.opacity = 0.9 * (1 - u.t);
      for (const m of u.puffs) {
        m.position.copy(m.userData.dir).multiplyScalar(u.t * 1.4);
        m.scale.setScalar(0.6 + u.t * 1.2);
      }
    }
  }
}
