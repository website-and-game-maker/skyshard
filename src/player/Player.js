// Player = movement controller + Pip's model + effects, wired to the CONTRACTS.md interface.
import * as THREE from 'three';
import { PlayerController, STATE } from './PlayerController.js';
import { PipModel } from './PipModel.js';
import { Effects } from './Effects.js';

export class Player {
  constructor({ scene, world, tuning } = {}) {
    this.scene = scene;
    this.world = world;
    this.controller = new PlayerController({ world, spawn: world?.spawn ?? new THREE.Vector3(), tuning });
    this.model = new PipModel();
    this.mesh = this.model.root;
    this.effects = scene ? new Effects(scene) : null;
    if (scene) {
      scene.add(this.mesh);
      this.model.attachScarf(scene);
    }
    this._trailTimer = 0;
    this._stepTimer = 0;
    this._wire();
  }

  // Contract fields.
  get position() { return this.controller.position; }
  get velocity() { return this.controller.velocity; }
  get grounded() { return this.controller.grounded; }
  get halfWidth() { return this.controller.halfWidth; }
  get height() { return this.controller.height; }
  get groundPounding() { return this.controller.groundPounding; }
  get dashing() { return this.controller.dashing; }
  get invulnerable() { return this.controller.invulnerable; }
  get facing() { return this.controller.facing; }
  get state() { return this.controller.state; }

  on(name, fn) { return this.controller.on(name, fn); }
  setCheckpoint(pos) { this.controller.setCheckpoint(pos); }
  respawn(pos) {
    this.controller.respawn(pos ?? this.controller.checkpoint);
    this.model.resetScarf();
    this.model.impulse(-3);
    this.effects?.sparkle(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 16);
    this._render(0);
  }
  hurt(knockback) { return this.controller.hurt(knockback); }
  bounce(speed) { this.controller.bounce(speed); }

  update(dt, input, cameraYaw = 0) {
    this.controller.update(dt, input, cameraYaw);
    this._render(dt);
  }

  _wire() {
    const c = this.controller, m = this.model, fx = () => this.effects;
    const feet = () => this.position.clone();
    c.on('jump', () => { m.impulse(4); fx()?.dust(feet(), 6, 1.8); });
    c.on('doubleJump', () => { m.impulse(3); m.startSpin(); fx()?.sparkle(feet().add(new THREE.Vector3(0, 0.3, 0)), 12, 0xbff8ff); });
    c.on('dash', () => { m.impulse(-2); fx()?.sparkle(feet().add(new THREE.Vector3(0, 0.5, 0)), 8, 0xffb347); });
    c.on('poundStart', () => { m.startSpin(); m.impulse(2); });
    c.on('land', ({ speed, pound }) => {
      if (pound) return;
      m.impulse(-Math.min(speed * 0.35, 6));
      if (speed > 6) fx()?.dust(feet(), Math.round(Math.min(speed, 20) / 2), 2 + speed * 0.08);
    });
    c.on('pound', ({ position }) => { m.impulse(-7); fx()?.shockwave(position); });
    c.on('bounce', () => m.impulse(4));
    c.on('hurt', () => m.impulse(-3));
  }

  // Height of the highest surface below Pip, for the blob shadow.
  _groundBelow() {
    const p = this.position, hw = this.halfWidth * 0.5;
    let best = null;
    for (const col of this.world?.colliders ?? []) {
      const b = col.box;
      if (p.x < b.min.x - hw || p.x > b.max.x + hw || p.z < b.min.z - hw || p.z > b.max.z + hw) continue;
      if (b.max.y <= p.y + 0.05 && (best === null || b.max.y > best)) best = b.max.y;
    }
    return best;
  }

  _render(dt) {
    const c = this.controller;
    const v = c.velocity;
    const speed = Math.hypot(v.x, v.z);
    this.model.animate(dt, {
      position: c.position, facing: c.facing, speed, vy: v.y, grounded: c.grounded,
      state: c.state, runSpeed: c.t.runSpeed, invulnerable: c.invulnerable,
      dashing: c.state === STATE.DASH, pounding: c.state === STATE.POUND,
    });
    if (!this.effects) return;
    if (c.state === STATE.DASH) {
      this._trailTimer -= dt;
      if (this._trailTimer <= 0) { this.effects.trail(c.position); this._trailTimer = 0.015; }
    }
    if (c.grounded && speed > c.t.runSpeed * 0.7) {
      this._stepTimer -= dt;
      if (this._stepTimer <= 0) { this.effects.dust(c.position, 2, 0.8); this._stepTimer = 0.16; }
    }
    this.effects.update(dt, c.position, this._groundBelow());
  }

  dispose() {
    this.mesh.removeFromParent();
    this.model.dispose();
    this.effects?.dispose();
  }
}
