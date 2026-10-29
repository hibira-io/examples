import * as Phaser from 'phaser';
import type { Lang } from '../i18n';
import { STRINGS } from '../strings';
import { CAPACITY, roomCode, validCode } from '../game';
import { listRooms, loadPlayer, savePlayer, type Config, type OpenRoom } from '../net';
import { button, COLORS, input, text } from '../ui';

interface Data {
  config: Config;
  lang: Lang;
  notice?: string;
}

// Name, create or join by code, and the open rooms from the HTTP API
// (nextjs-lobby's /api/rooms), refreshed every few seconds.
export class LobbyScene extends Phaser.Scene {
  private opts!: Data;
  private list!: Phaser.GameObjects.Container;

  constructor() {
    super('lobby');
  }

  init(data: Data) {
    this.opts = data;
    history.replaceState(null, '', location.pathname + langQuery());
  }

  create() {
    const t = STRINGS[this.opts.lang];
    const player = loadPlayer();
    savePlayer(player);

    text(this, 40, 32, t.title, 34).setFontStyle('bold');
    text(this, 40, 84, t.intro(CAPACITY), 16, COLORS.muted).setWordWrapWidth(880);

    text(this, 40, 150, t.yourName, 14, COLORS.muted);
    const name = input(this, 40, 172, 260, player.name, t.yourName);
    name.addEventListener('input', () => savePlayer({ ...loadPlayer(), name: name.value.trim() || player.name }));

    button(this, 320, 172, 200, 40, t.createRoom, () => this.enter(roomCode()), true);

    const code = input(this, 560, 172, 120, '', 'CODE', 4);
    code.style.textTransform = 'uppercase';
    code.addEventListener('input', () => (code.value = code.value.toUpperCase().replace(/[^A-Z]/g, '')));
    code.addEventListener('keydown', (e) => e.key === 'Enter' && validCode(code.value) && this.enter(code.value));
    button(this, 690, 172, 100, 40, t.join, () => validCode(code.value) && this.enter(code.value));

    if (this.opts.notice) text(this, 40, 228, this.opts.notice, 16, COLORS.warn);

    text(this, 40, 270, t.openRooms, 20).setFontStyle('bold');
    this.list = this.add.container(40, 310);

    const refresh = () => listRooms().then((rooms) => this.scene.isActive() && this.render(rooms));
    refresh();
    this.time.addEvent({ delay: 4000, loop: true, callback: refresh });
  }

  private render(rooms: OpenRoom[]) {
    const t = STRINGS[this.opts.lang];
    this.list.removeAll(true);
    if (rooms.length === 0) {
      this.list.add(text(this, 0, 0, t.noRooms, 16, COLORS.muted).setWordWrapWidth(880));
      return;
    }
    rooms.slice(0, 6).forEach((r, i) => {
      const y = i * 52;
      const full = r.members >= CAPACITY;
      const row = this.add.rectangle(0, y, 880, 44, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.line);
      const join = button(this, 760, y + 4, 110, 36, full ? t.full : t.join, () => this.enter(r.id));
      join.setEnabled(!full);
      this.list.add([
        row,
        text(this, 16, y + 11, r.id, 18, COLORS.accentText).setFontStyle('bold'),
        text(this, 120, y + 13, t.playerCount(r.members, CAPACITY), 15, COLORS.muted),
        join.container,
      ]);
    });
  }

  private enter(code: string) {
    this.scene.start('room', { config: this.opts.config, lang: this.opts.lang, code });
  }
}

/** Keeps ?lang= in the address when the player picked a language by link. */
export function langQuery(): string {
  const lang = new URLSearchParams(location.search).get('lang');
  return lang ? `?lang=${encodeURIComponent(lang)}` : '';
}
