// Menu navigation for keyboards and gamepads, so every screen can be used
// without a mouse or touch.

// Standard gamepad mapping indices.
export const PAD = { A: 0, B: 1, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const STICK_DEADZONE = 0.55;
const REPEAT_DELAY = 0.35;
const REPEAT_RATE = 0.12;

// Turns raw gamepad snapshots into discrete menu actions with edge detection
// and held-direction auto repeat. Pure apart from its own state, for testing.
export function createPadReader() {
  const held = new Map();

  function press(name, down, dt, repeat, out) {
    const t = held.get(name);
    if (!down) {
      held.delete(name);
      return;
    }
    if (t == null) {
      held.set(name, 0);
      out.push(name);
      return;
    }
    if (!repeat) return;
    const next = t + dt;
    held.set(name, next);
    if (next >= REPEAT_DELAY) {
      out.push(name);
      held.set(name, REPEAT_DELAY - REPEAT_RATE);
    }
  }

  return function read(pads, dt) {
    let up = false, down = false, left = false, right = false, a = false, b = false, start = false;
    for (const pad of pads || []) {
      if (!pad || !pad.connected) continue;
      const btn = (i) => !!pad.buttons?.[i]?.pressed;
      const ax = pad.axes?.[0] ?? 0;
      const ay = pad.axes?.[1] ?? 0;
      up ||= btn(PAD.UP) || ay < -STICK_DEADZONE;
      down ||= btn(PAD.DOWN) || ay > STICK_DEADZONE;
      left ||= btn(PAD.LEFT) || ax < -STICK_DEADZONE;
      right ||= btn(PAD.RIGHT) || ax > STICK_DEADZONE;
      a ||= btn(PAD.A);
      b ||= btn(PAD.B);
      start ||= btn(PAD.START);
    }
    const out = [];
    press('up', up, dt, true, out);
    press('down', down, dt, true, out);
    press('left', left, dt, true, out);
    press('right', right, dt, true, out);
    press('confirm', a, dt, false, out);
    press('back', b, dt, false, out);
    press('start', start, dt, false, out);
    return out;
  };
}

export function focusableIn(el) {
  return [...el.querySelectorAll('button, input, select, textarea, summary')].filter((n) => !n.disabled && !n.closest('[hidden]'));
}

// Moves focus by `delta` within a list, wrapping around.
export function moveFocus(items, current, delta) {
  if (!items.length) return null;
  const idx = items.indexOf(current);
  const next = idx < 0 ? (delta > 0 ? 0 : items.length - 1) : (idx + delta + items.length) % items.length;
  items[next].focus();
  return items[next];
}

// Nudges a range input or select left/right, firing the same events a user would.
export function adjustControl(el, dir) {
  if (!el) return false;
  if (el.tagName === 'INPUT' && el.type === 'range') {
    const step = Number(el.step) || 1;
    const min = Number(el.min);
    const max = Number(el.max);
    const v = Math.min(max, Math.max(min, Number(el.value) + dir * step));
    el.value = String(v);
  } else if (el.tagName === 'SELECT') {
    const n = el.options.length;
    el.selectedIndex = Math.min(n - 1, Math.max(0, el.selectedIndex + dir));
  } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
    el.checked = !el.checked;
  } else {
    return false;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
