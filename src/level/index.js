// STUB from the scaffold. The level thread replaces this file.
import * as THREE from 'three';

export function createLevel({ scene }) {
  scene.background = new THREE.Color(0x8fb8ff);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x4a3b6b, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(10, 20, 5);
  sun.castShadow = true;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40), new THREE.MeshStandardMaterial({ color: 0x6cc56c }));
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);
  return {
    colliders: [{ box: new THREE.Box3(new THREE.Vector3(-20, -1, -20), new THREE.Vector3(20, 0, 20)) }],
    killY: -30,
    spawn: new THREE.Vector3(0, 0, 0),
    respawnPoint: new THREE.Vector3(0, 0, 0),
    shardsTotal: 0,
    shardsCollected: 0,
    shardsRequired: 0,
    update() { return []; },
    reset() {},
    dispose() {},
  };
}
