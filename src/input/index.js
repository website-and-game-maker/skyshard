// STUB from the scaffold. The controls thread replaces this file.
export class Input {
  constructor({ window: win }) {
    this.keys = new Set();
    this.state = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, jumpPressed: false, dash: false, dashPressed: false, pound: false, poundPressed: false, pausePressed: false };
    this.prev = new Set();
    win.addEventListener('keydown', (e) => this.keys.add(e.code));
    win.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }
  update() {
    const k = this.keys;
    const s = this.state;
    s.moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    s.moveY = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    s.jump = k.has('Space');
    s.jumpPressed = s.jump && !this.prev.has('Space');
    s.pausePressed = k.has('Escape') && !this.prev.has('Escape');
    this.prev = new Set(k);
  }
  setTouchVisible() {}
  setOptions() {}
  dispose() {}
}
