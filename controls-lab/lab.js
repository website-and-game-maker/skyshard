// Controls Lab: the real level, Pip and camera with live-switchable keyboard styles and feel sliders.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input } from '../src/input/index.js';
import { Player } from '../src/player/index.js';
import { FollowCamera, CAMERA } from '../src/camera/index.js';
import { createLevel } from '../src/level/index.js';

const STEP = 1 / 60;
const STORE = 'skyshard.controlsLab';

const SCHEMES = {
  classic: {
    name: 'Classic',
    desc: 'Left/right step sideways. Turn the camera with the mouse or Q/E. (What the game uses now.)',
    keys: '<kbd>W A S D</kbd>/arrows move · mouse or <kbd>Q</kbd><kbd>E</kbd> turn camera',
    camera: { autoYawDelay: 1.2, autoYawRate: 0.9 },
  },
  steer: {
    name: 'Steer',
    desc: 'Left/right smoothly turn Pip and the camera together, like steering. Up runs where you face. Easiest with only arrow keys.',
    keys: '<kbd>↑</kbd>/<kbd>W</kbd> run · <kbd>←</kbd><kbd>→</kbd> steer · <kbd>↓</kbd> turn back',
    camera: { autoYawDelay: 0.6, autoYawRate: 1.2 },
  },
  tank: {
    name: 'Tank',
    desc: 'Like Steer, but Pip also turns on the spot and Down backs up while still facing forward. Very precise on narrow ledges.',
    keys: '<kbd>↑</kbd> forward · <kbd>↓</kbd> back up · <kbd>←</kbd><kbd>→</kbd> turn on the spot',
    camera: { autoYawDelay: 99, autoYawRate: 0 },
  },
  auto: {
    name: 'Auto camera',
    desc: 'Move in any direction like Classic, and the camera swings behind Pip by itself. No mouse needed.',
    keys: '<kbd>W A S D</kbd>/arrows move · camera follows on its own',
    camera: { autoYawDelay: 0.15, autoYawRate: 3 },
  },
};

const SLIDERS = [
  { id: 'turnSpeed', label: 'Turn speed', min: 1, max: 5, step: 0.1, def: 2.6, fmt: (v) => `${v.toFixed(1)}` },
  { id: 'turnRamp', label: 'Turn smoothing', min: 0, max: 0.4, step: 0.01, def: 0.12, fmt: (v) => (v === 0 ? 'instant' : `${Math.round(v * 1000)} ms`) },
  { id: 'sensitivity', label: 'Mouse sensitivity', min: 0.3, max: 3, step: 0.1, def: 1, fmt: (v) => `${v.toFixed(1)}×` },
  { id: 'follow', label: 'Camera follows behind', min: 0, max: 3, step: 0.1, def: 1, fmt: (v) => (v === 0 ? 'off' : `${v.toFixed(1)}×`) },
  { id: 'distance', label: 'Camera distance', min: 4, max: 10, step: 0.5, def: CAMERA.distance, fmt: (v) => `${v.toFixed(1)}` },
];

function load() {
  const base = { scheme: 'classic', ...Object.fromEntries(SLIDERS.map((s) => [s.id, s.def])) };
  try { return { ...base, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return base; }
}
const opts = load();
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(opts)); } catch { /* private mode */ } };

// Scene
const canvas = document.getElementById('game');
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
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const level = createLevel({ scene, quality: 'high' });
const player = new Player({ scene, world: level });
const input = new Input({ element: document.getElementById('stage'), window });
const follow = new FollowCamera(camera, { collidables: level.colliders });
input.setTouchVisible(true);

function home() {
  level.reset();
  player.setCheckpoint(level.spawn);
  player.respawn(level.spawn);
  follow.yaw = 0;
  follow.snap(player.position);
}
player.on('fall', () => { player.respawn(); follow.snap(player.position); });
player.on('pound', () => follow.shake(0.3, 0.3));

function apply() {
  const sc = SCHEMES[opts.scheme];
  input.setOptions({ scheme: opts.scheme, turnSpeed: opts.turnSpeed, turnRamp: opts.turnRamp, sensitivity: opts.sensitivity });
  follow.setOptions({
    distance: opts.distance,
    autoYawDelay: opts.follow === 0 ? 99 : sc.camera.autoYawDelay,
    autoYawRate: sc.camera.autoYawRate * opts.follow,
  });
  document.querySelectorAll('.scheme').forEach((b) => b.classList.toggle('on', b.dataset.id === opts.scheme));
  document.getElementById('keys').innerHTML = `${sc.keys}<br><kbd>Space</kbd> jump (again for double) · <kbd>Shift</kbd> dash · <kbd>C</kbd> ground pound<br>Click the game to use the mouse, <kbd>Esc</kbd> to free it. Gamepad and touch work too.`;
  save();
}

// Panel
const schemesEl = document.getElementById('schemes');
for (const [id, sc] of Object.entries(SCHEMES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'scheme';
  b.dataset.id = id;
  b.innerHTML = `<b>${sc.name}</b><span>${sc.desc}</span>`;
  b.addEventListener('click', () => { opts.scheme = id; apply(); b.blur(); canvas.focus(); });
  schemesEl.appendChild(b);
}
const slidersEl = document.getElementById('sliders');
const outputs = {};
for (const s of SLIDERS) {
  const row = document.createElement('label');
  row.className = 'row';
  row.innerHTML = `<span>${s.label}</span><output></output><input type="range" min="${s.min}" max="${s.max}" step="${s.step}">`;
  const range = row.querySelector('input');
  const out = row.querySelector('output');
  range.value = opts[s.id];
  out.textContent = s.fmt(Number(opts[s.id]));
  range.addEventListener('input', () => { opts[s.id] = Number(range.value); out.textContent = s.fmt(opts[s.id]); apply(); });
  // Give the keyboard back to the game as soon as the slider is released.
  range.addEventListener('change', () => range.blur());
  range.addEventListener('pointerup', () => range.blur());
  outputs[s.id] = { range, out, s };
  slidersEl.appendChild(row);
}
document.getElementById('defaults').addEventListener('click', (e) => {
  for (const { range, out, s } of Object.values(outputs)) { opts[s.id] = s.def; range.value = s.def; out.textContent = s.fmt(s.def); }
  apply();
  e.currentTarget.blur();
});
document.getElementById('reset').addEventListener('click', (e) => { home(); e.currentTarget.blur(); });
document.getElementById('copy').addEventListener('click', async (e) => {
  const text = `Controls lab choice: ${SCHEMES[opts.scheme].name}, ${SLIDERS.map((s) => `${s.label.toLowerCase()} ${s.fmt(opts[s.id])}`).join(', ')}`;
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { /* clipboard blocked */ }
  document.getElementById('copied').textContent = ok ? 'Copied! Paste it in the chat.' : text;
  e.currentTarget.blur();
});
const panel = document.getElementById('panel');
if (window.innerWidth < 700) {
  panel.classList.add('collapsed');
  document.getElementById('toggle').textContent = 'Show';
}
document.getElementById('toggle').addEventListener('click', (e) => {
  panel.classList.toggle('collapsed');
  e.currentTarget.textContent = panel.classList.contains('collapsed') ? 'Show' : 'Hide';
  e.currentTarget.blur();
});
// Keep panel taps from steering Pip.
for (const t of ['touchstart', 'touchmove', 'mousedown']) panel.addEventListener(t, (e) => e.stopPropagation());

// Number keys 1-4 switch style without touching the panel.
window.addEventListener('keydown', (e) => {
  const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (i >= 0) { opts.scheme = Object.keys(SCHEMES)[i]; apply(); }
  if (e.code === 'KeyR') home();
});

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(ratio);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 75 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const hud = document.getElementById('hud');
const clock = new THREE.Clock();
let acc = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  input.update(dt);
  acc += dt;
  while (acc >= STEP) {
    player.update(STEP, input, follow.yaw);
    for (const e of level.update(STEP, player, clock.elapsedTime) ?? []) {
      if (e.type === 'checkpoint') player.setCheckpoint(e.position);
    }
    acc -= STEP;
  }
  follow.update(dt, player.position, input);
  hud.textContent = `${SCHEMES[opts.scheme].name} · 1-4 switch style · R restart`;
  window.__LAB__ = { scheme: opts.scheme, player: player.position.toArray(), yaw: follow.yaw, distance: follow.distance };
  composer.render();
  requestAnimationFrame(frame);
}

resize();
apply();
home();
requestAnimationFrame(frame);
