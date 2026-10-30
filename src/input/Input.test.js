// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { Input, applyDeadzone, clampStick } from './Input.js';

const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));

function fakePad({ axes = [0, 0, 0, 0], pressed = [] } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 }));
  return { connected: true, axes, buttons };
}

function touchEvent(type, target, touches) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  const list = touches.map((t) => ({ identifier: t.id, clientX: t.x, clientY: t.y, target }));
  Object.defineProperty(e, 'changedTouches', { value: list });
  target.dispatchEvent(e);
  return e;
}

describe('stick helpers', () => {
  it('applies a radial deadzone and rescales to full range', () => {
    expect(applyDeadzone(0.1, 0.1)).toEqual([0, 0]);
    const [x, y] = applyDeadzone(1, 0);
    expect(x).toBeCloseTo(1);
    expect(y).toBe(0);
    const [hx] = applyDeadzone(0.59, 0);
    expect(hx).toBeGreaterThan(0.45);
    expect(hx).toBeLessThan(0.55);
  });
  it('clamps diagonals to unit length', () => {
    const [x, y] = clampStick(1, 1);
    expect(Math.hypot(x, y)).toBeCloseTo(1);
  });
});

describe('Input (keyboard)', () => {
  let input;
  beforeEach(() => {
    input?.dispose();
    document.body.innerHTML = '';
    input = new Input({ element: document.body, window, nav: { getGamepads: () => [] }, touch: false });
  });

  it('maps WASD and arrows to movement with +Y forward', () => {
    key('keydown', 'KeyW');
    key('keydown', 'KeyD');
    const s = input.update();
    expect(s.moveY).toBeGreaterThan(0.7);
    expect(s.moveX).toBeGreaterThan(0.7);
    expect(Math.hypot(s.moveX, s.moveY)).toBeCloseTo(1);
    key('keyup', 'KeyW');
    key('keyup', 'KeyD');
    key('keydown', 'ArrowDown');
    expect(input.update().moveY).toBe(-1);
  });

  it('reports *Pressed for exactly one update and counts presses', () => {
    key('keydown', 'Space');
    expect(input.update().jumpPressed).toBe(true);
    expect(input.state.counts.jump).toBe(1);
    expect(input.update().jumpPressed).toBe(false);
    expect(input.state.jump).toBe(true);
    key('keyup', 'Space');
    const s = input.update();
    expect(s.jump).toBe(false);
    expect(s.jumpReleased).toBe(true);
    expect(s.counts.jumpRelease).toBe(1);
  });

  it('maps dash, pound and pause keys', () => {
    key('keydown', 'ShiftLeft');
    key('keydown', 'KeyC');
    key('keydown', 'Escape');
    const s = input.update();
    expect(s.dashPressed && s.poundPressed && s.pausePressed).toBe(true);
  });

  it('clears held keys when the window loses focus', () => {
    key('keydown', 'KeyW');
    window.dispatchEvent(new Event('blur'));
    expect(input.update().moveY).toBe(0);
  });

  it('setOptions changes sensitivity and invertY', () => {
    input.setOptions({ sensitivity: 2, invertY: true });
    expect(input.mouseSensitivity).toBeCloseTo(0.005);
    expect(input.invertY).toBe(true);
  });

  it('dispose removes listeners', () => {
    input.dispose();
    key('keydown', 'KeyW');
    expect(input.update().moveY).toBe(0);
  });
});

describe('Input (gamepad)', () => {
  it('reads sticks with deadzone and standard buttons', () => {
    let pad = fakePad({ axes: [0, -1, 0.05, 0], pressed: [0] });
    const input = new Input({ element: document.body, window, nav: { getGamepads: () => [null, pad] }, touch: false });
    let s = input.update(1 / 60);
    expect(s.moveY).toBeCloseTo(1); // stick up is forward
    expect(s.lookX).toBe(0);
    expect(s.jumpPressed).toBe(true);
    expect(input.lastDevice).toBe('gamepad');
    pad = fakePad({ pressed: [2, 1, 9] });
    s = input.update(1 / 60);
    expect(s.dashPressed && s.poundPressed && s.pausePressed).toBe(true);
    expect(s.moveY).toBe(0);
    input.dispose();
  });
});

describe('Input (touch)', () => {
  let input, root;
  beforeEach(() => {
    input?.dispose();
    document.body.innerHTML = '';
    root = document.body;
    Object.defineProperty(root, 'clientWidth', { value: 800, configurable: true });
    input = new Input({ element: root, window, nav: { getGamepads: () => [] }, touch: true });
  });

  it('builds the overlay with test ids and 44px+ buttons', () => {
    const stick = document.querySelector('[data-testid="touch-stick"]');
    const jump = document.querySelector('[data-testid="touch-jump"]');
    expect(stick).toBeTruthy();
    expect(jump).toBeTruthy();
    const css = document.getElementById('ss-touch-style').textContent;
    for (const sel of ['.ss-jump', '.ss-dash', '.ss-pound']) {
      const rule = css.split('\n').find((l) => l.startsWith(sel + '{'));
      expect(parseInt(rule.match(/width:(\d+)px/)[1], 10)).toBeGreaterThanOrEqual(44);
    }
  });

  it('left-side drag moves, right-side drag looks', () => {
    touchEvent('touchstart', root, [{ id: 1, x: 100, y: 300 }]);
    touchEvent('touchmove', root, [{ id: 1, x: 100, y: 250 }]);
    touchEvent('touchstart', root, [{ id: 2, x: 600, y: 300 }]);
    touchEvent('touchmove', root, [{ id: 2, x: 650, y: 300 }]);
    const s = input.update();
    expect(s.moveY).toBeCloseTo(1); // dragged up a full radius
    expect(s.lookX).toBeGreaterThan(0);
    expect(input.lastDevice).toBe('touch');
    touchEvent('touchend', root, [{ id: 1, x: 100, y: 250 }]);
    expect(input.update().moveY).toBe(0);
    expect(input.update().lookX).toBe(0); // look deltas are consumed
  });

  it('jump button produces a press', () => {
    const jump = document.querySelector('[data-testid="touch-jump"]');
    touchEvent('touchstart', jump, [{ id: 3, x: 700, y: 500 }]);
    expect(input.update().jumpPressed).toBe(true);
    touchEvent('touchend', jump, [{ id: 3, x: 700, y: 500 }]);
    expect(input.update().jump).toBe(false);
  });

  it('ignores touches and hides the overlay behind menus', () => {
    input.setTouchVisible(false);
    const e = touchEvent('touchstart', root, [{ id: 1, x: 100, y: 300 }]);
    expect(e.defaultPrevented).toBe(false);
    expect(document.querySelector('.ss-touch').classList.contains('hidden')).toBe(true);
  });
});
