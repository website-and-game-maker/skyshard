import * as THREE from 'three';
import {
  createMossback, updateMossback, mossbackBody, MOSSBACK,
  createWisp, updateWisp, wispBody, WISP,
  createPuffcap, updatePuffcap, puffcapBody, PUFFCAP, updateProjectile,
} from './ai.js';
import { touchesSphere, isStomp, knockbackFrom, touchesHazard } from './combat.js';
import { buildMossback, buildWisp, buildPuffcap, buildSpore, buildPoof, buildSpikeling, buildEmberbat, buildBoss, buildWave, buildOrb } from './meshes.js';
import { createBoss, updateBoss, bossBody, hitBoss, waveHits, BOSS } from './boss.js';

const KINDS = {
  mossback: { create: createMossback, step: updateMossback, body: mossbackBody, radius: MOSSBACK.radius, build: buildMossback },
  gloomwisp: { create: createWisp, step: updateWisp, body: wispBody, radius: WISP.radius, build: buildWisp },
  puffcap: { create: createPuffcap, step: updatePuffcap, body: puffcapBody, radius: PUFFCAP.radius, build: buildPuffcap },
  // Spikeling: Mossback brain, but only a ground pound defeats it (a plain stomp hurts).
  spikeling: { create: (s) => ({ ...createMossback(s), kind: 'spikeling' }), step: updateMossback, body: mossbackBody, radius: MOSSBACK.radius, build: buildSpikeling, spiky: true },
  emberbat: { create: (s) => createWisp({ ...s, kind: 'emberbat', orbit: s.orbit || 3 }), step: updateWisp, body: wispBody, radius: WISP.radius, build: buildEmberbat },
  boss: { create: createBoss, step: updateBoss, body: bossBody, radius: BOSS.radius, build: (s) => buildBoss(s?.type), boss: true },
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
    const mesh = kind.build(spawn);
    root.add(mesh);
    return { spawn, kind, mesh, state: kind.create(spawn) };
  });

  const spores = Array.from({ length: MAX_SPORES }, () => {
    const mesh = buildSpore();
    mesh.visible = false;
    root.add(mesh);
    return { mesh, p: null, orb: false };
  });

  // Boss extras: fire rings and orbs.
  const bossEntry = enemies.find((e) => e.kind.boss) ?? null;
  const waves = bossEntry ? Array.from({ length: 4 }, () => {
    const w = buildWave(bossEntry.spawn.type === 'gloam' ? 0xa27aff : 0xff7a2a);
    root.add(w);
    return w;
  }) : [];
  if (bossEntry) {
    for (const sp of spores) {
      sp.orbMesh = buildOrb();
      sp.orbMesh.visible = false;
      root.add(sp.orbMesh);
    }
  }

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
    get boss() {
      return bossEntry?.state ?? null;
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
        if (shot?.slam) {
          events.push({ type: 'bossSlam', position: shot.position });
        } else if (shot) {
          const slot = spores.find((sp) => !sp.p);
          if (slot) {
            slot.p = shot;
            slot.orb = !!e.kind.boss;
          }
        }
        if (e.kind.boss && s.active && !s.announced) {
          s.announced = true;
          events.push({ type: 'bossStart', name: s.name, hp: s.hp, maxHp: s.maxHp });
        }
        if (e.kind.boss && player && !player.invulnerable && !hurt) {
          const src = waveHits(s, player);
          if (src) hurt = knockbackFrom(src, player);
        }
        if (!player || stomped) continue;
        e.kind.body(s, body);
        if (!touchesSphere(player, body, e.kind.radius)) continue;
        if (e.kind.boss) {
          const fromAbove = isStomp(player, body) && player.position.y > s.pos.y + 1.2;
          if (fromAbove) {
            const result = hitBoss(s);
            stomped = true;
            if (result) {
              e.mesh.userData.flash?.();
              poof(body);
              events.push({ type: 'stomp', kind: 'boss', position: body.clone() });
              events.push(result === 'defeated'
                ? { type: 'bossDefeated', name: s.name, position: body.clone() }
                : { type: 'bossHit', hp: s.hp, maxHp: s.maxHp });
            } else {
              events.push({ type: 'stomp', kind: 'bossBlock', position: body.clone() }); // bounces off, no damage
            }
          } else if (!player.invulnerable && !hurt && s.mode !== 'dizzy' && s.mode !== 'hurt') {
            hurt = knockbackFrom(body, player);
          }
          continue;
        }
        if (e.kind.spiky && !player.groundPounding && isStomp(player, body)) {
          // Landing on spikes: Pip is bounced off and hurt.
          if (!player.invulnerable && !hurt) hurt = knockbackFrom(body, player);
          continue;
        }
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
      for (const w of waves) w.visible = false;
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
    if (bossEntry) {
      const s = bossEntry.state;
      waves.forEach((w, i) => {
        const wave = s.waves[i];
        w.visible = !!wave && s.alive;
        if (!w.visible) return;
        w.position.set(s.center.x, s.home.y + 0.15, s.center.z);
        w.scale.set(wave.r, 1, wave.r);
        w.userData.mat.opacity = 0.9 * (1 - wave.r / (s.arenaRadius + 1)) + 0.1;
      });
    }
    for (const sp of spores) {
      if (sp.orbMesh) {
        sp.orbMesh.visible = !!sp.p && sp.orb;
        if (sp.orbMesh.visible) sp.orbMesh.position.copy(sp.p.pos);
      }
      sp.mesh.visible = !!sp.p && !sp.orb;
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
