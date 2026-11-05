// World map: pick a world, pick a level, see what's done, and dress Pip in unlocked scarves.
// Built as a plain DOM screen and plugged into the menu system with ui.addScreen, so keyboard
// and gamepad navigation work the same as every other menu.
import { formatTime } from './settings.js';

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'testid') el.dataset.testid = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// Sky colours for each world's banner art (matches the in-game skies).
const WORLD_ART = {
  meadow: { top: '#5d97e0', bottom: '#f6dccb', isle: '#8fd36f', rock: '#a48c79' },
  ember: { top: '#2a1a3a', bottom: '#ff9a5c', isle: '#8a3a2a', rock: '#3a2e30' },
  starfall: { top: '#070b24', bottom: '#5a6fb0', isle: '#d8ecff', rock: '#5d6aa0' },
};

export function medalFor(def, record) {
  if (!record?.done || !def.parMs) return null;
  return record.bestMs <= def.parMs ? 'gold' : record.bestMs <= def.parMs * 1.5 ? 'silver' : 'bronze';
}

export function createWorldMap(ui, { worlds, levelById, progress, skins, onPlay, onBack, onSkin, onSound }) {
  injectMapStyles(document);
  const sound = (n) => onSound?.(n);
  let current = worlds[0].id;

  const worldUnlocked = (w) => progress.isUnlocked(w.levels[0]);
  const btn = (label, attrs) =>
    h('button', { type: 'button', class: 'ss-btn', ...attrs, onclick: (e) => { sound('click'); attrs.onclick?.(e); } }, label);

  const totals = h('div', { class: 'ss-map-totals', testid: 'map-totals' });
  const tabs = h('div', { class: 'ss-map-tabs', role: 'tablist' });
  const card = h('div', { class: 'ss-map-world' });
  const wardrobe = h('div', { class: 'ss-map-skins' });
  const root = h(
    'div',
    { class: 'ss-map' },
    h('div', { class: 'ss-map-head' },
      btn('‹ Back', { class: 'ss-btn ss-map-back', testid: 'map-back', onclick: () => onBack?.() }),
      h('h2', { class: 'ss-h2 ss-map-title' }, 'World Map'),
      totals),
    tabs,
    card,
    h('div', { class: 'ss-map-skinbox' }, h('h3', {}, "Pip's scarves"), h('p', { class: 'ss-map-hint' }, 'Find sunstones (3 hidden in every level) to unlock more.'), wardrobe),
  );
  ui.addScreen('worldmap', root);

  function render() {
    totals.replaceChildren(
      h('span', { class: 'ss-map-sun' }, `☀ ${progress.totalSunstones} / ${progress.maxSunstones}`),
      h('span', {}, `✓ ${progress.completedCount} / ${worlds.reduce((n, w) => n + w.levels.length, 0)}`),
    );

    tabs.replaceChildren(...worlds.map((w, i) => {
      const open = worldUnlocked(w);
      return btn(
        h('span', {}, h('b', {}, `World ${i + 1}`), h('span', {}, open ? w.name : 'Locked')),
        {
          class: `ss-btn ss-map-tab${w.id === current ? ' ss-on' : ''}${open ? '' : ' ss-locked'}`,
          testid: `world-${w.id}`,
          role: 'tab',
          'aria-selected': w.id === current ? 'true' : 'false',
          style: { '--wc': w.color },
          onclick: () => {
            current = w.id;
            render();
            tabs.querySelector('.ss-on')?.focus({ preventScroll: true });
          },
        },
      );
    }));

    const w = worlds.find((x) => x.id === current) ?? worlds[0];
    const wi = worlds.indexOf(w);
    const art = WORLD_ART[w.id] ?? WORLD_ART.meadow;
    const open = worldUnlocked(w);
    const banner = h(
      'div',
      { class: 'ss-map-banner', style: { background: `linear-gradient(180deg, ${art.top}, ${art.bottom})` } },
      ...[[12, 58, 26], [70, 40, 34], [44, 70, 18], [86, 72, 14]].map(([x, y, s]) =>
        h('i', { class: 'ss-map-isle', style: { left: `${x}%`, top: `${y}%`, width: `${s}%`, '--isle': art.isle, '--rock': art.rock } })),
      h('div', { class: 'ss-map-banner-text' }, h('h3', {}, w.name), h('p', {}, w.blurb)),
    );

    const nodes = w.levels.map((id, li) => {
      const def = levelById[id];
      const rec = progress.record(id);
      const unlocked = progress.isUnlocked(id);
      const done = progress.isComplete(id);
      const found = progress.sunstonesFound(id);
      const medal = medalFor(def, rec);
      const isBoss = !!def.boss;
      const status = !unlocked ? 'Locked' : done ? 'Cleared' : 'New';
      return h(
        'button',
        {
          type: 'button',
          class: `ss-btn ss-map-node${done ? ' ss-done' : ''}${unlocked ? '' : ' ss-locked'}${isBoss ? ' ss-boss' : ''}`,
          testid: `level-${id}`,
          disabled: !unlocked,
          'aria-label': `${def.name}, ${status}`,
          onclick: () => {
            sound('click');
            onPlay?.(id);
          },
        },
        h('span', { class: 'ss-map-num' }, isBoss ? '★' : `${wi + 1}-${li + 1}`),
        h('span', { class: 'ss-map-info' },
          h('b', {}, unlocked ? def.name : '???'),
          h('small', {}, unlocked ? def.subtitle ?? '' : 'Finish the level before to open this one')),
        h('span', { class: 'ss-map-meta' },
          h('span', { class: 'ss-map-stones', 'aria-label': `${found} of 3 sunstones` },
            ...[0, 1, 2].map((k) => h('i', { class: rec?.sunstones?.[k] ? 'ss-got' : '' }))),
          rec?.bestMs ? h('small', { class: `ss-map-time ${medal ? `ss-${medal}` : ''}`, title: def.parMs ? `Par ${formatTime(def.parMs)}` : '' }, formatTime(rec.bestMs)) : h('small', { class: 'ss-map-time' }, status)),
      );
    });

    card.replaceChildren(
      banner,
      open ? h('div', { class: 'ss-map-path' }, ...nodes)
        : h('p', { class: 'ss-map-lockmsg' }, `Defeat the boss of World ${wi} to reach ${w.name}.`),
    );
    card.style.setProperty('--wc', w.color);

    const have = progress.totalSunstones;
    wardrobe.replaceChildren(...skins.map((s) => {
      const unlocked = have >= s.need;
      const on = progress.skin.id === s.id;
      return h(
        'button',
        {
          type: 'button',
          class: `ss-btn ss-map-skin${on ? ' ss-on' : ''}${unlocked ? '' : ' ss-locked'}`,
          testid: `skin-${s.id}`,
          disabled: !unlocked,
          title: unlocked ? s.name : `${s.need} sunstones`,
          onclick: () => {
            sound('click');
            onSkin?.(s.id);
            render();
            wardrobe.querySelector('.ss-on')?.focus({ preventScroll: true });
          },
        },
        h('i', { class: 'ss-map-swatch', style: { background: `linear-gradient(135deg, ${hex(s.hood)} 0 50%, ${hex(s.scarf)} 50% 100%)` } }),
        h('small', {}, unlocked ? s.name : `☀ ${s.need}`),
      );
    }));
  }

  return {
    root,
    show(worldId) {
      if (worldId && worlds.some((w) => w.id === worldId)) current = worldId;
      render();
      ui.showScreen('worldmap');
      // Focus the next level to play in this world, so Enter / A starts it straight away.
      const next = progress.nextUp();
      const target = card.querySelector(`[data-testid="level-${next}"]`) ?? card.querySelector('.ss-map-node:not([disabled])');
      target?.focus({ preventScroll: true });
    },
    render,
  };
}

let injected = false;
function injectMapStyles(doc) {
  if (injected || !doc?.head) return;
  injected = true;
  const style = doc.createElement('style');
  style.textContent = MAP_CSS;
  doc.head.append(style);
}

const MAP_CSS = `
.ss-screen[data-screen="worldmap"] { align-items: flex-start; overflow-y: auto; }
.ss-map { width: min(760px, 100%); margin: auto; display: flex; flex-direction: column; gap: 14px; }
.ss-map-head { display: flex; align-items: center; gap: 12px; }
.ss-map-title { flex: 1; margin: 0; text-align: left; }
.ss-map .ss-btn.ss-map-back { width: auto; padding: 10px 16px; min-height: 44px; }
.ss-map-totals { display: flex; gap: 12px; font-weight: 800; color: var(--ss-dim); }
.ss-map-sun { color: #ffd36b; }
.ss-map-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ss-map .ss-btn.ss-map-tab { width: 100%; min-height: 56px; padding: 8px; display: flex; flex-direction: column; align-items: center; gap: 2px; border-color: color-mix(in srgb, var(--wc) 50%, transparent); }
.ss-map-tab b { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--wc); }
.ss-map-tab > span { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ss-map-tab span span { font-size: 14px; }
.ss-map .ss-btn.ss-map-tab.ss-on { background: color-mix(in srgb, var(--wc) 28%, rgba(18, 22, 58, 0.85)); box-shadow: inset 0 0 0 2px var(--wc); }
.ss-map .ss-locked { opacity: 0.55; }
.ss-map-world { border-radius: 22px; overflow: hidden; background: var(--ss-panel); border: 1px solid color-mix(in srgb, var(--wc) 45%, transparent);
  box-shadow: 0 20px 60px rgba(0, 0, 20, 0.45); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.ss-map-banner { position: relative; height: 150px; overflow: hidden; }
.ss-map-isle { position: absolute; aspect-ratio: 2.2 / 1; transform: translate(-50%, -50%);
  background: linear-gradient(180deg, var(--isle) 0 22%, var(--rock) 22% 100%);
  clip-path: polygon(0 0, 100% 0, 92% 22%, 62% 100%, 46% 92%, 8% 22%); border-radius: 50% 50% 0 0 / 30% 30% 0 0;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
  animation: ss-float 4s ease-in-out infinite; }
.ss-map-isle:nth-child(2) { animation-delay: -1.3s; } .ss-map-isle:nth-child(3) { animation-delay: -2.1s; } .ss-map-isle:nth-child(4) { animation-delay: -0.6s; }
.ss-map-banner-text { position: absolute; left: 18px; bottom: 12px; right: 18px; text-align: left; text-shadow: 0 2px 10px rgba(0, 0, 20, 0.6); }
.ss-map-banner-text h3 { margin: 0; font-size: 26px; font-weight: 900; }
.ss-map-banner-text p { margin: 2px 0 0; color: #f1f3ff; font-size: 14px; }
.ss-map-path { display: flex; flex-direction: column; gap: 8px; padding: 14px; }
.ss-map .ss-btn.ss-map-node { width: 100%; display: grid; grid-template-columns: 52px 1fr auto; align-items: center; gap: 12px; text-align: left; padding: 10px 14px; min-height: 64px; }
.ss-map-num { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-weight: 900; font-size: 15px;
  background: color-mix(in srgb, var(--wc) 30%, rgba(255, 255, 255, 0.06)); border: 2px solid var(--wc); }
.ss-map-node.ss-done .ss-map-num { background: var(--wc); color: #10122e; }
.ss-map-node.ss-boss .ss-map-num { font-size: 20px; color: #ffd36b; border-color: #ffd36b; }
.ss-map-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ss-map-info b { font-size: 17px; }
.ss-map-info small { color: var(--ss-dim); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ss-map-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.ss-map-stones { display: flex; gap: 4px; }
.ss-map-stones i { width: 12px; height: 12px; transform: rotate(45deg); border-radius: 3px; border: 2px solid #ffd36b; opacity: 0.5; }
.ss-map-stones i.ss-got { background: #ffd36b; opacity: 1; box-shadow: 0 0 8px #ffa21a; }
.ss-map-time { font-variant-numeric: tabular-nums; color: var(--ss-dim); }
.ss-map-time.ss-gold { color: #ffd36b; } .ss-map-time.ss-silver { color: #dfe6ff; } .ss-map-time.ss-bronze { color: #e0a070; }
.ss-map-lockmsg { padding: 26px 18px; margin: 0; color: var(--ss-dim); }
.ss-map-skinbox { border-radius: 18px; padding: 14px; background: var(--ss-panel); border: 1px solid var(--ss-panel-edge); text-align: left; }
.ss-map-skinbox h3 { margin: 0; font-size: 16px; }
.ss-map-hint { margin: 2px 0 10px; color: var(--ss-dim); font-size: 13px; }
.ss-map-skins { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.ss-map .ss-btn.ss-map-skin { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 6px; min-height: 76px; }
.ss-map .ss-btn.ss-map-skin.ss-on { box-shadow: inset 0 0 0 2px var(--ss-accent); }
.ss-map-swatch { width: 34px; height: 34px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.6); }
.ss-progress { color: #ffd36b; }
.ss-results { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 4px 0 12px; }
.ss-results span { padding: 6px 12px; border-radius: 999px; background: rgba(255, 211, 107, 0.14); border: 1px solid rgba(255, 211, 107, 0.4); color: #ffe7a6; font-weight: 700; font-size: 14px; }
@media (max-width: 520px) {
  .ss-map-tabs { grid-template-columns: 1fr; }
  .ss-map-banner { height: 120px; }
  .ss-map .ss-btn.ss-map-node { grid-template-columns: 44px 1fr; }
  .ss-map-meta { grid-column: 2; flex-direction: row; justify-content: space-between; align-items: center; }
}
`;
