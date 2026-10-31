// Tutorial lesson card: shows the current tip with the right key/button for the
// device in use, ticks itself off when the player does the move, and offers a skip.
import { CONTROLS } from './controls.js';

const TOKEN_ROWS = { move: 'Move', camera: 'Camera', jump: 'Jump ×2', dash: 'Dash', pound: 'Ground pound', pause: 'Pause' };
const DEVICE_COLUMN = { keyboard: 'keys', keys: 'keys', gamepad: 'pad', pad: 'pad', touch: 'touch' };
const TOUCH_WORDS = { jump: 'the Jump button', dash: 'the Dash button', pound: 'the Pound button', move: 'the left stick', camera: 'a drag on the right side' };

// The label for one action on one device, e.g. ('dash', 'keyboard') -> 'Shift / K'.
export function controlLabel(token, device = 'keyboard', controls = CONTROLS) {
  const col = DEVICE_COLUMN[device] ?? 'keys';
  if (col === 'touch' && TOUCH_WORDS[token]) return TOUCH_WORDS[token];
  const row = controls.find((r) => r.action === TOKEN_ROWS[token]);
  if (!row) return token;
  return row[col].replace(/\s+in air$/i, '');
}

// Replace {jump}-style tokens. Returns parts so labels can be styled as key caps.
export function tipParts(text, device, controls) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ key: controlLabel(m[1], device, controls) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function tipText(text, device, controls) {
  return tipParts(text, device, controls).map((p) => p.text ?? p.key).join('');
}

const CSS = `
.ss-tip {
  position: fixed; z-index: 11; left: 50%; bottom: max(24px, env(safe-area-inset-bottom));
  width: min(440px, calc(100% - 32px)); transform: translate(-50%, 16px);
  padding: 14px 16px 14px 18px; border-radius: 18px;
  background: rgba(18, 22, 58, 0.78); border: 1px solid rgba(160, 190, 255, 0.3);
  box-shadow: 0 14px 40px rgba(0, 0, 20, 0.4);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  color: #f4f6ff; font-family: ui-rounded, "SF Pro Rounded", "Nunito", "Trebuchet MS", system-ui, sans-serif;
  opacity: 0; pointer-events: none; transition: opacity 0.3s, transform 0.3s, border-color 0.3s;
}
.ss-tip.ss-show { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.ss-tip.ss-done { border-color: rgba(110, 243, 224, 0.9); }
.ss-tip-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.ss-tip-step { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #b8bfe6; }
.ss-tip-title { font-size: 19px; font-weight: 900; flex: 1; }
.ss-tip-check {
  width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
  background: #6ef3e0; color: #0b1030; font-weight: 900; transform: scale(0); transition: transform 0.25s cubic-bezier(.3,1.6,.5,1);
}
.ss-tip.ss-done .ss-tip-check { transform: scale(1); }
.ss-tip-text { margin: 0; font-size: 16px; line-height: 1.45; font-weight: 600; }
.ss-key {
  display: inline-block; padding: 1px 8px; margin: 0 1px; border-radius: 7px; font-weight: 800; white-space: nowrap;
  background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.3); border-bottom-width: 3px;
}
.ss-tip-skip {
  font: inherit; font-size: 13px; font-weight: 800; color: #b8bfe6; background: none; border: 0;
  padding: 10px 4px; min-height: 44px; cursor: pointer; text-decoration: underline;
}
.ss-tip-skip:hover, .ss-tip-skip:focus-visible { color: #fff27a; }
@media (pointer: coarse) {
  /* Touch buttons sit along the bottom corners, so the card moves to the top. */
  .ss-tip { bottom: auto; top: max(64px, env(safe-area-inset-top)); }
}
`;

export function createTipPanel(root = document.body, { onSkip } = {}) {
  if (!document.getElementById('ss-tip-css')) {
    const style = document.createElement('style');
    style.id = 'ss-tip-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  const el = document.createElement('div');
  el.className = 'ss-tip';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.dataset.testid = 'tutorial-tip';
  el.innerHTML = `<div class="ss-tip-head"><span class="ss-tip-step"></span><span class="ss-tip-title"></span>
    <span class="ss-tip-check" aria-hidden="true">✓</span></div><p class="ss-tip-text"></p>`;
  const skip = document.createElement('button');
  skip.className = 'ss-tip-skip';
  skip.type = 'button';
  skip.textContent = 'Skip tutorial';
  skip.dataset.testid = 'skip-tutorial';
  skip.addEventListener('click', () => onSkip?.());
  // Input grabs the pointer on mousedown anywhere in the page, which would swallow the click.
  el.addEventListener('mousedown', (e) => e.stopPropagation());
  el.querySelector('.ss-tip-head').append(skip);
  root.append(el);

  const $ = (sel) => el.querySelector(sel);
  let current = null;
  let device = 'keyboard';
  let hideTimer = 0;

  function render() {
    if (!current) return;
    const p = $('.ss-tip-text');
    p.textContent = '';
    for (const part of tipParts(current.tip.text, device)) {
      if (part.text) p.append(part.text);
      else {
        const k = document.createElement('span');
        k.className = 'ss-key';
        k.textContent = part.key;
        p.append(k);
      }
    }
  }

  return {
    el,
    // Show a lesson. `index`/`total` drive the "Lesson 3 / 9" label.
    show(tip, index, total) {
      clearTimeout(hideTimer);
      current = { tip, done: false };
      $('.ss-tip-step').textContent = `${index + 1} / ${total}`;
      $('.ss-tip-title').textContent = tip.title ?? '';
      el.classList.remove('ss-done');
      render();
      el.classList.add('ss-show');
    },
    // The player did something; tick the card if it is what the lesson teaches.
    complete(action) {
      if (!current || current.done || current.tip.action !== action) return false;
      current.done = true;
      el.classList.add('ss-done');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => el.classList.remove('ss-show'), 2600);
      return true;
    },
    get action() {
      return current && !current.done ? current.tip.action : null;
    },
    setDevice(next) {
      if (next === device) return;
      device = next;
      render();
    },
    setVisible(on) {
      el.style.display = on ? '' : 'none';
    },
    hide() {
      clearTimeout(hideTimer);
      current = null;
      el.classList.remove('ss-show', 'ss-done');
    },
    dispose() {
      clearTimeout(hideTimer);
      el.remove();
    },
  };
}
