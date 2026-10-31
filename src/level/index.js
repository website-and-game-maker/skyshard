import * as THREE from 'three';
import driftmeadow from './levels/driftmeadow.js';
import { islandColliders, boxCollider } from './colliders.js';
import {
  moverAt, isStandingOn, createCrumbleState, stepCrumble, touchesPickup, inZone,
  blinkerAt, sweeperAngle, sweeperHits, inUpdraft, updraftLift,
} from './mechanics.js';
import { createSky, createLights, createClouds, createMotes } from './sky.js';
import { resolveEnv } from './env.js';
import {
  buildIslandGeometry, islandMaterial, createVegetation, buildTree, buildRock, buildWaterfall, createDistantIslands,
} from './islands.js';
import {
  shardGeometry, shardMaterial, buildHeart, buildMover, buildCrumbler, buildCheckpoint, setCheckpointActive,
  buildBeacon, setBeaconUnlocked, buildMushroom, MUSHROOM_TOP, buildThorns, createSparkles,
  buildUpdraft, buildBlinker, buildSweeper, buildSunstone, setSunstoneOwned, buildLava,
} from './props.js';

export { LEVELS, WORLDS, levelById, worldById, nextLevelId } from './levels/index.js';

const CHECKPOINT_RADIUS = 2.4;
const GOAL_RADIUS = 2.4;
const RESPAWN_OFFSET = new THREE.Vector3(0, 0, -1.8); // in front of the totem, clear of its collider

const SWEEPER_KNOCK = 8;

// `layout` is a level definition from levels/ (see levels/README in CONTRACTS.md).
// Missing arrays default to empty, so a level only lists what it uses.
export function createLevel({ scene, quality = 'high', layout = driftmeadow } = {}) {
  const def = layout;
  const islands = def.islands ?? [];
  const islandById = Object.fromEntries(islands.map((i) => [i.id, i]));
  const movers = def.movers ?? [];
  const crumblers = def.crumblers ?? [];
  const bouncers = def.bouncers ?? [];
  const hazards = def.hazards ?? [];
  const checkpoints = def.checkpoints ?? [];
  const beaconDef = def.beacon;
  const shardList = def.shards ?? [];
  const heartList = def.hearts ?? [];
  const enemySpawns = def.enemySpawns ?? [];
  const tips = def.tips ?? [];
  const updrafts = def.updrafts ?? [];
  const blinkers = def.blinkers ?? [];
  const sweepers = def.sweepers ?? [];
  const sunstoneList = def.sunstones ?? [];
  const spawn = def.spawn ?? { x: 0, y: 0, z: 0 };
  const env = resolveEnv(def.env);
  const hasBoss = !!def.boss;

  const islandTop = (id, dx = 0, dz = 0) => {
    const i = islandById[id];
    if (!i) throw new Error(`Level ${def.id}: unknown island "${id}"`);
    return new THREE.Vector3(i.x + dx, i.y, i.z + dz);
  };

  const root = new THREE.Group();
  root.name = 'level';
  scene.add(root);

  const time = { value: 0 }; // shared by wind, water and the beacon beam
  const colliders = [];

  // Atmosphere
  const sky = createSky(root, env);
  scene.fog = new THREE.Fog(env.fog.color, env.fog.near, env.fog.far);
  scene.background = scene.fog.color.clone();
  sky.dome.onBeforeRender = (_r, _s, camera) => {
    sky.dome.position.copy(camera.position);
    sky.dome.updateMatrixWorld();
  };
  const lights = createLights(root, quality, env);
  const clouds = createClouds(root, quality, env);
  const motes = createMotes(root, quality, env);
  const distant = new THREE.Group();
  createDistantIslands(distant, quality, env.distantThemes);
  root.add(distant);

  // Islands, trees, rocks and waterfalls
  const islandMat = islandMaterial();
  const trees = [];
  const treeAvoid = [];
  for (const isl of islands) {
    const mesh = new THREE.Mesh(buildIslandGeometry(isl, isl.radius > 4 ? 64 : 36), islandMat);
    mesh.position.set(isl.x, isl.y, isl.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `island:${isl.id}`;
    root.add(mesh);
    colliders.push(...islandColliders(isl));

    if (isl.theme === 'crystal' || isl.theme === 'starlit') {
      // Crystals hanging under crystal islands.
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + isl.x;
        const c = new THREE.Mesh(shardGeometry(), shardMaterial());
        const s = 0.8 + ((k * 37) % 7) / 6;
        c.scale.set(s, s * 1.4, s);
        c.position.set(isl.x + Math.cos(a) * isl.radius * 0.45, isl.y - isl.depth * 0.45, isl.z + Math.sin(a) * isl.radius * 0.45);
        c.rotation.z = Math.PI;
        root.add(c);
      }
    }
    (isl.trees ?? []).forEach(([dx, dz], k) => {
      const tree = buildTree(isl.theme, Math.round(isl.x * 7 + isl.z * 3 + k * 101));
      tree.position.set(isl.x + dx, isl.y - 0.05, isl.z + dz);
      tree.rotation.y = k * 1.7;
      root.add(tree);
      trees.push(tree);
      treeAvoid.push([isl.x + dx, isl.z + dz, 1]);
      colliders.push(boxCollider([isl.x + dx, isl.y + 1.4, isl.z + dz], [0.6, 2.8, 0.6]));
    });
    (isl.rocks ?? []).forEach(([dx, dz], k) => {
      const size = 0.6 + ((k * 13 + isl.radius) % 5) / 10;
      const rock = buildRock(k + Math.round(isl.radius * 10), size, isl.theme);
      rock.position.set(isl.x + dx, isl.y - 0.05, isl.z + dz);
      root.add(rock);
      colliders.push(boxCollider([isl.x + dx, isl.y + size * 0.25, isl.z + dz], [size * 1.5, size * 0.5, size * 1.5]));
    });
    if (isl.waterfall) root.add(buildWaterfall(isl, isl.waterfall.angle, time));
  }
  createVegetation(root, islands, { quality, windTime: time, avoid: treeAvoid });

  // Moving platforms
  const moverParts = movers.map((def) => {
    const mesh = buildMover(def);
    root.add(mesh);
    const collider = { box: new THREE.Box3(), velocity: new THREE.Vector3() };
    colliders.push(collider);
    return { def, mesh, collider };
  });
  // Main steps the player before the level, so on each step the player rides with the
  // velocity we reported last step while the platform has since moved on. Reporting the
  // displacement the platform just made (not its instantaneous velocity) lets a rider
  // catch up exactly and stay flush with the top, even while it speeds up or slows down.
  // Rising platforms report a hair extra so a rider never ends up inside the slab.
  const RIDE_EPS = 1e-4;
  const placeMovers = (t, dt) => {
    for (const m of moverParts) {
      const { top, velocity } = moverAt(m.def, t);
      const [w, h, d] = m.def.size;
      const prev = m.collider.box.max;
      if (dt > 0 && !m.collider.box.isEmpty()) {
        m.collider.velocity.set((top[0] - (prev.x - w / 2)) / dt, (top[1] - prev.y) / dt, (top[2] - (prev.z - d / 2)) / dt);
        if (m.collider.velocity.y > 0) m.collider.velocity.y += RIDE_EPS / dt;
      } else {
        m.collider.velocity.set(velocity[0], velocity[1], velocity[2]);
      }
      m.collider.box.min.set(top[0] - w / 2, top[1] - h, top[2] - d / 2);
      m.collider.box.max.set(top[0] + w / 2, top[1], top[2] + d / 2);
      m.mesh.position.set(top[0], top[1], top[2]);
    }
  };

  // Crumbling slabs
  const crumbleParts = crumblers.map((def, k) => {
    const mesh = buildCrumbler(def, 40 + k);
    mesh.position.set(...def.top);
    root.add(mesh);
    const [w, h, d] = def.size;
    const collider = boxCollider([def.top[0], def.top[1] - h / 2, def.top[2]], [w, h, d]);
    colliders.push(collider);
    return { def, mesh, collider, state: createCrumbleState(), solid: true };
  });
  const setColliderPresent = (collider, present) => {
    const i = colliders.indexOf(collider);
    if (present && i < 0) colliders.push(collider);
    if (!present && i >= 0) colliders.splice(i, 1);
  };

  // Bloom-cap mushrooms
  const bouncerParts = bouncers.map((def) => {
    const base = islandTop(def.island, def.dx, def.dz);
    const mesh = buildMushroom();
    mesh.position.copy(base);
    root.add(mesh);
    const collider = boxCollider([base.x, base.y + MUSHROOM_TOP / 2, base.z], [1.6, MUSHROOM_TOP, 1.6], {
      bouncy: def.strength, // Pip treats a number as the launch speed
    });
    colliders.push(collider);
    return { def, mesh, collider, cooldown: 0 };
  });

  // Thorn patches
  for (const [k, hz] of hazards.entries()) {
    const mesh = hz.style === 'lava' ? buildLava(hz.size, time) : buildThorns(hz.size, 70 + k);
    mesh.position.set(hz.top[0], hz.top[1] - hz.size[1], hz.top[2]);
    root.add(mesh);
    colliders.push(boxCollider([hz.top[0], hz.top[1] - hz.size[1] / 2, hz.top[2]], hz.size, { hazard: true }));
  }

  // Updrafts: columns of rising wind (no collider; the level nudges Pip's vertical speed).
  const updraftParts = updrafts.map((u) => {
    const mesh = buildUpdraft(u, time);
    mesh.position.set(...u.at);
    root.add(mesh);
    return { def: u, mesh };
  });

  // Phase slabs: solid for part of each cycle, flicker as a warning, then vanish.
  const blinkerParts = blinkers.map((b) => {
    const mesh = buildBlinker(b);
    mesh.position.set(...b.top);
    root.add(mesh);
    const [w, h, d] = b.size;
    const collider = boxCollider([b.top[0], b.top[1] - h / 2, b.top[2]], [w, h, d]);
    colliders.push(collider);
    return { def: b, mesh, collider, solid: true };
  });

  // Sweepers: spinning spiked arms. Contact is checked here and reported as a 'hurt' event.
  const sweeperParts = sweepers.map((sw) => {
    const mesh = buildSweeper(sw);
    mesh.position.set(...sw.center);
    root.add(mesh);
    colliders.push(boxCollider([sw.center[0], sw.center[1] + (sw.height ?? 1.2) / 2, sw.center[2]], [0.9, sw.height ?? 1.2, 0.9]));
    return { def: sw, mesh };
  });

  // Checkpoints
  const checkpointParts = checkpoints.map((def, k) => {
    const pos = islandTop(def.island, def.dx, def.dz);
    const mesh = buildCheckpoint();
    mesh.position.copy(pos);
    root.add(mesh);
    colliders.push(boxCollider([pos.x, pos.y + 1.1, pos.z], [0.9, 2.2, 0.9]));
    return { index: k + 1, pos, respawn: pos.clone().add(RESPAWN_OFFSET), mesh };
  });

  // Beacon
  const beaconPos = islandTop(beaconDef.island, beaconDef.dx, beaconDef.dz);
  const beaconMesh = buildBeacon(time);
  beaconMesh.position.copy(beaconPos);
  root.add(beaconMesh);
  const beaconColliders = [boxCollider([beaconPos.x, beaconPos.y + 2.3, beaconPos.z], [1.2, 4.6, 1.2])];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    beaconColliders.push(boxCollider([beaconPos.x + Math.cos(a) * 3, beaconPos.y + 1.1, beaconPos.z + Math.sin(a) * 3], [0.6, 2.2, 0.6]));
  }
  // In boss arenas the beacon stays sunk out of sight until the boss falls (openGoal()).
  let goalOpen = !hasBoss;
  let beaconRise = goalOpen ? 1 : 0;
  const setBeaconPresent = (present) => {
    beaconMesh.visible = present;
    for (const c of beaconColliders) setColliderPresent(c, present);
  };

  // Sunstones: three hidden gems per level, saved across runs.
  const sunstoneParts = sunstoneList.map((pos, i) => {
    const mesh = buildSunstone();
    mesh.position.set(pos[0], pos[1], pos[2]);
    root.add(mesh);
    return { pos, mesh, index: i };
  });
  const sunstoneTaken = new Array(sunstoneList.length).fill(false);

  // Shards (one instanced mesh) and hearts
  const shardMesh = new THREE.InstancedMesh(shardGeometry(), shardMaterial(), shardList.length);
  shardMesh.name = 'shards';
  shardMesh.frustumCulled = false;
  root.add(shardMesh);
  const heartMeshes = heartList.map((h) => {
    const m = buildHeart();
    const p = islandTop(h.island, h.dx, h.dz);
    m.position.set(p.x, p.y + 0.9, p.z);
    m.userData.base = m.position.y;
    root.add(m);
    return m;
  });
  const sparkles = createSparkles(root);
  const tipInside = new Array(tips.length).fill(false);

  // Run state
  const shardTaken = new Array(shardList.length).fill(false);
  const heartTaken = new Array(heartList.length).fill(false);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
  const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
  let simTime = 0;
  let visualTime = 0;
  let lastElapsed = null;
  let activeCheckpoint = 0;
  let inBeaconZone = false;
  let goalReached = false;

  const level = {
    root,
    colliders,
    def,
    env,
    id: def.id,
    name: def.name,
    killY: def.killY ?? -25,
    spawn: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
    respawnPoint: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
    shardsTotal: shardList.length,
    shardsCollected: 0,
    shardsRequired: hasBoss ? 0 : Math.min(def.shardsRequired ?? shardList.length, shardList.length),
    sunstonesTotal: sunstoneList.length,
    get sunstonesCollected() {
      return sunstoneTaken.filter(Boolean).length;
    },
    sunstonesTaken: sunstoneTaken,
    get goalOpen() {
      return goalOpen;
    },
    beaconPosition: beaconPos.clone(),
    // World-space enemy placements, read by createEnemies (modules don't import each other).
    enemySpawns: [...enemySpawns, ...(hasBoss ? [{ ...def.boss, kind: 'boss' }] : [])].map((s, i) => {
      const isl = islandById[s.island];
      if (!isl) throw new Error(`Level ${def.id}: enemy on unknown island "${s.island}"`);
      const at = (dx, dz, dy = 0) => new THREE.Vector3(isl.x + dx, isl.y + dy, isl.z + dz);
      if (s.kind === 'mossback' || s.kind === 'spikeling') {
        return { kind: s.kind, home: at(0, 0), a: at(...s.a), b: at(...s.b), leash: s.leash };
      }
      if (s.kind === 'boss') {
        return { kind: 'boss', type: s.type, name: s.name, home: at(0, 0), arenaRadius: s.arenaRadius ?? isl.radius * 0.8, hp: s.hp ?? 3 };
      }
      return { kind: s.kind, home: at(s.at[0], s.at[1], s.hover ?? 0), phase: i * 1.3, orbit: s.orbit ?? 0 };
    }),
    get beaconUnlocked() {
      return goalOpen && level.shardsCollected >= level.shardsRequired;
    },

    // Boss arenas: main calls this when the boss is defeated; the beacon rises.
    openGoal() {
      if (goalOpen) return;
      goalOpen = true;
      setBeaconPresent(true);
      setBeaconUnlocked(beaconMesh, true);
      sparkles.emit(beaconPos);
    },

    // Sunstones already in the save show as faint outlines; taking one again still counts for the run.
    setSunstonesOwned(owned = []) {
      sunstoneParts.forEach((s, i) => setSunstoneOwned(s.mesh, !!owned[i]));
    },

    update(dt = 0, player = null, elapsed) {
      const events = [];
      // Visual clock keeps animating behind menus (dt = 0) using elapsed time.
      let vdt = dt;
      if (typeof elapsed === 'number' && lastElapsed !== null) {
        const de = elapsed - lastElapsed;
        if (de > 0 && de < 0.25) vdt = Math.max(dt, de);
      }
      if (typeof elapsed === 'number') lastElapsed = elapsed;
      visualTime += vdt;
      simTime += dt;
      time.value = visualTime;

      placeMovers(simTime, dt);

      for (const b of blinkerParts) {
        const st = blinkerAt(b.def, simTime);
        if (st.solid !== b.solid) {
          b.solid = st.solid;
          setColliderPresent(b.collider, st.solid);
        }
        const flicker = st.warn ? (Math.sin(visualTime * 40) > 0 ? 0.35 : 0.9) : 0.9;
        b.mesh.visible = st.solid;
        b.mesh.userData.mat.opacity = flicker;
        b.mesh.userData.edgeMat.opacity = st.warn ? flicker : 0.8;
      }
      for (const sw of sweeperParts) {
        sw.mesh.userData.rotor.rotation.y = sweeperAngle(sw.def, simTime);
      }

      for (const c of crumbleParts) {
        const onTop = !!player && player.grounded !== false && isStandingOn(player, c.collider.box);
        const solid = stepCrumble(c.state, dt, onTop);
        if (solid !== c.solid) {
          c.solid = solid;
          setColliderPresent(c.collider, solid);
        }
        animateCrumbler(c);
      }

      if (player) {
        shardList.forEach((pos, i) => {
          if (shardTaken[i] || !touchesPickup(player, pos)) return;
          shardTaken[i] = true;
          level.shardsCollected += 1;
          sparkles.emit(tmpP.set(pos[0], pos[1], pos[2]));
          events.push({ type: 'shard', collected: level.shardsCollected, total: level.shardsTotal });
          if (level.shardsCollected === level.shardsRequired) setBeaconUnlocked(beaconMesh, true);
        });
        sunstoneParts.forEach((s, i) => {
          if (sunstoneTaken[i] || !touchesPickup(player, s.pos, 1.1)) return;
          sunstoneTaken[i] = true;
          s.mesh.visible = false;
          sparkles.emit(s.mesh.position);
          events.push({ type: 'sunstone', index: i, collected: level.sunstonesCollected, total: sunstoneList.length });
        });
        tips.forEach((tip, i) => {
          const inside = inZone(player, tip.at, tip.radius ?? 3, 6);
          if (inside && !tipInside[i]) events.push({ type: 'tip', id: tip.id, text: tip.text, title: tip.title, action: tip.action });
          tipInside[i] = inside;
        });
        if (player.velocity && !player.groundPounding) {
          for (const u of updraftParts) {
            if (!inUpdraft(u.def, player)) continue;
            const lift = updraftLift(u.def, player.position.y);
            if (player.velocity.y < lift) player.velocity.y = Math.min(lift, player.velocity.y + dt * 90);
          }
        }
        if (!player.invulnerable) {
          for (const sw of sweeperParts) {
            if (!sweeperHits(sw.def, simTime, player)) continue;
            const k = new THREE.Vector3(player.position.x - sw.def.center[0], 0, player.position.z - sw.def.center[2]);
            if (k.lengthSq() < 1e-6) k.set(0, 0, 1);
            k.normalize().multiplyScalar(SWEEPER_KNOCK);
            k.y = 6;
            events.push({ type: 'hurt', knockback: k });
            break;
          }
        }
        heartMeshes.forEach((m, i) => {
          if (heartTaken[i] || !touchesPickup(player, [m.position.x, m.userData.base, m.position.z])) return;
          heartTaken[i] = true;
          m.visible = false;
          sparkles.emit(m.position);
          events.push({ type: 'heart' });
        });
        for (const cp of checkpointParts) {
          if (cp.index <= activeCheckpoint) continue;
          if (!inZone(player, [cp.pos.x, cp.pos.y, cp.pos.z], CHECKPOINT_RADIUS)) continue;
          activeCheckpoint = cp.index;
          checkpointParts.forEach((o) => setCheckpointActive(o.mesh, o.index === cp.index));
          level.respawnPoint.copy(cp.respawn);
          sparkles.emit(tmpP.copy(cp.pos).setY(cp.pos.y + 2.7));
          events.push({ type: 'checkpoint', index: cp.index, position: cp.respawn.clone() });
        }
        const inside = inZone(player, [beaconPos.x, beaconPos.y, beaconPos.z], GOAL_RADIUS, 4);
        if (inside && !inBeaconZone && !goalReached && goalOpen) {
          if (level.beaconUnlocked) {
            goalReached = true;
            events.push({ type: 'goal' });
          } else {
            events.push({ type: 'beaconLocked', needed: level.shardsRequired - level.shardsCollected });
          }
        }
        inBeaconZone = inside;
        for (const b of bouncerParts) {
          const box = b.collider.box;
          const p = player.position;
          b.cooldown = Math.max(0, b.cooldown - dt);
          if (b.cooldown === 0 && p.x > box.min.x - 0.3 && p.x < box.max.x + 0.3 && p.z > box.min.z - 0.3 && p.z < box.max.z + 0.3 &&
              p.y > box.max.y - 0.2 && p.y < box.max.y + 0.8 && player.velocity && player.velocity.y > 4) {
            b.mesh.userData.squash = 1;
            b.cooldown = 0.4;
          }
        }
        lights.follow(player.position);
        motes.update(visualTime, player.position);
      } else {
        lights.follow(level.respawnPoint);
        motes.update(visualTime, level.respawnPoint);
      }

      animate(vdt);
      return events;
    },

    reset() {
      shardTaken.fill(false);
      heartTaken.fill(false);
      heartMeshes.forEach((m) => { m.visible = true; });
      sunstoneTaken.fill(false);
      sunstoneParts.forEach((s) => { s.mesh.visible = true; });
      tipInside.fill(false);
      goalOpen = !hasBoss;
      beaconRise = goalOpen ? 1 : 0;
      setBeaconPresent(goalOpen);
      for (const b of blinkerParts) {
        b.solid = true;
        setColliderPresent(b.collider, true);
      }
      level.shardsCollected = 0;
      activeCheckpoint = 0;
      checkpointParts.forEach((o) => setCheckpointActive(o.mesh, false));
      level.respawnPoint.copy(level.spawn);
      setBeaconUnlocked(beaconMesh, level.shardsRequired === 0 && goalOpen);
      inBeaconZone = false;
      goalReached = false;
      simTime = 0;
      for (const c of crumbleParts) {
        c.state = createCrumbleState();
        c.solid = true;
        setColliderPresent(c.collider, true);
        animateCrumbler(c);
      }
      placeMovers(0, 0);
    },

    dispose() {
      scene.remove(root);
      root.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => m.dispose());
      });
      if (scene.fog) scene.fog = null;
    },
  };

  function animateCrumbler(c) {
    const { phase, timer } = c.state;
    const [x, y, z] = c.def.top;
    const [m0, m1] = c.mesh.userData.materials;
    let ox = 0, oy = 0, oz = 0, opacity = 1;
    if (phase === 'shaking') {
      const k = 0.05 + timer * 0.12;
      ox = Math.sin(visualTime * 70) * k;
      oz = Math.cos(visualTime * 63) * k;
    } else if (phase === 'falling') {
      oy = -timer * timer * 9;
      opacity = 1 - timer / 1.1;
      c.mesh.rotation.z = timer * 0.4;
    } else if (phase === 'gone') {
      opacity = 0;
    } else if (phase === 'reforming') {
      opacity = timer / 0.6;
      oy = -(1 - opacity) * 0.6;
      c.mesh.rotation.z = 0;
    } else {
      c.mesh.rotation.z = 0;
    }
    c.mesh.position.set(x + ox, y + oy, z + oz);
    c.mesh.visible = opacity > 0.01;
    m0.opacity = opacity;
    m1.opacity = opacity;
    m0.transparent = opacity < 1;
    m1.transparent = opacity < 1;
  }

  function animate(dt) {
    const t = visualTime;
    shardList.forEach((pos, i) => {
      const s = shardTaken[i] ? 0 : 1;
      tmpE.set(0, t * 1.6 + i * 0.7, Math.sin(t + i) * 0.12);
      tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpP.set(pos[0], pos[1] + Math.sin(t * 2.2 + i * 0.9) * 0.12, pos[2]), tmpQ, tmpS.setScalar(s));
      shardMesh.setMatrixAt(i, tmpM);
    });
    shardMesh.instanceMatrix.needsUpdate = true;

    heartMeshes.forEach((m, i) => {
      m.rotation.y = t * 1.8 + i;
      m.position.y = m.userData.base + Math.sin(t * 2 + i) * 0.12;
      m.scale.setScalar(1 + Math.sin(t * 6) * 0.06);
    });

    for (const cp of checkpointParts) {
      const u = cp.mesh.userData;
      u.crystal.rotation.y = t * (u.active ? 2.2 : 0.6);
      u.crystal.position.y = 2.75 + Math.sin(t * 1.5 + cp.index) * 0.1;
      u.pulse = Math.max(0, u.pulse - dt * 0.8);
      u.ringMat.opacity = u.active ? 0.35 + u.pulse * 0.6 : 0;
      u.ring.scale.setScalar(1 + u.pulse * 0.8);
    }

    for (const s of sunstoneParts) {
      const u = s.mesh.userData;
      s.mesh.position.y = s.pos[1] + Math.sin(t * 1.8 + s.index * 2) * 0.18;
      u.gem.rotation.y = t * 1.4;
      u.points.rotation.y = -t * 0.9;
      u.halo.rotation.x = Math.PI / 2 + Math.sin(t * 0.8) * 0.3;
      u.halo.rotation.y = t * 0.6;
    }
    if (goalOpen && beaconRise < 1) beaconRise = Math.min(1, beaconRise + dt * 0.5);
    beaconMesh.position.y = beaconPos.y - (1 - beaconRise) * (1 - beaconRise) * 8;

    const bu = beaconMesh.userData;
    const speed = bu.unlocked ? 1.6 : 0.4;
    bu.rings.forEach((r, i) => {
      r.rotation.x = t * speed * (0.6 + i * 0.25) + i;
      r.rotation.y = t * speed * (0.4 + i * 0.3);
    });
    bu.core.rotation.y = t * speed;
    bu.core.position.y = 6.3 + Math.sin(t * 1.2) * 0.15;

    for (const m of moverParts) {
      m.mesh.userData.keel.rotation.y = t * 1.5;
      m.mesh.userData.rune.rotation.y = -t * 0.5;
    }

    for (const b of bouncerParts) {
      const u = b.mesh.userData;
      u.squash = Math.max(0, u.squash - dt * 3);
      const wobble = Math.sin(u.squash * Math.PI * 3) * u.squash;
      u.cap.scale.set(1 + wobble * 0.18, 1 - wobble * 0.3, 1 + wobble * 0.18);
    }

    for (const tree of trees) {
      const ph = tree.userData.phase;
      tree.userData.crown.rotation.z = Math.sin(t * 0.9 + ph) * 0.015;
      tree.userData.crown.rotation.x = Math.cos(t * 0.7 + ph) * 0.012;
    }

    for (const d of distant.children) {
      const b = d.userData.bob;
      if (b) d.position.y = b.base + Math.sin(t * 0.25 + b.phase) * b.amp;
    }

    clouds.update(t);
    sky.update(t);
    sparkles.update(dt);
  }

  level.reset();
  level.update(0, null);
  return level;
}
