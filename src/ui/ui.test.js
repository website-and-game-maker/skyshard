// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUI } from './index.js';
import { sanitizeSettings, loadSettings, saveSettings, formatTime, DEFAULT_SETTINGS, SETTINGS_KEY, defaultQualityFor } from './settings.js';
import { createPadReader, moveFocus, adjustControl, PAD } from './nav.js';
import { CONTROLS, detectDevice } from './controls.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
  };
}

const env = { matchMedia: () => ({ matches: false }), navigator: { hardwareConcurrency: 8 } };
const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const visible = (name) => document.querySelector(`[data-screen="${name}"]`).classList.contains('ss-active');

function setup(handlers = {}, storage = memoryStorage()) {
  document.body.innerHTML = '';
  const h = {
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onRestart: vi.fn(),
    onQuit: vi.fn(),
    onSettings: vi.fn(),
    onSound: vi.fn(),
    ...handlers,
  };
  const ui = createUI(document.body, h, { storage, env });
  return { ui, h, storage };
}

describe('settings', () => {
  it('fills in defaults and clamps bad values', () => {
    expect(sanitizeSettings(null)).toEqual({ ...DEFAULT_SETTINGS });
    const s = sanitizeSettings({ master: 5, music: -2, sfx: 'x', sensitivity: 0, invertY: 'yes', quality: 'ultra', showFps: true });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, master: 1, music: 0, sensitivity: 0.2, showFps: true });
  });

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    saveSettings(storage, { ...DEFAULT_SETTINGS, music: 0.2, quality: 'low' });
    expect(loadSettings(storage, env)).toMatchObject({ music: 0.2, quality: 'low' });
  });

  it('survives broken or throwing storage', () => {
    expect(loadSettings(memoryStorage({ [SETTINGS_KEY]: '{not json' }), env)).toEqual({ ...DEFAULT_SETTINGS });
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadSettings(throwing, env).master).toBe(DEFAULT_SETTINGS.master);
    expect(saveSettings(throwing, DEFAULT_SETTINGS)).toBe(false);
    expect(loadSettings(null, env).quality).toBe('high');
  });

  it('starts phones on low quality', () => {
    expect(defaultQualityFor({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe('low');
    expect(defaultQualityFor({ matchMedia: () => ({ matches: false }), navigator: { hardwareConcurrency: 4 } })).toBe('medium');
    expect(defaultQualityFor(env)).toBe('high');
  });

  it('formats times as m:ss.cc', () => {
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(61234)).toBe('1:01.23');
    expect(formatTime(-5)).toBe('0:00.00');
    expect(formatTime(NaN)).toBe('0:00.00');
    expect(formatTime(3599990)).toBe('59:59.99');
  });
});

describe('createUI screens', () => {
  beforeEach(() => document.body.replaceChildren());

  it('shows the title with play, settings and a controls card', () => {
    const { ui, h } = setup();
    ui.showTitle();
    expect(visible('title')).toBe(true);
    expect(q('controls')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid="controls"] tr')).toHaveLength(CONTROLS.length);
    expect(document.activeElement).toBe(q('play'));
    q('play').click();
    expect(h.onStart).toHaveBeenCalledOnce();
    expect(h.onSound).toHaveBeenCalledWith('click');
  });

  it('switches the controls card between devices', () => {
    const { ui } = setup();
    ui.showTitle();
    q('controls-touch').click();
    expect(q('controls').textContent).toContain('Drag right side');
    q('controls-pad').click();
    expect(q('controls').textContent).toContain('Right stick');
  });

  it('shows the stored best time on the title', () => {
    const { ui } = setup({}, memoryStorage({ 'skyshard.best': '83450' }));
    ui.showTitle();
    expect(q('best').textContent).toBe('Best time 1:23.45');
    ui.showTitle(null);
    expect(q('best').textContent).toBe('');
  });

  it('runs the HUD and its pause button', () => {
    const { ui, h } = setup();
    ui.showHud();
    expect(q('hud').classList.contains('ss-active')).toBe(true);
    expect(visible('title')).toBe(false);
    ui.updateHud({ shards: 3, totalShards: 40, health: 2, maxHealth: 3, timeMs: 65432 });
    expect(q('hud-shards').textContent).toBe('3 / 40');
    expect(q('hud-health').querySelectorAll('.ss-heart')).toHaveLength(3);
    expect(q('hud-health').querySelectorAll('.ss-full')).toHaveLength(2);
    expect(q('hud-time').textContent).toBe('1:05.43');
    q('pause').click();
    expect(h.onPause).toHaveBeenCalledOnce();
  });

  it('does not bind Escape during play (main owns pause)', () => {
    const { ui, h } = setup();
    ui.showHud();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(h.onPause).not.toHaveBeenCalled();
    expect(h.onResume).not.toHaveBeenCalled();
  });

  it('wires every pause menu button', () => {
    const { ui, h } = setup();
    ui.showPause();
    expect(visible('pause')).toBe(true);
    q('resume').click();
    q('restart').click();
    q('quit').click();
    expect(h.onResume).toHaveBeenCalledOnce();
    expect(h.onRestart).toHaveBeenCalledOnce();
    expect(h.onQuit).toHaveBeenCalledOnce();
  });

  it('offers feedback from the title and the pause menu', () => {
    const onFeedback = vi.fn();
    const { ui } = setup({ onFeedback });
    ui.showTitle();
    q('feedback').click();
    ui.showPause();
    q('pause-feedback').click();
    expect(onFeedback.mock.calls).toEqual([['title'], ['pause']]);
  });

  it('sends feedback from its own form and returns where it came from', async () => {
    const onFeedbackSubmit = vi.fn(async () => 'sent');
    const { ui } = setup({ onFeedbackSubmit });
    ui.showFeedback({ info: 'Shards: 3 of 54', from: 'pause' });
    expect(visible('feedback')).toBe(true);
    expect(document.activeElement).toBe(q('feedback-text'));
    expect(q('feedback-info-text').textContent).toBe('Shards: 3 of 54');
    q('feedback-text').value = 'The bridge wobbles';
    q('feedback-send').click();
    await vi.waitFor(() => expect(q('feedback-done').textContent).toMatch(/sent/));
    expect(onFeedbackSubmit).toHaveBeenCalledWith({ kind: 'problem', message: 'The bridge wobbles', includeInfo: true });
    q('feedback-back').click();
    expect(visible('pause')).toBe(true);
  });

  it('hides game details for ideas and shows form errors', async () => {
    const onFeedbackSubmit = vi.fn(async () => ({ error: 'Write a few words first.' }));
    const { ui } = setup({ onFeedbackSubmit });
    ui.showFeedback({ from: 'title' });
    q('feedback-kind-idea').click();
    expect(q('feedback-info').closest('[hidden]')).not.toBeNull();
    q('feedback-send').click();
    await vi.waitFor(() => expect(q('feedback-status').textContent).toBe('Write a few words first.'));
    expect(onFeedbackSubmit.mock.calls[0][0].kind).toBe('idea');
  });

  it('lets Escape in the message box go back without typing into the game', () => {
    const { ui } = setup();
    ui.showFeedback({ from: 'title' });
    q('feedback-text').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(visible('title')).toBe(true);
  });

  it('edits, saves and reports settings, then returns where it came from', () => {
    const { ui, h, storage } = setup();
    ui.showPause();
    q('pause-settings').click();
    expect(visible('settings')).toBe(true);
    const music = q('set-music');
    music.value = '0.3';
    music.dispatchEvent(new Event('input', { bubbles: true }));
    q('set-invertY').click();
    const quality = q('set-quality');
    quality.value = 'low';
    quality.dispatchEvent(new Event('change', { bubbles: true }));
    expect(h.onSettings).toHaveBeenLastCalledWith(expect.objectContaining({ music: 0.3, invertY: true, quality: 'low' }));
    expect(ui.getSettings()).toMatchObject({ music: 0.3, invertY: true, quality: 'low' });
    expect(JSON.parse(storage.data[SETTINGS_KEY])).toMatchObject({ music: 0.3, quality: 'low' });
    q('settings-back').click();
    expect(visible('pause')).toBe(true);
  });

  it('leaves settings with Escape back to the title', () => {
    const { ui } = setup();
    ui.showTitle();
    q('settings').click();
    q('set-master').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(visible('title')).toBe(true);
  });

  it('shows win stats and a record badge', () => {
    const { ui, h } = setup();
    ui.showWin({ timeMs: 90000, shards: 38, totalShards: 40, best: 90000, deaths: 2 });
    expect(visible('win')).toBe(true);
    const text = document.querySelector('[data-screen="win"]').textContent;
    expect(text).toContain('1:30.00');
    expect(text).toContain('38 / 40');
    expect(q('record')).toBeTruthy();
    q('play-again').click();
    expect(h.onRestart).toHaveBeenCalled();
    ui.showWin({ timeMs: 95000, shards: 40, totalShards: 40, best: 90000, deaths: 0 });
    expect(q('record')).toBeNull();
  });

  it('shows the lose screen', () => {
    const { ui, h } = setup();
    ui.showLose({ timeMs: 1000, shards: 1, totalShards: 40 });
    expect(visible('lose')).toBe(true);
    q('retry').click();
    expect(h.onRestart).toHaveBeenCalled();
  });

  it('hides everything', () => {
    const { ui } = setup();
    ui.showTitle();
    ui.hide();
    expect(document.querySelectorAll('.ss-active')).toHaveLength(0);
    expect(ui.screen).toBe(null);
  });

  it('shows toasts and the FPS counter', () => {
    vi.useFakeTimers();
    const { ui } = setup();
    ui.showHud();
    ui.toast('Checkpoint');
    expect(q('toast').textContent).toBe('Checkpoint');
    expect(q('toast').classList.contains('ss-show')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(q('toast').classList.contains('ss-show')).toBe(false);
    ui.setFps(59.6);
    expect(q('fps').textContent).toBe('60 FPS');
    ui.setFps(null);
    expect(q('fps').classList.contains('ss-active')).toBe(false);
    vi.useRealTimers();
  });

  it('moves focus with arrow keys and wraps', () => {
    const { ui } = setup();
    ui.showPause();
    const press = (key) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    expect(document.activeElement).toBe(q('resume'));
    press('ArrowDown');
    expect(document.activeElement).toBe(q('restart'));
    press('ArrowUp');
    press('ArrowUp');
    expect(document.activeElement).toBe(q('quit'));
  });
});

describe('gamepad and focus helpers', () => {
  const pad = (pressed = [], axes = [0, 0]) => ({
    connected: true,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  });

  it('fires each button once per press', () => {
    const read = createPadReader();
    expect(read([pad([PAD.A])], 0.016)).toEqual(['confirm']);
    expect(read([pad([PAD.A])], 0.016)).toEqual([]);
    expect(read([pad()], 0.016)).toEqual([]);
    expect(read([pad([PAD.A])], 0.016)).toEqual(['confirm']);
  });

  it('auto-repeats a held direction and reads the stick', () => {
    const read = createPadReader();
    expect(read([pad([], [0, 0.9])], 0.016)).toEqual(['down']);
    expect(read([pad([], [0, 0.9])], 0.2)).toEqual([]);
    expect(read([pad([], [0, 0.9])], 0.2)).toEqual(['down']);
    expect(read([pad([], [0, 0.2])], 0.016)).toEqual([]);
  });

  it('ignores missing or disconnected pads', () => {
    const read = createPadReader();
    expect(read([null, { connected: false, buttons: [{ pressed: true }] }], 0.016)).toEqual([]);
    expect(read(undefined, 0.016)).toEqual([]);
  });

  it('wraps focus and nudges controls', () => {
    document.body.innerHTML = '<button id="a"></button><button id="b"></button><input id="r" type="range" min="0" max="1" step="0.1" value="0.5"><select id="s"><option>a</option><option>b</option></select>';
    const items = [...document.querySelectorAll('button')];
    expect(moveFocus(items, null, 1).id).toBe('a');
    expect(moveFocus(items, items[1], 1).id).toBe('a');
    expect(moveFocus([], null, 1)).toBe(null);
    const r = document.getElementById('r');
    const onInput = vi.fn();
    r.addEventListener('input', onInput);
    adjustControl(r, 1);
    expect(Number(r.value)).toBeCloseTo(0.6);
    expect(onInput).toHaveBeenCalled();
    const s = document.getElementById('s');
    adjustControl(s, 1);
    adjustControl(s, 1);
    expect(s.selectedIndex).toBe(1);
    expect(adjustControl(items[0], 1)).toBe(false);
  });

  it('detects the likely input device', () => {
    expect(detectDevice(env)).toBe('keys');
    expect(detectDevice({ matchMedia: () => ({ matches: true }) })).toBe('touch');
    expect(detectDevice({ navigator: { getGamepads: () => [{ connected: true }] } })).toBe('pad');
  });
});
