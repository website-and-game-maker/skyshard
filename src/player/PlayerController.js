// Pure movement and collision for Pip. No rendering here, so it runs in unit tests.
// Position is the centre of the feet. The body is an upright box (halfWidth x height).
import { Box3, Vector3 } from 'three';
import { Emitter } from './Emitter.js';
import { TUNING } from './tuning.js';

const _box = new Box3();
const _wish = new Vector3();

export const STATE = { GROUND: 'ground', AIR: 'air', DASH: 'dash', POUND: 'pound', HURT: 'hurt' };

const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

export class PlayerController extends Emitter {
  constructor({ world = { colliders: [], killY: -50 }, spawn = new Vector3(), tuning = {} } = {}) {
    super();
    this.t = { ...TUNING, ...tuning };
    this.world = world;
    this.position = spawn.clone();
    this.velocity = new Vector3();
    this.checkpoint = spawn.clone();
    this.facing = 0; // yaw in radians, 0 = facing -Z
    this.state = STATE.AIR;
    this.grounded = false;
    this.ground = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airJumps = 1;
    this.airDash = true;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = new Vector3();
    this.poundTimer = 0;
    this.recover = 0;
    this.invuln = 0;
    this.stun = 0;
    this.jumping = false; // rising from a held jump (eligible for jump cut)
    this.frozen = false;
    this.airTime = 0;
    this.fallen = false;
    this._seen = null; // last press counters seen from Input (see _latch)
    this._in = { moveX: 0, moveY: 0, jump: false, jumpPressed: false, jumpReleased: false, dashPressed: false, poundPressed: false };
  }

  // Input.update() runs once per rendered frame but update() may run 0..n times per frame.
  // Input exposes monotonic press counters, so each press is applied exactly once no matter
  // how many simulation steps happen. Plain state objects (tests) fall back to *Pressed flags.
  _latch(s) {
    const o = this._in;
    o.moveX = s.moveX || 0;
    o.moveY = s.moveY || 0;
    o.jump = !!s.jump;
    o.faceCamera = !!s.faceCamera;
    o.backpedal = !!s.backpedal;
    const c = s.counts;
    if (c) {
      const seen = this._seen ?? { ...c };
      o.jumpPressed = c.jump !== seen.jump;
      o.dashPressed = c.dash !== seen.dash;
      o.poundPressed = c.pound !== seen.pound;
      o.jumpReleased = c.jumpRelease !== seen.jumpRelease;
      this._seen = { ...c };
    } else {
      o.jumpPressed = !!s.jumpPressed;
      o.dashPressed = !!s.dashPressed;
      o.poundPressed = !!s.poundPressed;
      o.jumpReleased = !!s.jumpReleased;
    }
    return o;
  }

  get halfWidth() { return this.t.halfWidth; }
  get height() { return this.t.height; }
  get groundPounding() { return this.state === STATE.POUND; }
  get dashing() { return this.state === STATE.DASH; }
  get invulnerable() { return this.invuln > 0; }

  // Plain snapshot the level/enemy code reads each frame.
  get body() {
    return {
      position: this.position, velocity: this.velocity,
      halfWidth: this.t.halfWidth, height: this.t.height,
      groundPounding: this.groundPounding, dashing: this.dashing, invulnerable: this.invulnerable,
    };
  }

  getBox(target = new Box3(), pos = this.position) {
    const hw = this.t.halfWidth;
    target.min.set(pos.x - hw, pos.y, pos.z - hw);
    target.max.set(pos.x + hw, pos.y + this.t.height, pos.z + hw);
    return target;
  }

  setCheckpoint(p) { this.checkpoint.copy(p); }

  respawn(p = this.checkpoint) {
    this.position.copy(p);
    this.velocity.set(0, 0, 0);
    this.state = STATE.AIR;
    this.grounded = false;
    this.ground = null;
    this.dashTimer = this.poundTimer = this.recover = this.stun = 0;
    this.invuln = 1;
    this.fallen = false;
    this.facing = this.facing || 0;
    this.emit('respawn', { position: this.position });
  }

  // Launch upward (enemy stomp, springs). Restores air moves.
  bounce(speed = this.t.stompBounce) {
    this.velocity.y = speed;
    this.state = STATE.AIR;
    this.grounded = false;
    this.ground = null;
    this.jumping = false;
    this.airJumps = 1;
    this.airDash = true;
    this.poundTimer = 0;
    this.emit('bounce', { speed });
  }

  hurt(knockback = new Vector3(0, 6, 0)) {
    if (this.invuln > 0) return false;
    this.velocity.copy(knockback);
    if (this.velocity.y < 4) this.velocity.y = 4;
    this.state = STATE.HURT;
    this.grounded = false;
    this.ground = null;
    this.invuln = this.t.hurtInvuln;
    this.stun = this.t.hurtStun;
    this.emit('hurt', { knockback });
    return true;
  }

  update(dt, input, cameraYaw = 0) {
    if (this.frozen) return;
    dt = Math.min(dt, 1 / 20);
    const t = this.t;
    const s = this._latch(input?.state ?? input ?? {});

    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.recover = Math.max(0, this.recover - dt);
    this.coyote = this.grounded ? t.coyoteTime : Math.max(0, this.coyote - dt);
    this.jumpBuffer = s.jumpPressed ? t.jumpBuffer : Math.max(0, this.jumpBuffer - dt);

    // Camera-relative wish direction.
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    const mx = s.moveX || 0, my = s.moveY || 0;
    _wish.set(cos * mx - sin * my, 0, -sin * mx - cos * my);
    const wishLen = Math.min(1, _wish.length());
    if (wishLen > 0) _wish.normalize();

    if (this.state === STATE.HURT) {
      this.stun -= dt;
      if (this.stun <= 0) this.state = this.grounded ? STATE.GROUND : STATE.AIR;
    }

    const canAct = this.state !== STATE.HURT && this.recover <= 0;

    // Ground pound start.
    if (canAct && s.poundPressed && !this.grounded && this.state !== STATE.POUND) {
      this.state = STATE.POUND;
      this.poundTimer = t.poundHang;
      this.velocity.set(0, 0, 0);
      this.jumping = false;
      this.emit('poundStart', {});
    }

    // Dash start.
    if (canAct && s.dashPressed && this.state !== STATE.DASH && this.state !== STATE.POUND
        && this.dashCooldown <= 0 && (this.grounded || this.airDash)) {
      this.state = STATE.DASH;
      this.dashTimer = t.dashTime;
      this.dashCooldown = t.dashCooldown;
      if (!this.grounded) this.airDash = false;
      if (wishLen > 0.1) this.dashDir.copy(_wish);
      else this.dashDir.set(-Math.sin(this.facing), 0, -Math.cos(this.facing));
      this.facing = Math.atan2(-this.dashDir.x, -this.dashDir.z);
      this.jumping = false;
      this.emit('dash', { direction: this.dashDir.clone() });
    }

    // Jumps.
    if (canAct && this.jumpBuffer > 0 && this.state !== STATE.POUND) {
      if (this.grounded || this.coyote > 0) {
        this._jump(t.jumpSpeed, 'jump');
      } else if (this.airJumps > 0 && this.state !== STATE.DASH) {
        this.airJumps--;
        this._jump(t.doubleJumpSpeed, 'doubleJump');
      }
    }
    if (s.jumpReleased && this.jumping && this.velocity.y > 0) {
      this.velocity.y *= t.jumpCutMult;
      this.jumping = false;
    }

    // Velocity by state.
    const v = this.velocity;
    if (this.state === STATE.DASH) {
      this.dashTimer -= dt;
      v.x = this.dashDir.x * t.dashSpeed;
      v.z = this.dashDir.z * t.dashSpeed;
      v.y = 0;
      if (this.dashTimer <= 0) {
        this.state = this.grounded ? STATE.GROUND : STATE.AIR;
        v.x = this.dashDir.x * t.dashEndSpeed;
        v.z = this.dashDir.z * t.dashEndSpeed;
      }
    } else if (this.state === STATE.POUND) {
      v.x = v.z = 0;
      if (this.poundTimer > 0) {
        this.poundTimer -= dt;
        v.y = 0;
      } else {
        v.y = -t.poundSpeed;
      }
    } else {
      const control = this.state === STATE.HURT ? 0.2 : 1;
      const target = t.runSpeed * wishLen * (s.backpedal ? t.backpedalMult : 1);
      const accel = (this.grounded ? (wishLen > 0 ? t.groundAccel : t.groundDecel) : (wishLen > 0 ? t.airAccel : t.airDecel)) * control;
      if (wishLen > 0) {
        const tx = _wish.x * target, tz = _wish.z * target;
        // Accelerate the velocity vector toward the target vector.
        const dx = tx - v.x, dz = tz - v.z;
        const d = Math.hypot(dx, dz);
        const step = Math.min(d, accel * dt);
        if (d > 0) { v.x += (dx / d) * step; v.z += (dz / d) * step; }
      } else {
        const sp = Math.hypot(v.x, v.z);
        const ns = approach(sp, 0, accel * dt);
        if (sp > 0) { v.x *= ns / sp; v.z *= ns / sp; }
      }
      const g = v.y < 0 || !this.jumping ? t.gravity * t.fallGravityMult : t.gravity;
      v.y = Math.max(v.y - g * dt, -t.maxFallSpeed);
      if (v.y <= 0) this.jumping = false;
    }

    // Facing follows travel direction (tank scheme: follows the camera, and backing up keeps facing).
    const canTurn = this.state !== STATE.POUND && this.state !== STATE.HURT;
    const turnToTravel = Math.hypot(v.x, v.z) > 0.5 && wishLen > 0.05 && !s.backpedal;
    if (canTurn && (turnToTravel || s.faceCamera)) {
      const want = s.faceCamera ? cameraYaw : Math.atan2(-_wish.x, -_wish.z);
      let diff = want - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const maxTurn = t.turnSpeed * dt;
      this.facing += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
    }

    this._move(dt);

    if (!this.grounded) this.airTime += dt;

    if (!this.fallen && this.position.y < (this.world.killY ?? -50)) {
      this.fallen = true; // main decides what happens next (usually respawn)
      this.emit('fall', { position: this.position.clone() });
    }
  }

  _jump(speed, kind) {
    this.velocity.y = speed;
    this.grounded = false;
    this.ground = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumping = true;
    if (this.state === STATE.GROUND) this.state = STATE.AIR;
    this.emit(kind, { position: this.position.clone() });
  }

  _move(dt) {
    const p = this.position, v = this.velocity;
    const colliders = this.world.colliders ?? [];
    const wasGrounded = this.grounded;
    const fallSpeed = -v.y;

    // Ride moving platforms.
    if (this.ground?.velocity && colliders.includes(this.ground)) {
      const gv = this.ground.velocity;
      this._step('x', gv.x * dt, colliders);
      this._step('z', gv.z * dt, colliders);
      if (gv.y > 0) this._step('y', gv.y * dt, colliders);
      else p.y += gv.y * dt; // the ground check below snaps us back onto it
    }

    this._step('x', v.x * dt, colliders, wasGrounded);
    this._step('z', v.z * dt, colliders, wasGrounded);

    this.grounded = false;
    let landedOn = null;
    const hit = this._step('y', v.y * dt, colliders);
    if (hit && v.y <= 0) landedOn = hit;
    else if (hit && v.y > 0) {
      v.y = 0;
      this.jumping = false;
      this.emit('bonk', {});
    }

    // Stay glued to the ground when walking down small slopes or descending platforms.
    if (!landedOn && wasGrounded && v.y <= 0 && this.state !== STATE.DASH) {
      const snap = this._probeDown(colliders, this.t.stepHeight);
      if (snap) { p.y = snap.box.max.y; landedOn = snap; }
    }

    if (landedOn) {
      if (landedOn.bouncy) {
        this.bounce(typeof landedOn.bouncy === 'number' ? landedOn.bouncy : this.t.springSpeed);
        this.emit('spring', { collider: landedOn });
        return;
      }
      this.grounded = true;
      this.ground = landedOn;
      v.y = 0;
      this.airJumps = 1;
      this.airDash = true;
      if (!wasGrounded) {
        const pounded = this.state === STATE.POUND;
        this.emit('land', { speed: fallSpeed, pound: pounded, airTime: this.airTime, collider: landedOn });
        if (pounded) {
          this.emit('pound', { position: p.clone(), collider: landedOn });
          this.recover = this.t.poundRecover;
          this.state = STATE.GROUND;
        }
        this.airTime = 0;
      }
      if (this.state === STATE.AIR) this.state = STATE.GROUND;
    } else {
      this.ground = null;
      if (this.state === STATE.GROUND) this.state = STATE.AIR;
    }
  }

  // Move along one axis and push out of any overlapping collider. Returns the last collider hit.
  _step(axis, delta, colliders, allowStepUp = false) {
    if (delta === 0) return null;
    const p = this.position;
    const n = Math.max(1, Math.ceil(Math.abs(delta) / this.t.maxSubstep));
    const d = delta / n;
    let hitAny = null;
    for (let i = 0; i < n; i++) {
      p[axis] += d;
      const hit = this._resolve(axis, d, colliders, allowStepUp);
      if (hit) {
        hitAny = hit;
        if (hit !== 'stepped') {
          if (axis !== 'y') this.velocity[axis] = 0;
          break;
        }
      }
    }
    return hitAny === 'stepped' ? null : hitAny;
  }

  _resolve(axis, d, colliders, allowStepUp) {
    const hw = this.t.halfWidth;
    const me = this.getBox(_box);
    let hit = null;
    for (const c of colliders) {
      const b = c.box;
      if (!me.intersectsBox(b)) continue;
      // Ignore touching faces (intersectsBox is inclusive).
      if (me.max.x <= b.min.x || me.min.x >= b.max.x || me.max.y <= b.min.y || me.min.y >= b.max.y
          || me.max.z <= b.min.z || me.min.z >= b.max.z) continue;
      if (axis !== 'y' && allowStepUp && b.max.y - this.position.y <= this.t.stepHeight && this._clearAt(b.max.y, colliders)) {
        this.position.y = b.max.y;
        this.getBox(me);
        hit = hit ?? 'stepped';
        continue;
      }
      if (axis === 'y') {
        this.position.y = d > 0 ? b.min.y - this.t.height : b.max.y;
      } else {
        this.position[axis] = d > 0 ? b.min[axis] - hw : b.max[axis] + hw;
      }
      this.getBox(me);
      hit = c;
    }
    return hit;
  }

  _clearAt(y, colliders) {
    const test = this.getBox(new Box3(), new Vector3(this.position.x, y + 0.001, this.position.z));
    return !colliders.some((c) => test.intersectsBox(c.box)
      && test.max.y > c.box.min.y && test.min.y < c.box.max.y
      && test.max.x > c.box.min.x && test.min.x < c.box.max.x
      && test.max.z > c.box.min.z && test.min.z < c.box.max.z);
  }

  _probeDown(colliders, dist) {
    const hw = this.t.halfWidth, p = this.position;
    let best = null;
    for (const c of colliders) {
      const b = c.box;
      if (p.x + hw <= b.min.x || p.x - hw >= b.max.x || p.z + hw <= b.min.z || p.z - hw >= b.max.z) continue;
      const gap = p.y - b.max.y;
      if (gap >= -0.001 && gap <= dist && (!best || b.max.y > best.box.max.y)) best = c;
    }
    return best;
  }
}
