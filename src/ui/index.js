// STUB from the scaffold. The UI and audio thread replaces this file.
const DEFAULTS = { master: 0.8, music: 0.6, sfx: 0.8, sensitivity: 1, invertY: false, quality: 'high', showFps: false };

export function createUI(root, handlers) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font:20px system-ui;color:#fff;pointer-events:none';
  root.appendChild(el);
  const button = (label, id, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.testid = id;
    b.style.pointerEvents = 'auto';
    b.onclick = fn;
    return b;
  };
  return {
    getSettings: () => ({ ...DEFAULTS }),
    showTitle() { el.replaceChildren(button('Play', 'play', handlers.onStart)); },
    showHud() { el.innerHTML = '<div data-testid="hud" style="position:fixed;top:12px;left:12px"></div>'; },
    updateHud({ shards, totalShards, health }) { const h = el.querySelector('[data-testid=hud]'); if (h) h.textContent = `Shards ${shards}/${totalShards}  Health ${health}`; },
    showPause() { el.replaceChildren(button('Resume', 'resume', handlers.onResume)); },
    showWin() { el.replaceChildren(button('Play again', 'play', handlers.onRestart)); },
    showLose() {},
    hide() { el.replaceChildren(); },
    toast() {},
    setFps() {},
  };
}
