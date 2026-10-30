// STUB from the scaffold. The controls thread replaces this file.
import * as THREE from 'three';

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.35;
    this.distance = 8;
    this.target = new THREE.Vector3();
  }
  snap(target) { this.target.copy(target); this.place(); }
  update(dt, target, input) {
    if (input) { this.yaw -= input.state.lookX * 0.005; }
    this.target.lerp(target, 1 - Math.exp(-10 * dt));
    this.place();
  }
  place() {
    const t = this.target;
    this.camera.position.set(
      t.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      t.y + 1.5 + Math.sin(this.pitch) * this.distance,
      t.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    );
    this.camera.lookAt(t.x, t.y + 1.2, t.z);
  }
}
