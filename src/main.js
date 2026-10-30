// Skyshard entry point. This file owns the renderer, the game loop and the game state,
// and wires the workstream modules together. Modules never import each other;
// everything they need is passed in here. See CONTRACTS.md.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input } from './input/index.js';
import { Player } from './player/index.js';
import { FollowCamera } from './camera/index.js';
import { createLevel } from './level/index.js';
import { createEnemies } from './enemies/index.js';
import { createUI } from './ui/index.js';
import { createAudio } from './audio/index.js';

const STEP = 1 / 60; // fixed simulation step
const MAX_HEALTH = 3;

const canvas = document.getElementById('game');
const audio = createAudio();
const ui = createUI(document.body, {
  onStart: () => startRun(),
  onPause: () => togglePause(),
  onResume: () => setState('playing'),
  onRestart: () => startRun(),
  onQuit: () => toMenu(),
  onSettings: (s) => applySettings(s),
  onSound: (name) => audio.play(name),
});

let settings = ui.getSettings();

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Game modules
const level = createLevel({ scene, quality: settings.quality === 'low' ? 'low' : 'high' });
const player = new Player({ scene, world: level });
const enemies = createEnemies({ scene, level });
const input = new Input({ element: document.body, window });
const follow = new FollowCamera(camera, { collidables: level.colliders });

// Game state
const game = {
  state: 'menu', // 'loading' | 'menu' | 'playing' | 'paused' | 'won' | 'gameover'
  health: MAX_HEALTH,
  timeMs: 0,
  deaths: 0,
  fps: 60,
};

// Player events become sounds.
for (const name of ['jump', 'doubleJump', 'dash', 'pound', 'land']) {
  player.on(name, () => audio.play(name));
}
player.on('spring', () => audio.play('doubleJump'));
player.on('pound', () => {
  follow.shake?.(0.3, 0.3);
  input.rumble?.(0.8, 160);
});
player.on('dash', () => input.rumble?.(0.3, 80));
player.on('fall', () => killPlayer());

function setState(next) {
  game.state = next;
  input.setTouchVisible(next === 'playing');
  if (next === 'playing') {
    ui.showHud();
    audio.startMusic('level');
  } else if (next === 'paused') {
    ui.showPause();
  } else if (next === 'menu') {
    ui.showTitle();
    audio.startMusic('title');
  }
}

function startRun() {
  audio.unlock();
  level.reset();
  enemies.reset();
  player.setCheckpoint(level.spawn);
  player.respawn(level.spawn);
  follow.snap?.(player.position);
  game.health = MAX_HEALTH;
  game.timeMs = 0;
  game.deaths = 0;
  setState('playing');
  canvas.focus();
}

function toMenu() {
  setState('menu');
}

function togglePause() {
  if (game.state === 'playing') setState('paused');
  else if (game.state === 'paused') setState('playing');
}

function applySettings(s) {
  if (s.quality !== settings.quality) autoDrop = 0;
  settings = s;
  audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
  input.setOptions?.({ sensitivity: s.sensitivity, invertY: s.invertY });
  resize();
}

function hurtPlayer(knockback) {
  if (player.invulnerable) return;
  game.health -= 1;
  audio.play('hurt');
  if (game.health <= 0) {
    killPlayer();
  } else {
    player.hurt(knockback);
    follow.shake?.(0.2, 0.2);
    input.rumble?.(0.6, 200);
  }
}

function killPlayer() {
  game.deaths += 1;
  game.health = MAX_HEALTH;
  audio.play('lose');
  player.respawn(level.respawnPoint);
  follow.snap?.(player.position);
  ui.toast('Back to the last checkpoint');
}

function winRun() {
  setState('won');
  audio.play('win');
  audio.stopMusic();
  const bestKey = 'skyshard.best';
  let best = null;
  try {
    best = Number(localStorage.getItem(bestKey)) || null;
    if (!best || game.timeMs < best) {
      localStorage.setItem(bestKey, String(Math.round(game.timeMs)));
      best = game.timeMs;
    }
  } catch {
    best = game.timeMs;
  }
  ui.showWin({ timeMs: game.timeMs, shards: level.shardsCollected, totalShards: level.shardsTotal, best, deaths: game.deaths });
}

function handleLevelEvents(events) {
  for (const e of events) {
    if (e.type === 'shard') {
      audio.play('shard');
    } else if (e.type === 'checkpoint') {
      audio.play('checkpoint');
      player.setCheckpoint(e.position);
      ui.toast('Checkpoint');
    } else if (e.type === 'beaconLocked') {
      ui.toast(`The beacon needs ${e.needed} more shard${e.needed === 1 ? '' : 's'}`);
    } else if (e.type === 'heart') {
      game.health = Math.min(MAX_HEALTH, game.health + 1);
      audio.play('shard');
    } else if (e.type === 'goal') {
      winRun();
    }
  }
}

function handleEnemyEvents(events) {
  for (const e of events) {
    if (e.type === 'stomp') {
      player.bounce();
      audio.play('enemyDefeat');
    } else if (e.type === 'defeated') {
      audio.play('enemyDefeat');
    } else if (e.type === 'hurt') {
      hurtPlayer(e.knockback);
    }
  }
}

function simulate(dt) {
  game.timeMs += dt * 1000;
  player.update(dt, input, follow.yaw);
  handleLevelEvents(level.update(dt, player, game.timeMs / 1000) ?? []);
  handleEnemyEvents(enemies.update(dt, player) ?? []);
}

// Automatic quality: if the frame rate stays low, step down one notch at a time
// (resolution first, then bloom, then shadows) so slow phones stay playable.
// The player's quality setting is the ceiling; we never go above it.
const QUALITY_STEPS = ['high', 'medium', 'low'];
let autoDrop = 0; // notches dropped below the chosen setting
let slowTime = 0;

function effectiveQuality() {
  const base = Math.max(0, QUALITY_STEPS.indexOf(settings.quality));
  return QUALITY_STEPS[Math.min(QUALITY_STEPS.length - 1, base + autoDrop)];
}

function adaptQuality(dt) {
  if (game.state !== 'playing' || document.hidden) return;
  slowTime = game.fps < 30 ? slowTime + dt : 0;
  if (slowTime > 3 && effectiveQuality() !== 'low') {
    autoDrop += 1;
    slowTime = -2; // give the new setting a moment before judging it
    resize();
  }
}

// Resize, honouring quality and device pixel ratio.
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const quality = effectiveQuality();
  const maxRatio = quality === 'low' ? 0.75 : quality === 'medium' ? 1 : 2;
  const ratio = Math.min(window.devicePixelRatio || 1, maxRatio);
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(ratio);
  composer.setSize(w, h);
  bloom.enabled = quality === 'high';
  const shadows = quality !== 'low';
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    // Shader programs bake in shadow support, so force a recompile.
    scene.traverse((o) => {
      for (const m of [].concat(o.material ?? [])) m.needsUpdate = true;
    });
  }
  camera.aspect = w / h;
  camera.fov = w < h ? 75 : 60; // portrait phones get a wider view
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// Pause when the tab is hidden so nobody dies while away.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') setState('paused');
});

// Main loop: fixed-step simulation, render every frame.
const clock = new THREE.Clock();
let acc = 0;
let fpsAcc = 0;
let fpsFrames = 0;
let frameCount = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  input.update();

  if (input.state.pausePressed && (game.state === 'playing' || game.state === 'paused')) togglePause();

  if (game.state === 'playing') {
    acc += dt;
    while (acc >= STEP) {
      simulate(STEP);
      acc -= STEP;
    }
    ui.updateHud({
      shards: level.shardsCollected,
      totalShards: level.shardsTotal,
      health: game.health,
      maxHealth: MAX_HEALTH,
      timeMs: game.timeMs,
    });
  } else {
    acc = 0;
    // Keep the world alive behind menus (water, clouds, idle enemies).
    level.update(0, null, clock.elapsedTime);
  }

  follow.update(dt, player.position, game.state === 'playing' ? input : null);

  fpsAcc += dt;
  fpsFrames += 1;
  if (fpsAcc >= 0.5) {
    game.fps = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0;
    fpsFrames = 0;
    ui.setFps?.(settings.showFps ? game.fps : null);
  }
  adaptQuality(dt);

  frameCount += 1;
  publishDebug();
  composer.render();
  requestAnimationFrame(frame);
}

// Read-only snapshot for automated tests. Nothing in the game reads this.
function publishDebug() {
  const p = player.position;
  window.__SKYSHARD__ = {
    state: game.state,
    player: { x: p.x, y: p.y, z: p.z, grounded: !!player.grounded },
    shards: level.shardsCollected,
    totalShards: level.shardsTotal,
    health: game.health,
    deaths: game.deaths,
    fps: game.fps,
    quality: effectiveQuality(),
    timeMs: game.timeMs,
    frame: frameCount,
  };
}

resize();
applySettings(settings);
player.respawn(level.spawn);
follow.snap?.(player.position);
setState('menu');
requestAnimationFrame(frame);
