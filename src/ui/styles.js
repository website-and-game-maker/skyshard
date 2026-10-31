// All UI styles live here and are injected once, so the UI works without a
// separate stylesheet import.
export const UI_CSS = `
.ss-ui {
  --ss-ink: #f4f6ff;
  --ss-dim: #b8bfe6;
  --ss-panel: rgba(18, 22, 58, 0.72);
  --ss-panel-edge: rgba(160, 190, 255, 0.28);
  --ss-accent: #6ef3e0;
  --ss-accent-2: #ffb38a;
  --ss-danger: #ff6b8a;
  --ss-focus: #fff27a;
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  font-family: ui-rounded, "SF Pro Rounded", "Nunito", "Trebuchet MS", system-ui, sans-serif;
  color: var(--ss-ink);
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.ss-ui *, .ss-ui *::before, .ss-ui *::after { box-sizing: border-box; }
.ss-ui [hidden] { display: none !important; }

.ss-screen {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  pointer-events: auto;
  background: radial-gradient(ellipse at center, rgba(10, 12, 40, 0.25), rgba(6, 8, 28, 0.78));
  animation: ss-fade 0.25s ease-out;
}
.ss-screen.ss-active { display: flex; }
.ss-screen[data-screen="title"] {
  background: radial-gradient(ellipse at 50% 35%, rgba(255, 179, 138, 0.18), transparent 60%),
    radial-gradient(ellipse at center, rgba(10, 12, 40, 0.1), rgba(6, 8, 28, 0.7));
}

.ss-panel {
  width: min(440px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 28px 24px;
  border-radius: 22px;
  background: var(--ss-panel);
  border: 1px solid var(--ss-panel-edge);
  box-shadow: 0 20px 60px rgba(0, 0, 20, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  text-align: center;
}
.ss-panel.ss-plain { width: min(560px, 100%); overflow-x: hidden; background: transparent; border: 0; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }

.ss-logo { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 26px; }
.ss-gem {
  width: 54px; height: 54px;
  transform: rotate(45deg);
  border-radius: 10px;
  background: linear-gradient(135deg, #e9fffb 0%, var(--ss-accent) 45%, #5a7cff 100%);
  box-shadow: 0 0 30px rgba(110, 243, 224, 0.7), 0 0 80px rgba(90, 124, 255, 0.4);
  animation: ss-float 3.2s ease-in-out infinite;
}
.ss-title {
  margin: 0;
  font-size: clamp(40px, 11vw, 76px);
  font-weight: 900;
  letter-spacing: 0.06em;
  line-height: 1.1;
  padding: 0 0.1em;
  background: linear-gradient(180deg, #ffffff 10%, #cfe9ff 50%, var(--ss-accent-2) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 4px 18px rgba(255, 179, 138, 0.35));
}
.ss-tagline { margin: 0; color: #e6eaff; font-size: 16px; letter-spacing: 0.02em; text-shadow: 0 1px 2px rgba(6, 8, 28, 0.9), 0 0 14px rgba(6, 8, 28, 0.75); }
.ss-h2 { margin: 0 0 18px; font-size: 28px; font-weight: 800; letter-spacing: 0.03em; }
.ss-sub { margin: -8px 0 20px; color: var(--ss-dim); }

.ss-menu { display: flex; flex-direction: column; gap: 12px; }
.ss-btn {
  appearance: none;
  min-height: 52px;
  padding: 12px 20px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: var(--ss-ink);
  font: inherit;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
  touch-action: manipulation;
}
.ss-btn:hover { background: rgba(255, 255, 255, 0.16); }
.ss-btn:active { transform: scale(0.97); }
.ss-btn.ss-primary {
  background: linear-gradient(135deg, var(--ss-accent) 0%, #64a8ff 100%);
  color: #0b1036;
  border-color: transparent;
  box-shadow: 0 8px 26px rgba(110, 243, 224, 0.35);
}
.ss-btn:focus-visible, .ss-field input:focus-visible, .ss-field select:focus-visible {
  outline: 3px solid var(--ss-focus);
  outline-offset: 3px;
}
/* No focus ring for mouse and touch players; keyboard and gamepad keep it. */
.ss-ui.ss-pointer .ss-btn:focus-visible, .ss-ui.ss-pointer .ss-tab:focus-visible { outline: none; }
.ss-foot { margin: 0; font-size: 14px; color: var(--ss-dim); min-height: 1.2em; }
/* The title sits on the bright 3D scene, so its quieter controls get their own backing. */
.ss-plain .ss-btn:not(.ss-primary) {
  background: rgba(14, 18, 50, 0.55); border-color: rgba(255, 255, 255, 0.22);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.ss-plain .ss-btn:not(.ss-primary):hover { background: rgba(14, 18, 50, 0.72); }
.ss-plain .ss-foot { text-shadow: 0 1px 2px rgba(6, 8, 28, 0.9); color: #e6eaff; }
.ss-foot-row { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-top: 14px; min-height: 36px; }
.ss-foot-row .ss-foot:empty { display: none; }
.ss-link {
  appearance: none; border: 1px solid rgba(255, 255, 255, 0.22); background: rgba(14, 18, 50, 0.55);
  color: var(--ss-ink); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
  min-height: 36px; padding: 6px 16px; border-radius: 999px; touch-action: manipulation;
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.ss-link:hover { background: rgba(14, 18, 50, 0.75); }
.ss-link:focus-visible { outline: 3px solid var(--ss-focus); outline-offset: 2px; }
.ss-ui.ss-pointer .ss-link:focus-visible { outline: none; }

/* Feedback form */
.ss-fb { text-align: left; margin-bottom: 16px; }
.ss-fb .ss-tabs { flex-wrap: wrap; margin-bottom: 14px; }
.ss-fb-label { display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; margin-bottom: 6px; }
.ss-count { font-size: 12px; font-weight: 600; color: var(--ss-dim); font-variant-numeric: tabular-nums; }
.ss-textarea {
  display: block; width: 100%; min-height: 104px; resize: vertical; padding: 10px 12px; border-radius: 12px;
  background: rgba(255, 255, 255, 0.08); color: var(--ss-ink); border: 1px solid rgba(255, 255, 255, 0.2);
  font: inherit; font-size: 16px; line-height: 1.4; -webkit-user-select: text; user-select: text;
}
.ss-textarea::placeholder { color: var(--ss-dim); opacity: 0.8; }
.ss-textarea:focus-visible { outline: 3px solid var(--ss-focus); outline-offset: 2px; }
.ss-info-row { margin-top: 12px; font-size: 14px; }
.ss-check { display: flex; align-items: center; gap: 10px; font-weight: 600; cursor: pointer; }
.ss-check input { width: 22px; height: 22px; accent-color: var(--ss-accent); }
.ss-details { margin-top: 6px; color: var(--ss-dim); }
.ss-details summary { cursor: pointer; padding: 4px 0; }
.ss-details summary:focus-visible { outline: 3px solid var(--ss-focus); outline-offset: 2px; }
.ss-info {
  margin: 6px 0 0; padding: 10px; border-radius: 10px; background: rgba(0, 0, 0, 0.25); max-height: 140px; overflow: auto;
  font: 12px/1.5 ui-monospace, SFMono-Regular, monospace; white-space: pre-wrap; color: var(--ss-ink);
  -webkit-user-select: text; user-select: text;
}
.ss-status { min-height: 1.3em; margin: 10px 0 0; font-size: 14px; color: var(--ss-accent-2); }
.ss-fb-done { margin: 6px 0 22px; font-size: 18px; font-weight: 700; color: var(--ss-accent); }

.ss-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 22px; }
.ss-stat { padding: 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.06); }
.ss-stat b { display: block; font-size: 24px; font-variant-numeric: tabular-nums; }
.ss-stat span { font-size: 13px; color: var(--ss-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.ss-record {
  display: inline-block; margin: -6px 0 16px; padding: 4px 12px; border-radius: 999px;
  background: var(--ss-accent-2); color: #3a1a08; font-weight: 800; font-size: 14px;
  animation: ss-pop 0.5s cubic-bezier(.2,1.6,.4,1);
}

.ss-form { display: flex; flex-direction: column; gap: 14px; text-align: left; margin-bottom: 20px; }
.ss-field { display: grid; grid-template-columns: 1fr 1.2fr; align-items: center; gap: 12px; font-size: 16px; }
.ss-field input[type="range"] { width: 100%; height: 32px; accent-color: var(--ss-accent); }
.ss-field input[type="checkbox"] { width: 26px; height: 26px; justify-self: start; accent-color: var(--ss-accent); }
.ss-field select {
  min-height: 40px; border-radius: 10px; padding: 6px 10px; font: inherit;
  background: rgba(255, 255, 255, 0.1); color: var(--ss-ink); border: 1px solid rgba(255, 255, 255, 0.2);
}
.ss-field select option { color: #111; }

.ss-card {
  margin-top: 22px; padding: 12px 14px 4px; border-radius: 16px;
  background: rgba(14, 18, 50, 0.5); border: 1px solid rgba(255, 255, 255, 0.12);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
}
.ss-tabs { display: flex; gap: 6px; justify-content: center; margin-bottom: 6px; }
.ss-tab {
  appearance: none; min-height: 36px; padding: 6px 14px; border-radius: 999px; cursor: pointer;
  border: 1px solid transparent; background: transparent; color: var(--ss-dim);
  font: inherit; font-size: 14px; font-weight: 700; touch-action: manipulation;
}
.ss-tab.ss-on { background: rgba(255, 255, 255, 0.12); color: var(--ss-ink); border-color: rgba(255, 255, 255, 0.18); }
.ss-tab:focus-visible { outline: 3px solid var(--ss-focus); outline-offset: 2px; }
.ss-card .ss-controls { margin-bottom: 6px; }
.ss-controls { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; text-align: left; }
.ss-controls td { padding: 6px; text-align: right; color: var(--ss-dim); }
.ss-controls th, .ss-controls td { padding: 7px 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); vertical-align: top; }
.ss-controls th { color: var(--ss-dim); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
.ss-controls td:first-child { font-weight: 700; text-align: left; color: var(--ss-ink); }
.ss-goal { color: var(--ss-dim); margin: 0 0 16px; font-size: 15px; line-height: 1.45; }

/* HUD */
.ss-hud {
  position: absolute; inset: 0; display: none;
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
    max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
}
.ss-hud.ss-active { display: block; }
.ss-hud-left { position: absolute; top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left)); display: flex; flex-direction: column; gap: 8px; }
.ss-hud-right { position: absolute; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); display: flex; gap: 8px; align-items: center; }
.ss-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 999px;
  background: rgba(14, 18, 50, 0.55); border: 1px solid rgba(255, 255, 255, 0.14);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  font-weight: 800; font-size: 20px; font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.ss-shard-icon {
  width: 16px; height: 16px; transform: rotate(45deg); border-radius: 3px;
  background: linear-gradient(135deg, #e9fffb, var(--ss-accent) 50%, #5a7cff);
  box-shadow: 0 0 10px rgba(110, 243, 224, 0.8);
}
.ss-pill.ss-bump { animation: ss-bump 0.3s ease-out; }
.ss-hearts { display: flex; gap: 4px; padding-left: 4px; }
.ss-heart { width: 28px; height: 26px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4)); transition: transform 0.2s; }
.ss-heart path { fill: rgba(255, 255, 255, 0.18); stroke: rgba(255, 255, 255, 0.5); stroke-width: 1.5; }
.ss-heart.ss-full path { fill: var(--ss-danger); stroke: #fff; }
.ss-hearts.ss-hit .ss-heart { animation: ss-shake 0.35s; }
.ss-pause-btn {
  pointer-events: auto; width: 48px; height: 48px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(14, 18, 50, 0.55); border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--ss-ink); cursor: pointer; touch-action: manipulation; padding: 0;
}
.ss-pause-btn svg { width: 20px; height: 20px; fill: currentColor; }
.ss-fps { position: absolute; right: max(12px, env(safe-area-inset-right)); top: calc(max(12px, env(safe-area-inset-top)) + 56px); font: 12px ui-monospace, monospace; opacity: 0.75; display: none; }
.ss-fps.ss-active { display: block; }
.ss-toast {
  position: absolute; top: 18%; left: 50%; transform: translate(-50%, -10px);
  padding: 10px 22px; border-radius: 999px; background: rgba(14, 18, 50, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2); font-weight: 800; font-size: 20px;
  opacity: 0; transition: opacity 0.25s, transform 0.25s; white-space: nowrap; pointer-events: none;
}
.ss-toast.ss-show { opacity: 1; transform: translate(-50%, 0); }

@keyframes ss-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ss-float { 0%, 100% { transform: rotate(45deg) translate(0, 0); } 50% { transform: rotate(45deg) translate(-6px, -6px); } }
@keyframes ss-bump { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes ss-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes ss-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }

@media (max-width: 480px), (max-height: 480px) {
  .ss-panel { padding: 20px 16px; }
  .ss-pill { font-size: 17px; padding: 6px 12px; }
  .ss-heart { width: 24px; height: 22px; }
  .ss-logo { margin-bottom: 16px; }
}
/* Short windows, like a Chromebook or the arcade's frame: keep the whole title in view. */
@media (max-height: 720px) and (min-height: 481px) {
  .ss-gem { width: 40px; height: 40px; }
  .ss-title { font-size: clamp(40px, 9vh, 64px); }
  .ss-logo { gap: 6px; margin-bottom: 16px; }
  .ss-menu { gap: 10px; }
  .ss-btn { min-height: 46px; padding: 9px 18px; }
  .ss-card { margin-top: 14px; padding: 8px 12px 2px; }
  .ss-controls th, .ss-controls td { padding: 4px 6px; }
  .ss-foot-row { margin-top: 10px; }
}
@media (max-height: 600px) and (min-height: 481px) {
  .ss-gem { display: none; }
  .ss-tab { min-height: 32px; padding: 4px 12px; }
}
@media (max-height: 560px) and (min-height: 481px) {
  .ss-tagline { display: none; }
  .ss-logo { margin-bottom: 10px; }
  .ss-controls th, .ss-controls td { padding: 3px 6px; }
  .ss-info { max-height: 90px; }
}
@media (max-height: 480px) and (orientation: landscape) {
  .ss-info { max-height: 70px; }
  .ss-foot-row { margin-top: 6px; min-height: 0; }
  .ss-textarea { min-height: 64px; }
  .ss-gem, .ss-tagline { display: none; }
  .ss-title { font-size: 36px; }
  .ss-logo { margin-bottom: 10px; }
  .ss-btn { min-height: 46px; padding: 8px 18px; }
  .ss-card { margin-top: 10px; padding: 6px 12px 2px; }
  .ss-tab { min-height: 32px; padding: 4px 12px; }
  .ss-controls th, .ss-controls td { padding: 3px 6px; }
  .ss-panel { padding: 14px 18px; }
  .ss-h2 { margin-bottom: 10px; font-size: 22px; }
  .ss-form { gap: 4px; margin-bottom: 10px; }
  .ss-stats { margin-bottom: 12px; }
  .ss-menu { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .ss-menu .ss-btn { flex: 1 1 140px; }
}
@media (prefers-reduced-motion: reduce) {
  .ss-ui *, .ss-ui *::before, .ss-ui *::after { animation: none !important; transition: none !important; }
}
`;

export function injectStyles(doc = document) {
  if (doc.getElementById('ss-ui-styles')) return;
  const style = doc.createElement('style');
  style.id = 'ss-ui-styles';
  style.textContent = UI_CSS;
  doc.head.appendChild(style);
}
