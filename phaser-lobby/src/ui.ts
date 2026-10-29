import * as Phaser from 'phaser';

export const COLORS = {
  bg: 0x0f1720,
  panel: 0x17222d,
  line: 0x2a3a48,
  text: '#e8eef2',
  muted: '#8ea3b3',
  accent: 0x3cc8b4,
  accentText: '#3cc8b4',
  warn: '#f0a061',
  wait: 0xb9473a,
  go: 0x2fae5f,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", "Noto Sans", "PingFang TC", "Hiragino Sans", "Malgun Gothic", sans-serif';

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 16, color = COLORS.text) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setLabel(s: string): void;
  setEnabled(on: boolean): void;
}

/** A rectangle button that works with mouse, touch and pen. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  primary = false,
): Button {
  const bg = scene.add.rectangle(0, 0, w, h, primary ? COLORS.accent : COLORS.panel).setOrigin(0);
  bg.setStrokeStyle(1, primary ? COLORS.accent : COLORS.line);
  const t = scene.add
    .text(w / 2, h / 2, label, { fontFamily: FONT, fontSize: '16px', color: primary ? '#08221f' : COLORS.text })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, t]).setSize(w, h);
  let enabled = true;
  bg.setInteractive({ useHandCursor: true })
    .on('pointerover', () => enabled && bg.setAlpha(0.85))
    .on('pointerout', () => bg.setAlpha(1))
    .on('pointerup', () => enabled && onClick());
  return {
    container,
    setLabel: (s) => t.setText(s),
    setEnabled(on) {
      enabled = on;
      container.setAlpha(on ? 1 : 0.4);
    },
  };
}

/**
 * A real <input> over the canvas, so typing works with IMEs (Chinese,
 * Japanese, Korean) and phone keyboards.
 */
export function input(scene: Phaser.Scene, x: number, y: number, w: number, value = '', placeholder = '', maxLength = 20) {
  const el = document.createElement('input');
  el.value = value;
  el.placeholder = placeholder;
  el.maxLength = maxLength;
  el.style.width = `${w}px`;
  el.setAttribute('aria-label', placeholder);
  // Keys typed into the input must not reach the game (Space taps the pad).
  el.addEventListener('keydown', (e) => e.stopPropagation());
  scene.add.dom(x, y, el).setOrigin(0);
  return el;
}
