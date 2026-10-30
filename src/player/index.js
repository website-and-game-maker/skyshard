// STUB from the scaffold. The controls thread replaces this file.
import * as THREE from 'three';

export class Player {
  constructor({ scene, world }) {
    this.world = world;
    this.mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0xffb347 }));
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.halfWidth = 0.4;
    this.height = 1.4;
    this.grounded = false;
    this.groundPounding = false;
    this.invulnerable = false;
    this.checkpoint = new THREE.Vector3();
    this.handlers = {};
  }
  on(name, fn) { (this.handlers[name] ??= []).push(fn); }
  emit(name, p) { for (const fn of this.handlers[name] ?? []) fn(p); }
  update(dt, input, yaw) {
    const s = input.state;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = fwd.multiplyScalar(s.moveY).add(right.multiplyScalar(s.moveX)).multiplyScalar(7);
    this.velocity.x = move.x;
    this.velocity.z = move.z;
    if (this.grounded && s.jumpPressed) { this.velocity.y = 9; this.emit('jump'); }
    this.velocity.y -= 25 * dt;
    this.position.addScaledVector(this.velocity, dt);
    this.grounded = false;
    if (this.position.y < 0) { this.position.y = 0; this.velocity.y = 0; this.grounded = true; }
    if (this.position.y < this.world.killY) this.emit('fall');
    this.mesh.position.copy(this.position).y += 0.7;
  }
  respawn(pos) { this.position.copy(pos ?? this.checkpoint); this.velocity.set(0, 0, 0); }
  setCheckpoint(pos) { this.checkpoint.copy(pos); }
  hurt(knockback) { if (knockback) this.velocity.add(knockback); }
  bounce() { this.velocity.y = 10; }
}
