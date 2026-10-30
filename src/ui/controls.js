// The controls card on the title screen. One row per action, one column per
// device. Keep in sync with src/input/.
export const CONTROLS = [
  { action: 'Move', keys: 'WASD / Arrows', pad: 'Left stick', touch: 'Left stick' },
  { action: 'Camera', keys: 'Mouse / Q E', pad: 'Right stick', touch: 'Drag right side' },
  { action: 'Jump ×2', keys: 'Space', pad: 'A', touch: 'Jump' },
  { action: 'Dash', keys: 'Shift / K', pad: 'X / RB', touch: 'Dash' },
  { action: 'Ground pound', keys: 'C / L in air', pad: 'B / LB in air', touch: 'Pound in air' },
  { action: 'Pause', keys: 'Esc / P', pad: 'Start', touch: 'II button' },
];

export const DEVICES = [
  { id: 'keys', label: 'Keyboard' },
  { id: 'pad', label: 'Gamepad' },
  { id: 'touch', label: 'Touch' },
];

export function detectDevice(env = globalThis) {
  try {
    if (env.navigator?.getGamepads?.()?.some((p) => p && p.connected)) return 'pad';
    if (env.matchMedia?.('(pointer: coarse)')?.matches) return 'touch';
  } catch {
    // fall through
  }
  return 'keys';
}
