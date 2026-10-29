import * as Phaser from 'phaser';
import { detectLang } from '../i18n';
import { STRINGS } from '../strings';
import { EXTRA } from '../extra';
import { loadConfig } from '../net';
import { validCode } from '../game';
import { COLORS, text } from '../ui';

// Reads the connection settings, then opens the lobby, or the room in
// ?room=CODE when the player followed a friend's link.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  async create() {
    const lang = detectLang();
    document.documentElement.lang = lang;
    const t = STRINGS[lang];
    try {
      const config = await loadConfig();
      if (!config) {
        text(this, 40, 40, EXTRA[lang].setup, 18, COLORS.warn).setWordWrapWidth(880);
        return;
      }
      const code = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
      if (validCode(code)) this.scene.start('room', { config, lang, code });
      else this.scene.start('lobby', { config, lang });
    } catch {
      text(this, 40, 40, t.demoUnavailable, 18, COLORS.warn).setWordWrapWidth(880);
    }
  }
}
