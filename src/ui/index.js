import { injectStyles } from './styles.js';
import { loadSettings, saveSettings, sanitizeSettings, formatTime, QUALITY_LEVELS } from './settings.js';
import { CONTROLS, DEVICES, detectDevice } from './controls.js';
import { createPadReader, focusableIn, moveFocus, adjustControl } from './nav.js';

export { formatTime } from './settings.js';

// Tiny element builder: h('div', { class: 'x', onclick }, child, 'text').
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'testid') el.dataset.testid = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

const HEART_SVG = '<svg viewBox="0 0 28 26" aria-hidden="true"><path d="M14 24.5 3.6 14.2A6.6 6.6 0 0 1 14 5.6a6.6 6.6 0 0 1 10.4 8.6Z"/></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="4.5" height="14" rx="1.5"/><rect x="11.5" y="3" width="4.5" height="14" rx="1.5"/></svg>';

const QUALITY_LABELS = { low: 'Low (fastest)', medium: 'Medium', high: 'High (prettiest)' };

/**
 * Builds every menu and the in-game HUD as a DOM overlay on `root`.
 * Handlers: onStart, onPause, onResume, onRestart, onQuit, onSettings(settings),
 * and optional onSound(name) for menu clicks.
 * Pause input during play belongs to main; the UI only offers a HUD pause button.
 */
export function createUI(root, handlers = {}, { storage = safeStorage(), env = globalThis } = {}) {
  const call = (name, ...args) => handlers[name]?.(...args);
  const sound = (name) => call('onSound', name);
  injectStyles(document);

  let settings = loadSettings(storage, env);
  let screen = null; // name of the visible menu screen, or null
  let settingsReturn = 'title';

  const container = h('div', { class: 'ss-ui ss-pointer' });
  const pointerMode = (on) => container.classList.toggle('ss-pointer', on);
  container.addEventListener('pointerdown', () => pointerMode(true));
  const screens = {};

  function button(label, opts = {}) {
    return h(
      'button',
      {
        type: 'button',
        class: `ss-btn${opts.primary ? ' ss-primary' : ''}`,
        testid: opts.testid,
        onclick: () => {
          sound('click');
          opts.onclick?.();
        },
        onpointerenter: (e) => {
          if (e.pointerType === 'mouse') sound('hover');
        },
      },
      label,
    );
  }

  function makeScreen(name, ...children) {
    const el = h('section', { class: 'ss-screen', 'data-screen': name, role: 'dialog', 'aria-label': name }, ...children);
    screens[name] = el;
    container.append(el);
    return el;
  }

  // ----- Title -----
  const bestLine = h('p', { class: 'ss-foot', testid: 'best' });
  const controlsCard = buildControlsCard();
  makeScreen(
    'title',
    h(
      'div',
      { class: 'ss-panel ss-plain' },
      h(
        'div',
        { class: 'ss-logo' },
        h('div', { class: 'ss-gem' }),
        h('h1', { class: 'ss-title' }, 'SKYSHARD'),
        h('p', { class: 'ss-tagline' }, 'Gather the scattered sky. Wake the beacon.'),
      ),
      h(
        'div',
        { class: 'ss-menu' },
        button('Play', { primary: true, testid: 'play', onclick: () => call('onStart') }),
        button('Settings', { testid: 'settings', onclick: () => openSettings('title') }),
      ),
      controlsCard.el,
      bestLine,
    ),
  );

  function buildControlsCard() {
    let device = detectDevice(env);
    const tabs = h('div', { class: 'ss-tabs', role: 'tablist' });
    const body = h('tbody');
    const table = h('table', { class: 'ss-controls' }, body);
    function render() {
      tabs.replaceChildren(
        ...DEVICES.map((d) =>
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              class: `ss-tab${d.id === device ? ' ss-on' : ''}`,
              'aria-selected': d.id === device ? 'true' : 'false',
              testid: `controls-${d.id}`,
              onclick: () => {
                device = d.id;
                sound('click');
                render();
              },
            },
            d.label,
          ),
        ),
      );
      body.replaceChildren(...CONTROLS.map((c) => h('tr', {}, h('td', {}, c.action), h('td', {}, c[device]))));
    }
    render();
    return {
      el: h('div', { class: 'ss-card', testid: 'controls' }, tabs, table),
      get device() {
        return device;
      },
    };
  }

  // ----- Settings -----
  const fields = {};
  function slider(key, label, min, max, step) {
    const input = h('input', { type: 'range', min, max, step, id: `ss-${key}`, testid: `set-${key}` });
    input.addEventListener('input', () => update({ [key]: Number(input.value) }));
    fields[key] = { input, read: (s) => (input.value = String(s[key])) };
    return h('label', { class: 'ss-field', for: `ss-${key}` }, label, input);
  }
  function checkbox(key, label) {
    const input = h('input', { type: 'checkbox', id: `ss-${key}`, testid: `set-${key}` });
    input.addEventListener('change', () => update({ [key]: input.checked }));
    fields[key] = { input, read: (s) => (input.checked = !!s[key]) };
    return h('label', { class: 'ss-field', for: `ss-${key}` }, label, input);
  }
  function select(key, label, options) {
    const input = h('select', { id: `ss-${key}`, testid: `set-${key}` }, ...options.map((o) => h('option', { value: o }, QUALITY_LABELS[o] ?? o)));
    input.addEventListener('change', () => update({ [key]: input.value }));
    fields[key] = { input, read: (s) => (input.value = s[key]) };
    return h('label', { class: 'ss-field', for: `ss-${key}` }, label, input);
  }
  makeScreen(
    'settings',
    h(
      'div',
      { class: 'ss-panel' },
      h('h2', { class: 'ss-h2' }, 'Settings'),
      h(
        'div',
        { class: 'ss-form' },
        slider('master', 'Volume', 0, 1, 0.05),
        slider('music', 'Music', 0, 1, 0.05),
        slider('sfx', 'Effects', 0, 1, 0.05),
        slider('sensitivity', 'Camera speed', 0.2, 3, 0.1),
        checkbox('invertY', 'Invert camera Y'),
        select('quality', 'Graphics', QUALITY_LEVELS),
        checkbox('showFps', 'Show FPS'),
      ),
      h('div', { class: 'ss-menu' }, button('Back', { primary: true, testid: 'settings-back', onclick: () => closeSettings() })),
    ),
  );

  function update(patch) {
    settings = sanitizeSettings({ ...settings, ...patch });
    saveSettings(storage, settings);
    call('onSettings', { ...settings });
  }
  function openSettings(from) {
    settingsReturn = from;
    for (const f of Object.values(fields)) f.read(settings);
    show('settings');
  }
  function closeSettings() {
    show(settingsReturn);
  }

  // ----- Pause -----
  makeScreen(
    'pause',
    h(
      'div',
      { class: 'ss-panel' },
      h('h2', { class: 'ss-h2' }, 'Paused'),
      h(
        'div',
        { class: 'ss-menu' },
        button('Resume', { primary: true, testid: 'resume', onclick: () => call('onResume') }),
        button('Restart', { testid: 'restart', onclick: () => call('onRestart') }),
        button('Settings', { testid: 'pause-settings', onclick: () => openSettings('pause') }),
        button('Quit to title', { testid: 'quit', onclick: () => call('onQuit') }),
      ),
    ),
  );

  // ----- Win / lose -----
  const winBody = h('div');
  makeScreen(
    'win',
    h(
      'div',
      { class: 'ss-panel' },
      h('h2', { class: 'ss-h2' }, 'Beacon awakened!'),
      h('p', { class: 'ss-sub' }, 'The sky remembers its light.'),
      winBody,
      h(
        'div',
        { class: 'ss-menu' },
        button('Play again', { primary: true, testid: 'play-again', onclick: () => call('onRestart') }),
        button('Title screen', { testid: 'win-quit', onclick: () => call('onQuit') }),
      ),
    ),
  );
  const loseBody = h('div');
  makeScreen(
    'lose',
    h(
      'div',
      { class: 'ss-panel' },
      h('h2', { class: 'ss-h2' }, 'Pip faded away…'),
      h('p', { class: 'ss-sub' }, 'The islands will wait for you.'),
      loseBody,
      h(
        'div',
        { class: 'ss-menu' },
        button('Try again', { primary: true, testid: 'retry', onclick: () => call('onRestart') }),
        button('Title screen', { testid: 'lose-quit', onclick: () => call('onQuit') }),
      ),
    ),
  );

  function stat(label, value) {
    return h('div', { class: 'ss-stat' }, h('b', {}, value), h('span', {}, label));
  }

  // ----- HUD -----
  const shardCount = h('span', { testid: 'hud-shards' }, '0 / 0');
  const shardPill = h('div', { class: 'ss-pill', 'aria-label': 'Shards' }, h('span', { class: 'ss-shard-icon' }), shardCount);
  const hearts = h('div', { class: 'ss-hearts', testid: 'hud-health', 'aria-label': 'Health' });
  const timer = h('div', { class: 'ss-pill', testid: 'hud-time', 'aria-label': 'Time' }, '0:00.00');
  const pauseBtn = h('button', {
    type: 'button',
    class: 'ss-pause-btn',
    testid: 'pause',
    'aria-label': 'Pause',
    html: PAUSE_SVG,
    onclick: () => {
      sound('click');
      call('onPause');
    },
  });
  const fps = h('div', { class: 'ss-fps', testid: 'fps' });
  const toastEl = h('div', { class: 'ss-toast', role: 'status', 'aria-live': 'polite', testid: 'toast' });
  const hud = h(
    'div',
    { class: 'ss-hud', testid: 'hud' },
    h('div', { class: 'ss-hud-left' }, shardPill, hearts),
    h('div', { class: 'ss-hud-right' }, timer, pauseBtn),
    fps,
  );
  container.append(hud, toastEl);
  root.append(container);

  const last = { shards: -1, totalShards: -1, health: -1, maxHealth: -1, time: '' };
  let fpsShown = null;

  function renderHearts(health, maxHealth) {
    if (hearts.children.length !== maxHealth) {
      hearts.replaceChildren(...Array.from({ length: maxHealth }, () => h('span', { class: 'ss-heart', html: HEART_SVG })));
    }
    [...hearts.children].forEach((el, i) => el.classList.toggle('ss-full', i < health));
  }

  function retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }

  // ----- Screen switching and menu navigation -----
  function show(name) {
    screen = name;
    for (const [key, el] of Object.entries(screens)) el.classList.toggle('ss-active', key === name);
    hud.classList.toggle('ss-active', name === null);
    if (name) {
      const first = screens[name].querySelector('.ss-primary') || focusableIn(screens[name])[0];
      first?.focus({ preventScroll: true });
      startPadLoop();
    }
  }

  function navigate(action) {
    if (!screen) return;
    const items = focusableIn(screens[screen]);
    const active = document.activeElement;
    const inScreen = items.includes(active) ? active : null;
    switch (action) {
      case 'up':
        moveFocus(items, inScreen, -1);
        break;
      case 'down':
        moveFocus(items, inScreen, 1);
        break;
      case 'left':
      case 'right':
        if (!adjustControl(inScreen?.tagName === 'INPUT' || inScreen?.tagName === 'SELECT' ? inScreen : null, action === 'left' ? -1 : 1)) {
          moveFocus(items, inScreen, action === 'left' ? -1 : 1);
        }
        break;
      case 'confirm':
        if (inScreen?.tagName === 'BUTTON') inScreen.click();
        else if (inScreen?.type === 'checkbox') adjustControl(inScreen, 1);
        else if (!inScreen) items[0]?.focus();
        break;
      case 'back':
        if (screen === 'settings') {
          sound('click');
          closeSettings();
        } else if (screen === 'pause') {
          sound('click');
          call('onResume');
        }
        break;
    }
  }

  function onKey(e) {
    if (!screen) return;
    pointerMode(false);
    const t = e.target;
    const isRange = t?.tagName === 'INPUT' && t.type === 'range';
    if (e.key === 'ArrowDown' || (e.key === 'ArrowRight' && !isRange && t?.tagName !== 'SELECT')) {
      e.preventDefault();
      navigate('down');
    } else if (e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && !isRange && t?.tagName !== 'SELECT')) {
      e.preventDefault();
      navigate('up');
    } else if (e.key === 'Escape' && screen === 'settings') {
      e.preventDefault();
      navigate('back');
    }
  }
  container.addEventListener('keydown', onKey);

  const readPad = createPadReader();
  let padRaf = 0;
  let padLast = 0;
  function startPadLoop() {
    if (padRaf || !env.navigator?.getGamepads || !env.requestAnimationFrame) return;
    padLast = 0;
    const loop = (now) => {
      if (!screen) {
        padRaf = 0;
        return;
      }
      const dt = padLast ? Math.min(0.1, (now - padLast) / 1000) : 0;
      padLast = now;
      let pads = [];
      try {
        pads = [...(env.navigator.getGamepads() || [])];
      } catch {
        // some browsers throw outside secure contexts
      }
      // Start is main's pause key, so the menu leaves it alone.
      for (const action of readPad(pads, dt)) {
        pointerMode(false);
        if (action !== 'start') navigate(action);
      }
      padRaf = env.requestAnimationFrame(loop);
    };
    padRaf = env.requestAnimationFrame(loop);
  }

  let toastTimer = 0;

  return {
    getSettings: () => ({ ...settings }),
    get screen() {
      return screen;
    },
    showTitle(best = readBest(storage)) {
      bestLine.textContent = Number.isFinite(best) && best > 0 ? `Best time ${formatTime(best)}` : '';
      show('title');
    },
    showHud() {
      show(null);
    },
    updateHud({ shards = 0, totalShards = 0, health = 0, maxHealth = health, timeMs = 0 } = {}) {
      if (shards !== last.shards || totalShards !== last.totalShards) {
        if (shards > last.shards && last.shards >= 0) retrigger(shardPill, 'ss-bump');
        shardCount.textContent = `${shards} / ${totalShards}`;
        last.shards = shards;
        last.totalShards = totalShards;
      }
      if (health !== last.health || maxHealth !== last.maxHealth) {
        if (health < last.health) retrigger(hearts, 'ss-hit');
        renderHearts(Math.max(0, health), Math.max(0, maxHealth));
        last.health = health;
        last.maxHealth = maxHealth;
      }
      const time = formatTime(timeMs);
      if (time !== last.time) {
        timer.textContent = time;
        last.time = time;
      }
    },
    showPause() {
      show('pause');
    },
    hide() {
      screen = null;
      for (const el of Object.values(screens)) el.classList.remove('ss-active');
      hud.classList.remove('ss-active');
    },
    showWin({ timeMs = 0, shards = 0, totalShards = 0, best = null, deaths = 0 } = {}) {
      const isRecord = Number.isFinite(best) && Math.abs(best - timeMs) < 1;
      winBody.replaceChildren(
        isRecord ? h('div', { class: 'ss-record', testid: 'record' }, 'New best time!') : '',
        h(
          'div',
          { class: 'ss-stats' },
          stat('Time', formatTime(timeMs)),
          stat('Shards', `${shards} / ${totalShards}`),
          stat('Best', Number.isFinite(best) ? formatTime(best) : '—'),
          stat('Falls', String(deaths)),
        ),
      );
      show('win');
    },
    showLose({ timeMs = 0, shards = 0, totalShards = 0 } = {}) {
      loseBody.replaceChildren(h('div', { class: 'ss-stats' }, stat('Time', formatTime(timeMs)), stat('Shards', `${shards} / ${totalShards}`)));
      show('lose');
    },
    toast(text, ms = 1800) {
      toastEl.textContent = text;
      retrigger(toastEl, 'ss-show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('ss-show'), ms);
    },
    setFps(n) {
      const value = Number.isFinite(n) ? Math.round(n) : null;
      if (value === fpsShown) return;
      fpsShown = value;
      fps.classList.toggle('ss-active', value !== null);
      fps.textContent = value === null ? '' : `${value} FPS`;
    },
    dispose() {
      cancelAnimationFrame?.(padRaf);
      clearTimeout(toastTimer);
      container.remove();
    },
  };
}

// main.js stores the best time as a plain number of milliseconds.
function readBest(storage) {
  try {
    const n = Number(storage?.getItem('skyshard.best'));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
