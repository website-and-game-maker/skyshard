// On-screen controls for phones and tablets: a floating joystick on the left half,
// drag-to-look on the right half, and three action buttons.
const STYLE = `
.ss-touch{position:absolute;inset:0;pointer-events:none;z-index:20;user-select:none;-webkit-user-select:none;touch-action:none}
.ss-touch.hidden{display:none}
.ss-touch.faded{opacity:.3}
.ss-stick{position:absolute;left:calc(100px + env(safe-area-inset-left));bottom:calc(40px + env(safe-area-inset-bottom));width:120px;height:120px;margin:0 0 0 -60px;border-radius:50%;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.35);opacity:.55;transition:opacity .15s;pointer-events:auto;touch-action:none}
.ss-stick.on{opacity:1}
.ss-knob{position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 2px 8px rgba(0,0,0,.2)}
.ss-btn{position:absolute;pointer-events:auto;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 13px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);border:2px solid rgba(255,255,255,.5);touch-action:none}
.ss-btn.down{transform:scale(.9);filter:brightness(1.25)}
.ss-jump{width:84px;height:84px;right:calc(24px + env(safe-area-inset-right));bottom:calc(28px + env(safe-area-inset-bottom));background:rgba(60,200,192,.55)}
.ss-dash{width:62px;height:62px;right:calc(120px + env(safe-area-inset-right));bottom:calc(40px + env(safe-area-inset-bottom));background:rgba(255,122,89,.55)}
.ss-pound{width:62px;height:62px;right:calc(40px + env(safe-area-inset-right));bottom:calc(126px + env(safe-area-inset-bottom));background:rgba(140,120,255,.55)}
`;

export const STICK_RADIUS = 50;

export class TouchControls {
  constructor(parent, doc = parent.ownerDocument) {
    this.doc = doc;
    this.active = true;
    this.moveX = 0;
    this.moveY = 0;
    this.lookDX = 0;
    this.lookDY = 0;
    this.lookSensitivity = 0.006;
    this.buttons = { jump: false, dash: false, pound: false };
    this.stickId = null;
    this.lookId = null;
    this._offs = [];

    if (!doc.getElementById('ss-touch-style')) {
      const st = doc.createElement('style');
      st.id = 'ss-touch-style';
      st.textContent = STYLE;
      doc.head.appendChild(st);
    }
    const root = (this.root = doc.createElement('div'));
    root.className = 'ss-touch';
    this.stick = doc.createElement('div');
    this.stick.className = 'ss-stick';
    this.stick.dataset.testid = 'touch-stick';
    this.knob = doc.createElement('div');
    this.knob.className = 'ss-knob';
    this.stick.appendChild(this.knob);
    root.appendChild(this.stick);
    for (const [name, label] of [['jump', 'JUMP'], ['dash', 'DASH'], ['pound', 'POUND']]) {
      const b = doc.createElement('div');
      b.className = `ss-btn ss-${name}`;
      b.textContent = label;
      b.dataset.btn = name;
      b.dataset.testid = `touch-${name}`;
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', name);
      const down = (e) => { e.preventDefault(); this.buttons[name] = true; b.classList.add('down'); };
      const up = (e) => { e.preventDefault(); this.buttons[name] = false; b.classList.remove('down'); };
      this._listen(b, 'touchstart', down);
      this._listen(b, 'touchend', up);
      this._listen(b, 'touchcancel', up);
      root.appendChild(b);
    }
    parent.appendChild(root);

    // Stick and look areas are handled on the parent so touches anywhere count.
    this._listen(parent, 'touchstart', (e) => this._start(e));
    this._listen(parent, 'touchmove', (e) => this._move(e));
    this._listen(parent, 'touchend', (e) => this._end(e));
    this._listen(parent, 'touchcancel', (e) => this._end(e));
    this.parent = parent;
  }

  _listen(el, type, fn) {
    el.addEventListener(type, fn, { passive: false });
    this._offs.push(() => el.removeEventListener(type, fn, { passive: false }));
  }

  _width() {
    return this.parent.clientWidth || this.doc.defaultView?.innerWidth || 800;
  }

  _start(e) {
    // Behind menus, leave touches alone so UI buttons work normally.
    if (!this.active || e.target?.dataset?.btn) return;
    if (e.target?.closest && !e.target.closest('canvas, .ss-touch') && e.target !== this.parent) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < this._width() / 2 && this.stickId === null) {
        this.stickId = t.identifier;
        this.origin = { x: t.clientX, y: t.clientY };
        // The stick floats to wherever the thumb lands.
        this.stick.style.left = `${t.clientX}px`;
        this.stick.style.top = `${t.clientY - 60}px`;
        this.stick.style.bottom = 'auto';
        this.stick.classList.add('on');
        this._setStick(0, 0);
      } else if (this.lookId === null) {
        this.lookId = t.identifier;
        this.lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }

  _move(e) {
    if (!this.active) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickId) {
        this._setStick(t.clientX - this.origin.x, t.clientY - this.origin.y);
      } else if (t.identifier === this.lookId) {
        this.lookDX += t.clientX - this.lookLast.x;
        this.lookDY += t.clientY - this.lookLast.y;
        this.lookLast = { x: t.clientX, y: t.clientY };
      }
    }
  }

  _end(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.stickId) {
        this.stickId = null;
        this.stick.classList.remove('on');
        this.stick.style.left = this.stick.style.top = this.stick.style.bottom = '';
        this._setStick(0, 0);
      } else if (t.identifier === this.lookId) {
        this.lookId = null;
      }
    }
  }

  _setStick(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const n = Math.min(1, len / STICK_RADIUS);
    // Small inner deadzone so a resting thumb doesn't drift.
    const k = n < 0.12 ? 0 : 1;
    this.moveX = (dx / STICK_RADIUS) * k;
    this.moveY = (-dy / STICK_RADIUS) * k;
  }

  read() {
    const out = {
      moveX: this.moveX, moveY: this.moveY,
      lookX: this.lookDX * this.lookSensitivity, lookY: this.lookDY * this.lookSensitivity,
      ...this.buttons,
    };
    out.any = !!(out.moveX || out.moveY || out.lookX || out.lookY || Object.values(this.buttons).some(Boolean));
    this.lookDX = 0;
    this.lookDY = 0;
    return out;
  }

  setVisible(v) {
    this.active = v;
    if (!v) {
      this.stickId = this.lookId = null;
      this._setStick(0, 0);
      for (const k in this.buttons) this.buttons[k] = false;
      this.root.querySelectorAll('.down').forEach((el) => el.classList.remove('down'));
    }
    this.root.classList.toggle('hidden', !v);
  }

  dispose() {
    this._offs.forEach((f) => f());
    this.root.remove();
  }
}
