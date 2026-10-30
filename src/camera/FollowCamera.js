// Third-person orbit camera that follows Pip, avoids clipping into level geometry,
// and drifts behind the direction of travel when the player isn't steering it.
import * as THREE from 'three';

const _ray = new THREE.Ray();
const _hit = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _box = new THREE.Box3();

export const CAMERA = {
  distance: 6.5,
  minDistance: 1.2,
  pivotHeight: 1.3,
  pitchMin: -0.45,
  pitchMax: 1.25,
  defaultPitch: 0.32,
  followXZ: 14, // smoothing rates (1/s)
  followYUp: 4,
  followYDown: 9,
  autoYawDelay: 1.2, // seconds after manual look before auto-follow resumes
  autoYawRate: 0.9,
  menuOrbit: 0.12, // radians/s behind menus
  clipPadding: 0.3,
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class FollowCamera {
  constructor(camera, { collidables = [], settings = {} } = {}) {
    this.camera = camera;
    this.collidables = collidables;
    this.c = { ...CAMERA, ...settings };
    this._yaw = 0;
    this.pitch = this.c.defaultPitch;
    this.distance = this.c.distance; // current (after collision)
    this.pivot = new THREE.Vector3();
    this.lastTarget = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.sinceLook = 99;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.time = 0;
  }

  get yaw() { return this._yaw; }
  set yaw(v) { this._yaw = wrap(v); }

  snap(target) {
    this.pivot.set(target.x, target.y + this.c.pivotHeight, target.z);
    this.lastTarget.copy(target);
    this.velocity.set(0, 0, 0);
    this.distance = this.c.distance;
    this._place(0, true);
  }

  // Short screen shake, e.g. on ground pound.
  shake(magnitude = 0.25, time = 0.25) {
    this.shakeMag = Math.max(this.shakeMag, magnitude);
    this.shakeT = Math.max(this.shakeT, time);
  }

  update(dt, target, input) {
    this.time += dt;
    const c = this.c;
    if (dt > 0) {
      this.velocity.copy(target).sub(this.lastTarget).divideScalar(dt);
      // A teleport (respawn) shouldn't look like enormous speed.
      if (this.velocity.lengthSq() > 40 * 40) { this.snap(target); return; }
    }
    this.lastTarget.copy(target);

    const s = input?.state;
    if (s) {
      const lx = s.lookX || 0, ly = s.lookY || 0;
      this.yaw = this._yaw - lx;
      this.pitch = THREE.MathUtils.clamp(this.pitch + ly, c.pitchMin, c.pitchMax);
      this.sinceLook = lx || ly ? 0 : this.sinceLook + dt;

      // Auto-follow: swing gently behind sideways/away travel, never when the player runs at the camera.
      const sp = Math.hypot(this.velocity.x, this.velocity.z);
      if (this.sinceLook > c.autoYawDelay && sp > 2) {
        const heading = Math.atan2(-this.velocity.x, -this.velocity.z); // yaw that puts the camera behind travel
        const diff = wrap(heading - this._yaw);
        if (Math.abs(diff) < Math.PI * 0.75) {
          this.yaw = this._yaw + diff * Math.min(1, c.autoYawRate * dt * (sp / 7.5) * Math.abs(Math.sin(diff)));
        }
        this.pitch += (c.defaultPitch - this.pitch) * Math.min(1, dt * 0.6);
      }
    } else {
      this.yaw = this._yaw + c.menuOrbit * dt;
      this.pitch += (c.defaultPitch - this.pitch) * Math.min(1, dt);
    }

    // Pivot follows the target; vertical follow is lazier going up so jumps feel stable.
    const want = _desired.set(target.x, target.y + c.pivotHeight, target.z);
    const kx = 1 - Math.exp(-c.followXZ * dt);
    this.pivot.x += (want.x - this.pivot.x) * kx;
    this.pivot.z += (want.z - this.pivot.z) * kx;
    const ky = 1 - Math.exp(-(want.y > this.pivot.y ? c.followYUp : c.followYDown) * dt);
    this.pivot.y += (want.y - this.pivot.y) * ky;
    // Never let Pip leave a vertical band around the pivot.
    this.pivot.y = THREE.MathUtils.clamp(this.pivot.y, want.y - 2.2, want.y + 1.6);

    this._place(dt, false);
  }

  _offsetDir(out) {
    const cp = Math.cos(this.pitch);
    return out.set(Math.sin(this._yaw) * cp, Math.sin(this.pitch), Math.cos(this._yaw) * cp);
  }

  // Distance from the pivot along `dir` before hitting a collidable, capped at `max`.
  clipDistance(origin, dir, max) {
    let best = max;
    _ray.set(origin, dir);
    for (const col of this.collidables) {
      const b = col.box ?? col;
      // Ignore boxes containing the pivot (e.g. Pip standing in a doorway) so we don't snap to zero.
      if (b.containsPoint(origin)) continue;
      _box.copy(b).expandByScalar(this.c.clipPadding);
      if (_ray.intersectBox(_box, _hit)) {
        const d = _hit.distanceTo(origin);
        if (d < best) best = d;
      }
    }
    return Math.max(best, this.c.minDistance);
  }

  _place(dt, instant) {
    const c = this.c;
    const dir = this._offsetDir(_dir);
    const allowed = this.clipDistance(this.pivot, dir, c.distance);
    // Pull in instantly when blocked, ease back out when clear.
    if (instant || allowed < this.distance) this.distance = allowed;
    else this.distance += (allowed - this.distance) * (1 - Math.exp(-3 * dt));
    const cam = this.camera;
    cam.position.copy(this.pivot).addScaledVector(dir, this.distance);
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.max(0, this.shakeT) / 0.25;
      sx = Math.sin(this.time * 90) * m;
      sy = Math.cos(this.time * 77) * m;
      cam.position.x += sx;
      cam.position.y += sy;
    }
    cam.lookAt(this.pivot.x + sx * 0.5, this.pivot.y + sy * 0.5, this.pivot.z);
  }
}
