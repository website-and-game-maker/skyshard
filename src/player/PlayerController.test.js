import { describe, it, expect, vi } from 'vitest';
import { Box3, Vector3 } from 'three';
import { PlayerController, STATE } from './PlayerController.js';

const DT = 1 / 60;
const box = (x0, y0, z0, x1, y1, z1, extra = {}) => ({ box: new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1)), ...extra });
const floor = () => box(-50, -1, -50, 50, 0, 50);
const idle = () => ({ moveX: 0, moveY: 0, jump: false, jumpPressed: false, jumpReleased: false, dashPressed: false, poundPressed: false });

function make(colliders = [floor()], spawn = new Vector3(0, 0, 0)) {
  return new PlayerController({ world: { colliders, killY: -20 }, spawn });
}
function run(p, frames, input = idle(), yaw = 0) {
  for (let i = 0; i < frames; i++) p.update(DT, typeof input === 'function' ? input(i) : input, yaw);
}

describe('PlayerController', () => {
  it('falls under gravity and lands on the floor', () => {
    const p = make([floor()], new Vector3(0, 5, 0));
    const land = vi.fn();
    p.on('land', land);
    run(p, 120);
    expect(p.grounded).toBe(true);
    expect(p.position.y).toBeCloseTo(0, 5);
    expect(land).toHaveBeenCalledTimes(1);
  });

  it('runs forward relative to camera yaw', () => {
    const p = make();
    run(p, 60, { ...idle(), moveY: 1 });
    expect(p.position.z).toBeLessThan(-5); // yaw 0 forward is -Z
    expect(Math.abs(p.position.x)).toBeLessThan(1e-6);
    const q = make();
    run(q, 60, { ...idle(), moveY: 1 }, Math.PI / 2); // camera turned left: forward is -X
    expect(q.position.x).toBeLessThan(-5);
  });

  it('reaches but does not exceed run speed', () => {
    const p = make();
    run(p, 120, { ...idle(), moveX: 1 });
    const sp = Math.hypot(p.velocity.x, p.velocity.z);
    expect(sp).toBeCloseTo(p.t.runSpeed, 3);
  });

  it('stops when input is released', () => {
    const p = make();
    run(p, 60, { ...idle(), moveX: 1 });
    run(p, 60);
    expect(Math.hypot(p.velocity.x, p.velocity.z)).toBe(0);
  });

  it('jumps, then double jumps once, but not a third time', () => {
    const p = make();
    run(p, 2);
    const jumps = [];
    p.on('jump', () => jumps.push('jump'));
    p.on('doubleJump', () => jumps.push('double'));
    p.update(DT, { ...idle(), jump: true, jumpPressed: true });
    expect(p.velocity.y).toBeGreaterThan(10);
    run(p, 20, { ...idle(), jump: true });
    p.update(DT, { ...idle(), jumpPressed: true, jump: true });
    run(p, 5, { ...idle(), jump: true });
    p.update(DT, { ...idle(), jumpPressed: true, jump: true });
    expect(jumps).toEqual(['jump', 'double']);
  });

  it('variable jump: releasing early gives a lower jump', () => {
    const peak = (holdFrames) => {
      const p = make();
      run(p, 2);
      p.update(DT, { ...idle(), jump: true, jumpPressed: true });
      let maxY = 0;
      for (let i = 0; i < 90; i++) {
        const held = i < holdFrames;
        p.update(DT, { ...idle(), jump: held, jumpReleased: i === holdFrames });
        maxY = Math.max(maxY, p.position.y);
      }
      return maxY;
    };
    const full = peak(60), short = peak(3);
    expect(full).toBeGreaterThan(2);
    expect(short).toBeLessThan(full * 0.6);
  });

  it('coyote time allows a jump just after walking off a ledge', () => {
    const p = make([box(-5, -1, -5, 0.5, 0, 5)], new Vector3(0, 0, 0));
    run(p, 2);
    let f = 0;
    while (p.grounded && f++ < 100) p.update(DT, { ...idle(), moveX: 1 });
    expect(p.grounded).toBe(false);
    const jump = vi.fn();
    p.on('jump', jump);
    p.update(DT, { ...idle(), jump: true, jumpPressed: true });
    expect(jump).toHaveBeenCalled();
  });

  it('buffers a jump pressed just before landing', () => {
    const p = make([floor()], new Vector3(0, 0.3, 0));
    const jump = vi.fn();
    p.on('jump', jump);
    p.update(DT, { ...idle(), jump: true, jumpPressed: true }); // in the air, double jump consumes...
    // Use up the double jump first so the buffer must wait for the ground.
    const q = make([floor()], new Vector3(0, 3, 0));
    q.airJumps = 0;
    const qj = vi.fn();
    q.on('jump', qj);
    run(q, 1);
    while (q.position.y > 0.4) q.update(DT, idle());
    q.update(DT, { ...idle(), jump: true, jumpPressed: true });
    run(q, 6, { ...idle(), jump: true });
    expect(qj).toHaveBeenCalledTimes(1);
  });

  it('collides with walls instead of passing through', () => {
    const p = make([floor(), box(2, 0, -5, 3, 3, 5)]);
    run(p, 120, { ...idle(), moveX: 1 });
    expect(p.position.x).toBeCloseTo(2 - p.halfWidth, 5);
  });

  it('steps up small ledges but not tall ones', () => {
    const p = make([floor(), box(2, 0, -5, 20, 0.25, 5)]);
    run(p, 60, { ...idle(), moveX: 1 });
    expect(p.position.x).toBeGreaterThan(3);
    expect(p.position.y).toBeCloseTo(0.25, 5);
    const q = make([floor(), box(2, 0, -5, 6, 0.8, 5)]);
    run(q, 60, { ...idle(), moveX: 1 });
    expect(q.position.x).toBeLessThan(2);
  });

  it('bonks its head on ceilings', () => {
    const p = make([floor(), box(-5, 2, -5, 5, 3, 5)]);
    run(p, 2);
    p.update(DT, { ...idle(), jump: true, jumpPressed: true });
    run(p, 30, { ...idle(), jump: true });
    expect(p.position.y + p.height).toBeLessThanOrEqual(2 + 1e-6);
  });

  it('dashes fast in the move direction, then once in air', () => {
    const p = make();
    run(p, 2);
    const dash = vi.fn();
    p.on('dash', dash);
    p.update(DT, { ...idle(), moveX: 1, dashPressed: true });
    expect(p.state).toBe(STATE.DASH);
    expect(p.velocity.x).toBeCloseTo(p.t.dashSpeed);
    run(p, 30);
    expect(p.position.x).toBeGreaterThan(2.5);
    expect(dash).toHaveBeenCalledTimes(1);
    // Airborne: one dash, then none until landing.
    const q = make([floor()], new Vector3(0, 20, 0));
    const qd = vi.fn();
    q.on('dash', qd);
    q.update(DT, { ...idle(), dashPressed: true });
    run(q, 30);
    expect(q.grounded).toBe(false);
    q.update(DT, { ...idle(), dashPressed: true });
    expect(qd).toHaveBeenCalledTimes(1);
    run(q, 200);
    q.update(DT, { ...idle(), dashPressed: true });
    expect(qd).toHaveBeenCalledTimes(2);
  });

  it('dash keeps height (no gravity while dashing)', () => {
    const p = make([floor()], new Vector3(0, 10, 0));
    p.update(DT, { ...idle(), moveX: 1, dashPressed: true });
    const y = p.position.y;
    run(p, 5);
    expect(p.position.y).toBeCloseTo(y, 5);
  });

  it('ground pound hangs, slams down and emits pound on landing', () => {
    const p = make([floor()], new Vector3(0, 6, 0));
    const pound = vi.fn();
    p.on('pound', pound);
    p.update(DT, { ...idle(), poundPressed: true });
    expect(p.state).toBe(STATE.POUND);
    const y0 = p.position.y;
    run(p, 5);
    expect(p.position.y).toBeCloseTo(y0, 5);
    run(p, 60);
    expect(pound).toHaveBeenCalledTimes(1);
    expect(p.grounded).toBe(true);
    expect(p.groundPounding).toBe(false);
  });

  it('cannot ground pound while standing', () => {
    const p = make();
    run(p, 2);
    p.update(DT, { ...idle(), poundPressed: true });
    expect(p.state).toBe(STATE.GROUND);
  });

  it('emits fall exactly once below killY, and respawn() resets it', () => {
    const p = make([], new Vector3(0, 0, 0));
    p.setCheckpoint(new Vector3(3, 4, 5));
    const fall = vi.fn();
    p.on('fall', fall);
    run(p, 200);
    expect(fall).toHaveBeenCalledTimes(1);
    p.respawn();
    expect(p.position.toArray()).toEqual([3, 4, 5]);
    run(p, 200);
    expect(fall).toHaveBeenCalledTimes(2);
  });

  it('rides moving platforms', () => {
    const plat = box(-2, -1, -2, 2, 0, 2, { velocity: new Vector3(3, 0, 0) });
    const p = make([plat], new Vector3(0, 0, 0));
    run(p, 2);
    for (let i = 0; i < 60; i++) {
      plat.box.translate(new Vector3(3 * DT, 0, 0));
      p.update(DT, idle());
    }
    expect(p.grounded).toBe(true);
    expect(p.position.x).toBeCloseTo(3, 1);
  });

  it('stays on a platform moving down', () => {
    const plat = box(-2, -1, -2, 2, 0, 2, { velocity: new Vector3(0, -2, 0) });
    const p = make([plat], new Vector3(0, 0, 0));
    run(p, 2);
    for (let i = 0; i < 60; i++) {
      plat.box.translate(new Vector3(0, -2 * DT, 0));
      p.update(DT, idle());
      expect(p.grounded).toBe(true);
    }
    expect(p.position.y).toBeCloseTo(-2, 3);
  });

  it('bouncy colliders launch the player', () => {
    const p = make([box(-2, -1, -2, 2, 0, 2, { bouncy: 20 })], new Vector3(0, 1, 0));
    run(p, 20);
    expect(p.velocity.y).toBeGreaterThan(5);
  });

  it('hurt() knocks back and starts invulnerability; a second hit is ignored', () => {
    const p = make();
    run(p, 2);
    const hurt = vi.fn();
    p.on('hurt', hurt);
    expect(p.hurt(new Vector3(5, 6, 0))).toBe(true);
    expect(p.velocity.x).toBe(5);
    expect(p.invulnerable).toBe(true);
    expect(p.hurt(new Vector3(5, 6, 0))).toBe(false);
    expect(hurt).toHaveBeenCalledTimes(1);
    run(p, 100);
    expect(p.invulnerable).toBe(false);
  });

  it('hazard colliders are just solid (level/enemies handle damage)', () => {
    const p = make([box(-2, -1, -2, 2, 0, 2, { hazard: true })], new Vector3(0, 1, 0));
    const hurt = vi.fn();
    p.on('hurt', hurt);
    run(p, 60);
    expect(p.grounded).toBe(true);
    expect(hurt).not.toHaveBeenCalled();
  });

  it('boolean bouncy pads use the spring speed', () => {
    const p = make([box(-2, -1, -2, 2, 0, 2, { bouncy: true })], new Vector3(0, 0.5, 0));
    let maxVy = 0;
    for (let i = 0; i < 30; i++) { p.update(DT, idle()); maxVy = Math.max(maxVy, p.velocity.y); }
    expect(maxVy).toBeGreaterThan(p.t.springSpeed - 2);
  });

  it('latches presses from Input counters: one press applies once across many steps', () => {
    const p = make();
    run(p, 2, { state: { counts: { jump: 0, dash: 0, pound: 0, jumpRelease: 0 } } });
    const jumps = vi.fn();
    p.on('jump', jumps);
    p.on('doubleJump', jumps);
    const input = { state: { jump: true, counts: { jump: 1, dash: 0, pound: 0, jumpRelease: 0 } } };
    for (let i = 0; i < 6; i++) p.update(DT, input); // six sim steps in one rendered frame
    expect(jumps).toHaveBeenCalledTimes(1);
  });

  it('latches a press that happened during a frame with zero sim steps', () => {
    const p = make();
    run(p, 2, { state: { counts: { jump: 0, dash: 0, pound: 0, jumpRelease: 0 } } });
    const jump = vi.fn();
    p.on('jump', jump);
    // Press and release both happened before the next step ran.
    p.update(DT, { state: { jump: false, counts: { jump: 1, dash: 0, pound: 0, jumpRelease: 1 } } });
    expect(jump).toHaveBeenCalledTimes(1);
  });

  it('bounce() (enemy stomp) restores the double jump', () => {
    const p = make([], new Vector3(0, 10, 0));
    p.airJumps = 0;
    p.bounce();
    expect(p.velocity.y).toBe(p.t.stompBounce);
    expect(p.airJumps).toBe(1);
  });

  it('does not tunnel through thin floors at max fall speed', () => {
    const p = make([box(-5, -0.1, -5, 5, 0, 5)], new Vector3(0, 30, 0));
    run(p, 300);
    expect(p.position.y).toBeCloseTo(0, 5);
  });

  it('turns to face the travel direction', () => {
    const p = make();
    run(p, 60, { ...idle(), moveX: 1 });
    expect(Math.atan2(Math.sin(p.facing), Math.cos(p.facing))).toBeCloseTo(-Math.PI / 2, 2);
  });
});
