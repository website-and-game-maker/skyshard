import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBoss, updateBoss, hitBoss, waveHits, BOSS } from './boss.js';
import { createEnemies } from './index.js';

const player = (x, y, z) => ({ position: new THREE.Vector3(x, y, z), velocity: new THREE.Vector3(), halfWidth: 0.35, height: 1.1 });
const run = (e, p, seconds, until) => {
  for (let k = 0; k < seconds * 60; k++) {
    updateBoss(e, 1 / 60, p);
    if (until?.(e)) return true;
  }
  return false;
};

describe('bosses', () => {
  it('stay asleep until Pip enters the arena', () => {
    const e = createBoss({ type: 'bramble', home: new THREE.Vector3(), arenaRadius: 10 });
    run(e, player(0, 0, 30), 3);
    expect(e.active).toBe(false);
    run(e, player(0, 0, 5), 0.1);
    expect(e.active).toBe(true);
  });

  it('Bramblebrute charges, rams the rim and becomes stompable', () => {
    const e = createBoss({ type: 'bramble', home: new THREE.Vector3(), arenaRadius: 10 });
    const p = player(3, 0, 3);
    expect(run(e, p, 10, (s) => s.mode === 'dizzy')).toBe(true);
    expect(Math.hypot(e.pos.x, e.pos.z)).toBeGreaterThan(8.5);
    expect(hitBoss(e)).toBe('hit');
    expect(e.hp).toBe(2);
    expect(hitBoss(e)).toBe(null); // not dizzy any more: no double hits
  });

  it('cannot be hurt outside the dizzy window, and falls after enough hits', () => {
    const e = createBoss({ type: 'bramble', home: new THREE.Vector3(), arenaRadius: 10, hp: 2 });
    expect(hitBoss(e)).toBe(null);
    const p = player(3, 0, 3);
    run(e, p, 10, (s) => s.mode === 'dizzy');
    hitBoss(e);
    run(e, p, 12, (s) => s.mode === 'dizzy');
    expect(hitBoss(e)).toBe('defeated');
    expect(e.alive).toBe(false);
  });

  it('Cinderhorn slams send fire rings that a jump clears, and three slams wind it', () => {
    const e = createBoss({ type: 'cinder', home: new THREE.Vector3(), arenaRadius: 11 });
    const p = player(4, 0, 0);
    let slams = 0;
    let ringHit = false;
    for (let k = 0; k < 60 * 20 && e.mode !== 'dizzy'; k++) {
      const out = updateBoss(e, 1 / 60, p);
      if (out?.slam) slams++;
      if (waveHits(e, p)) ringHit = true;
      p.position.y = 0;
      expect(waveHits(e, player(p.position.x, 2, p.position.z))).toBe(null); // airborne Pip is safe
    }
    expect(slams).toBe(BOSS.cinder.slamsPerDizzy);
    expect(e.mode).toBe('dizzy');
    expect(ringHit).toBe(true);
  });

  it('the Gloamking shoots from the air, then dives and lands stunned', () => {
    const e = createBoss({ type: 'gloam', home: new THREE.Vector3(), arenaRadius: 11 });
    const p = player(2, 0, 2);
    let shots = 0;
    for (let k = 0; k < 60 * 15 && e.mode !== 'dizzy'; k++) if (updateBoss(e, 1 / 60, p)?.vel) shots++;
    expect(shots).toBeGreaterThan(2);
    expect(e.mode).toBe('dizzy');
    expect(e.pos.y).toBeCloseTo(0, 5);
  });

  it('enemies module reports bossStart, bossHit and bossDefeated', () => {
    const scene = new THREE.Scene();
    const level = { colliders: [], enemySpawns: [{ kind: 'boss', type: 'bramble', name: 'Test', home: new THREE.Vector3(), arenaRadius: 10, hp: 1 }] };
    const enemies = createEnemies({ scene, level });
    const p = { ...player(3, 0, 3), groundPounding: false, invulnerable: true };
    const events = [];
    for (let k = 0; k < 60 * 10 && enemies.boss.mode !== 'dizzy'; k++) events.push(...enemies.update(1 / 60, p));
    expect(events.some((e) => e.type === 'bossStart')).toBe(true);
    // Drop onto its head while it is dizzy.
    const b = enemies.boss;
    p.position.set(b.pos.x, b.pos.y + 1.5, b.pos.z);
    p.velocity.set(0, -5, 0);
    const hit = enemies.update(1 / 60, p);
    expect(hit.some((e) => e.type === 'bossDefeated')).toBe(true);
  });
});
