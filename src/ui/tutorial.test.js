// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { controlLabel, tipText, createTipPanel } from './tutorial.js';

describe('tutorial tip text', () => {
  it('names the right control for each device', () => {
    expect(controlLabel('jump', 'keyboard')).toBe('Space');
    expect(controlLabel('jump', 'gamepad')).toBe('A');
    expect(controlLabel('pound', 'keyboard')).toBe('C / L');
    expect(controlLabel('dash', 'touch')).toBe('the Dash button');
  });

  it('fills tokens and leaves unknown ones readable', () => {
    expect(tipText('Press {jump} then {dash}.', 'keyboard')).toBe('Press Space then Shift / K.');
    expect(tipText('Try {nope}', 'keyboard')).toBe('Try nope');
  });
});

describe('tip panel', () => {
  it('shows a lesson, ticks it off only for the taught action, and skips', () => {
    const onSkip = vi.fn();
    const panel = createTipPanel(document.body, { onSkip });
    panel.show({ title: 'Jump', text: 'Press {jump}', action: 'jump' }, 2, 9);
    expect(panel.el.classList.contains('ss-show')).toBe(true);
    expect(panel.el.textContent).toContain('3 / 9');
    expect(panel.el.querySelector('.ss-key').textContent).toBe('Space');
    expect(panel.action).toBe('jump');

    panel.setDevice('gamepad');
    expect(panel.el.querySelector('.ss-key').textContent).toBe('A');

    expect(panel.complete('dash')).toBe(false);
    expect(panel.complete('jump')).toBe(true);
    expect(panel.el.classList.contains('ss-done')).toBe(true);
    expect(panel.action).toBe(null);

    panel.el.querySelector('[data-testid="skip-tutorial"]').click();
    expect(onSkip).toHaveBeenCalledOnce();
    panel.dispose();
  });
});
