// Unified input: keyboard + mouse, gamepad and touch merge into one `state` per frame.
// Movement is an intent in screen space (x right, y forward); the player turns it into
// world space using the camera yaw.
import { TouchControls } from './TouchControls.js';

const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyK'],
  pound: ['KeyC', 'KeyL'],
  pause: ['Escape', 'KeyP'],
  camLeft: ['KeyQ'],
  camRight: ['KeyE'],
};

// Standard gamepad mapping indices.
const PAD = { jump: 0, dash: 2, dashAlt: 5, pound: 1, poundAlt: 7, poundAlt2: 4, pause: 9 };
export const PAD_DEADZONE = 0.18;

export function applyDeadzone(x, y, dz = PAD_DEADZONE) {
  const len = Math.hypot(x, y);
  if (len < dz) return [0, 0];
  const scaled = Math.min(1, (len - dz) / (1 - dz));
  return [(x / len) * scaled, (y / len) * scaled];
}

export function clampStick(x, y) {
  const len = Math.hypot(x, y);
  return len > 1 ? [x / len, y / len] : [x, y];
}

const BUTTONS = ['jump', 'dash', 'pound', 'pause'];

// Keyboard control schemes. Gamepad sticks and touch always stay camera-relative.
//  classic: left/right strafe relative to the camera; turn the camera with the mouse or Q/E.
//  steer:   left/right turn the camera (and Pip with it) smoothly, up runs where you face.
//  tank:    like steer, and Pip also turns on the spot; down backs up without turning around.
//  auto:    camera-relative like classic, but the camera swings behind Pip on its own.
export const SCHEMES = ['classic', 'steer', 'tank', 'auto'];
export const DEFAULT_KEYBOARD = { scheme: 'classic', turnSpeed: 2.6, turnRamp: 0.12 };

const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

const THREE_CLAMP = (v, a, b) => Math.min(b, Math.max(a, v));

export class Input {
  constructor({ element, window: win = globalThis.window, nav = globalThis.navigator, touch = 'auto' } = {}) {
    this.element = element;
    this.win = win;
    this.nav = nav;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseSensitivity = 0.0025;
    this.padLookSpeed = 2.6; // radians/s at full deflection
    this.invertY = false;
    this.scheme = DEFAULT_KEYBOARD.scheme;
    this.turnSpeed = DEFAULT_KEYBOARD.turnSpeed; // radians/s for keyboard turning
    this.turnRamp = DEFAULT_KEYBOARD.turnRamp; // seconds to reach full turn speed (smooths taps)
    this._turnVel = 0;
    this._lastTime = null;
    this.enabled = true;
    this.playing = true; // false behind menus: no pointer lock, no touch overlay
    this.lastDevice = 'keyboard';
    this.state = {
      moveX: 0, moveY: 0, lookX: 0, lookY: 0,
      jump: false, dash: false, pound: false, pause: false,
      jumpPressed: false, dashPressed: false, poundPressed: false, pausePressed: false,
      jumpReleased: false,
      faceCamera: false, // tank: Pip turns with the camera even when standing still
      backpedal: false, // tank: moving backward keeps facing forward
      // Monotonic press counters so a fixed-step simulation never loses or repeats a press.
      counts: { jump: 0, dash: 0, pound: 0, pause: 0, jumpRelease: 0 },
    };
    this._prev = { jump: false, dash: false, pound: false, pause: false };
    // Presses/releases seen between two update() calls, so a quick tap on a slow frame isn't lost.
    this._pending = { jump: false, dash: false, pound: false, pause: false };
    this._pendingJumpRelease = false;
    this._listeners = [];

    this._on(win, 'keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault?.();
      if (!e.repeat) {
        for (const k of BUTTONS) if (KEYS[k].includes(e.code)) this._pending[k] = true;
      }
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
    });
    this._on(win, 'keyup', (e) => {
      this.keys.delete(e.code);
      if (KEYS.jump.includes(e.code)) this._pendingJumpRelease = true;
    });
    this._on(win, 'blur', () => this.keys.clear());
    if (element) {
      this._on(element, 'mousedown', () => {
        if (this.enabled && this.playing && this.lastDevice !== 'touch') {
          try { element.requestPointerLock?.()?.catch?.(() => {}); } catch { /* not allowed here */ }
        }
      });
    }
    this._on(win, 'mousemove', (e) => {
      if (this.element && globalThis.document?.pointerLockElement === this.element) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
        this.lastDevice = 'keyboard';
      }
    });

    const hasTouch = touch === true || (touch === 'auto' && !!win && ('ontouchstart' in win || (nav?.maxTouchPoints ?? 0) > 0));
    this.touch = element && hasTouch ? new TouchControls(element) : null;
    if (this.touch) this.lastDevice = 'touch';
  }

  _on(target, type, fn) {
    if (!target?.addEventListener) return;
    const opts = type.startsWith('touch') ? { passive: false } : undefined;
    target.addEventListener(type, fn, opts);
    this._listeners.push(() => target.removeEventListener(type, fn, opts));
  }

  _key(name) {
    return KEYS[name].some((k) => this.keys.has(k));
  }

  _readPad() {
    const pads = this.nav?.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => !!p.buttons[i]?.pressed;
      const [mx, my] = applyDeadzone(p.axes[0] ?? 0, p.axes[1] ?? 0);
      const [lx, ly] = applyDeadzone(p.axes[2] ?? 0, p.axes[3] ?? 0);
      const any = mx || my || lx || ly || p.buttons.some((x) => x?.pressed);
      return {
        any, moveX: mx, moveY: -my, lookX: lx, lookY: ly,
        jump: b(PAD.jump), dash: b(PAD.dash) || b(PAD.dashAlt),
        pound: b(PAD.pound) || b(PAD.poundAlt) || b(PAD.poundAlt2), pause: b(PAD.pause),
        dpadX: (b(15) ? 1 : 0) - (b(14) ? 1 : 0), dpadY: (b(12) ? 1 : 0) - (b(13) ? 1 : 0),
      };
    }
    return null;
  }

  // Call once per frame before the game reads `state`. dt in seconds.
  // With no dt, the time since the last call is used so turning speed doesn't depend on frame rate.
  update(dt) {
    if (dt === undefined) {
      const now = globalThis.performance?.now?.() ?? Date.now();
      dt = this._lastTime === null ? 1 / 60 : Math.min(Math.max((now - this._lastTime) / 1000, 0), 0.1);
      this._lastTime = now;
    }
    const s = this.state;
    const kx = (this._key('right') ? 1 : 0) - (this._key('left') ? 1 : 0);
    const ky = (this._key('forward') ? 1 : 0) - (this._key('back') ? 1 : 0);
    let mx = kx;
    let my = ky;
    let lx = this.mouseDX * this.mouseSensitivity;
    let ly = this.mouseDY * this.mouseSensitivity;
    // Keyboard turning eases in over turnRamp so a tap nudges and a hold turns smoothly.
    const camKeys = (this._key('camRight') ? 1 : 0) - (this._key('camLeft') ? 1 : 0);
    const turning = this.scheme === 'steer' || this.scheme === 'tank';
    const turnInput = THREE_CLAMP(camKeys + (turning ? kx : 0), -1, 1);
    if (turning) mx -= kx;
    const rate = this.turnSpeed / Math.max(this.turnRamp, 1e-3);
    this._turnVel = approach(this._turnVel, turnInput * this.turnSpeed, rate * 2 * dt);
    if (!turnInput && Math.abs(this._turnVel) < 1e-3) this._turnVel = 0;
    lx += this._turnVel * dt;
    s.faceCamera = this.scheme === 'tank';
    s.backpedal = this.scheme === 'tank' && ky < 0 && this.lastDevice === 'keyboard';
    this.mouseDX = 0;
    this.mouseDY = 0;
    const held = { jump: this._key('jump'), dash: this._key('dash'), pound: this._key('pound'), pause: this._key('pause') };

    const pad = this._readPad();
    if (pad) {
      if (pad.any) this.lastDevice = 'gamepad';
      mx += pad.moveX + pad.dpadX;
      my += pad.moveY + pad.dpadY;
      lx += pad.lookX * this.padLookSpeed * dt;
      ly += pad.lookY * this.padLookSpeed * dt;
      for (const k of BUTTONS) held[k] ||= pad[k];
    }

    if (this.touch) {
      const t = this.touch.read();
      if (t.any) this.lastDevice = 'touch';
      // Touchscreen laptops: fade the overlay while a keyboard or gamepad is in use.
      this.touch.root.classList.toggle('faded', this.lastDevice !== 'touch');
      mx += t.moveX;
      my += t.moveY;
      lx += t.lookX;
      ly += t.lookY;
      for (const k of BUTTONS) {
        held[k] ||= t[k];
        if (t.tapped?.[k]) this._pending[k] = true;
      }
      if (t.tapped?.jumpRelease) this._pendingJumpRelease = true;
    }

    if (!this.enabled) {
      mx = my = lx = ly = 0;
      for (const k of BUTTONS) if (k !== 'pause') held[k] = false;
    }

    [s.moveX, s.moveY] = clampStick(mx, my);
    s.lookX = lx;
    s.lookY = this.invertY ? -ly : ly;
    for (const k of BUTTONS) {
      const pending = this._pending[k] && (this.enabled || k === 'pause');
      s[k + 'Pressed'] = (held[k] && !this._prev[k]) || pending;
      if (s[k + 'Pressed']) s.counts[k]++;
      s[k] = held[k];
      this._pending[k] = false;
    }
    // A tap that went down and up since the last update reports both edges, so the player gets a short hop.
    s.jumpReleased = (!held.jump && (this._prev.jump || s.jumpPressed)) || (this._pendingJumpRelease && !held.jump);
    if (s.jumpReleased) s.counts.jumpRelease++;
    this._pendingJumpRelease = false;
    this._prev = held;
    return s;
  }

  // main.js calls this with true only while playing.
  setTouchVisible(v) {
    this.playing = v;
    this.touch?.setVisible(v);
    if (!v && this.element && globalThis.document?.pointerLockElement === this.element) {
      globalThis.document.exitPointerLock?.();
    }
  }

  setOptions({ sensitivity, invertY, scheme, turnSpeed, turnRamp } = {}) {
    if (SCHEMES.includes(scheme)) this.scheme = scheme;
    if (typeof turnSpeed === 'number' && turnSpeed > 0) this.turnSpeed = turnSpeed;
    if (typeof turnRamp === 'number' && turnRamp >= 0) this.turnRamp = turnRamp;
    if (typeof sensitivity === 'number' && sensitivity > 0) {
      this.mouseSensitivity = 0.0025 * sensitivity;
      this.padLookSpeed = 2.6 * sensitivity;
      if (this.touch) this.touch.lookSensitivity = 0.006 * sensitivity;
    }
    if (typeof invertY === 'boolean') this.invertY = invertY;
  }

  // Rumble on supported gamepads; silently ignored elsewhere.
  rumble(strength = 0.5, ms = 120) {
    for (const p of this.nav?.getGamepads?.() ?? []) {
      p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength })?.catch?.(() => {});
    }
    this.nav?.vibrate?.(this.lastDevice === 'touch' ? Math.min(ms, 40) : 0);
  }

  dispose() {
    this._listeners.forEach((off) => off());
    this._listeners = [];
    this.touch?.dispose();
  }
}
