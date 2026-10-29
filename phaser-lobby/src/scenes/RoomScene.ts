import * as Phaser from 'phaser';
import { Room, type Member } from '@hibira-io/lobby';
import type { Lang } from '../i18n';
import { STRINGS, type Strings } from '../strings';
import { EXTRA } from '../extra';
import { CAPACITY, newGame, ROOM_PREFIX, ROUND_WINDOW, roundWinner, TAP_EVENT, type GameStart, type Tap } from '../game';
import { connect, type Config } from '../net';
import { button, COLORS, input, text, type Button } from '../ui';
import { langQuery } from './LobbyScene';

interface Data {
  config: Config;
  lang: Lang;
  code: string;
}

interface Info {
  name: string;
}

type Stage =
  | { kind: 'lobby' }
  | { kind: 'wait'; round: number }
  | { kind: 'go'; round: number; at: number }
  | { kind: 'result'; round: number; winner: string | null }
  | { kind: 'over' };

const PAD = { x: 653, y: 230, r: 130 };

// One room: seats, host, ready, kick, chat, and the reaction game. It sends
// the same events as nextjs-lobby and the Godot example, so players of all
// three can share a room.
export class RoomScene extends Phaser.Scene {
  private opts!: Data;
  private t!: Strings;
  private room!: Room<Info>;
  private stage: Stage = { kind: 'lobby' };
  private scores: Record<string, number> = {};
  private taps = new Map<string, number>();
  private timers: Phaser.Time.TimerEvent[] = [];

  private status!: Phaser.GameObjects.Text;
  private seats!: Phaser.GameObjects.Container;
  private readyBtn!: Button;
  private startBtn!: Button;
  private hint!: Phaser.GameObjects.Text;
  private pad!: Phaser.GameObjects.Arc;
  private padText!: Phaser.GameObjects.Text;
  private notice!: Phaser.GameObjects.Text;
  private chat!: Phaser.GameObjects.Text;
  private typing!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('room');
  }

  init(data: Data) {
    this.opts = data;
    this.t = STRINGS[data.lang];
    this.stage = { kind: 'lobby' };
    this.scores = {};
    this.taps = new Map();
    this.timers = [];
    const q = langQuery();
    history.replaceState(null, '', `${location.pathname}?room=${data.code}${q ? '&' + q.slice(1) : ''}`);
  }

  create() {
    const t = this.t;
    const { code } = this.opts;

    text(this, 24, 20, `${t.room} ${code}`, 28).setFontStyle('bold');
    text(this, 24, 56, t.shareHint, 14, COLORS.muted);
    button(this, 816, 20, 120, 40, t.leave, () => this.leave());

    // Players
    this.add.rectangle(24, 88, 320, 360, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.line);
    this.status = text(this, 40, 100, t.joining(code), 18).setFontStyle('bold');
    this.seats = this.add.container(40, 136);
    this.readyBtn = button(this, 40, 330, 140, 40, t.imReady, () => this.room.setReady(!this.room.me?.ready));
    this.startBtn = button(this, 188, 330, 140, 40, t.startGame, () => this.room.start(newGame()), true);
    this.hint = text(this, 40, 380, '', 13, COLORS.muted).setWordWrapWidth(290);

    // The pad
    this.pad = this.add.circle(PAD.x, PAD.y, PAD.r, COLORS.panel).setStrokeStyle(4, COLORS.line);
    this.pad.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.tap());
    this.input.keyboard?.on('keydown-SPACE', () => this.tap());
    this.padText = text(this, PAD.x, PAD.y, t.getReady, 26).setOrigin(0.5).setAlign('center').setWordWrapWidth(PAD.r * 1.7);
    text(this, PAD.x, PAD.y + PAD.r + 18, EXTRA[this.opts.lang].tapHint, 13, COLORS.muted).setOrigin(0.5, 0);
    this.notice = text(this, PAD.x, PAD.y + PAD.r + 40, '', 15, COLORS.warn).setOrigin(0.5, 0);
    const dot = this.make.graphics({}, false).fillStyle(0xffffff).fillCircle(4, 4, 4);
    dot.generateTexture('spark', 8, 8);
    dot.destroy();
    this.sparks = this.add.particles(PAD.x, PAD.y, 'spark', {
      speed: { min: 120, max: 360 },
      lifespan: 700,
      scale: { start: 1.2, end: 0 },
      tint: [COLORS.accent, 0xf0a061, 0xffffff],
      emitting: false,
    });

    // Chat
    this.add.rectangle(24, 464, 912, 160, COLORS.panel).setOrigin(0).setStrokeStyle(1, COLORS.line);
    text(this, 40, 474, t.chat, 15, COLORS.muted).setFontStyle('bold');
    this.chat = text(this, 40, 498, '', 15).setWordWrapWidth(880).setLineSpacing(4);
    this.typing = text(this, 40, 560, '', 13, COLORS.muted);
    const say = input(this, 40, 576, 760, '', t.saySomething, 200);
    say.addEventListener('input', () => this.room.sendTyping());
    const send = () => {
      if (!say.value.trim()) return;
      this.room.send(say.value.trim());
      say.value = '';
    };
    say.addEventListener('keydown', (e) => e.key === 'Enter' && send());
    button(this, 808, 576, 112, 40, t.send, send);

    this.join();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private join() {
    const pusher = connect(this.opts.config);
    const room = Room.join<Info>(pusher, ROOM_PREFIX + this.opts.code, { capacity: CAPACITY });
    this.room = room;
    const update = () => this.render();
    for (const ev of ['ready', 'members', 'host', 'settings', 'message', 'typing'] as const) room.on(ev, update);
    room.on('full', () => this.leave(this.t.roomFull(this.opts.code)));
    room.on('kicked', () => this.leave(this.t.kicked));
    room.on('start', ({ data }) => this.play(data as GameStart));
    room.on('error', (err) => console.warn(err));
    // The auth endpoint refuses a full room before the subscription starts.
    room.channel.bind('pusher:subscription_error', (e: { status?: number }) =>
      this.leave(e?.status === 403 ? this.t.roomFull(this.opts.code) : this.t.joinFailed),
    );
    room.channel.bind(TAP_EVENT, (tap: Tap, meta?: { user_id?: string }) => {
      if (meta?.user_id) this.record(meta.user_id, tap);
    });
    this.render();
  }

  private cleanup() {
    this.clearTimers();
    this.room.channel.unbind(TAP_EVENT);
    this.room.channel.unbind('pusher:subscription_error');
    this.room.leave();
  }

  private leave(notice?: string) {
    this.scene.start('lobby', { config: this.opts.config, lang: this.opts.lang, notice });
  }

  private name(id: string | null): string {
    if (!id) return '';
    return this.room.players.find((p) => p.id === id)?.info?.name ?? this.t.someone;
  }

  private get playing() {
    return this.stage.kind !== 'lobby' && this.stage.kind !== 'over';
  }

  private render() {
    const t = this.t;
    const room = this.room;
    if (!room.ready) return;
    const players = room.players;
    this.status.setText(t.players(players.length, CAPACITY));

    this.seats.removeAll(true);
    players.forEach((p: Member<Info>, i) => {
      const y = i * 46;
      const tags = [p.host && t.host, p.me && t.you].filter(Boolean).join(' · ');
      this.seats.add([
        text(this, 0, y, p.info?.name ?? t.player, 17, p.me ? COLORS.accentText : COLORS.text),
        text(this, 0, y + 22, tags, 12, COLORS.muted),
        text(this, 200, y, String(this.scores[p.id] ?? 0), 17).setOrigin(1, 0),
        text(this, 216, y + 2, p.ready ? t.ready : t.notReady, 13, p.ready ? COLORS.accentText : COLORS.muted),
      ]);
      if (room.isHost && !p.me) {
        const kick = text(this, 216, y + 22, t.remove, 12, COLORS.warn).setInteractive({ useHandCursor: true });
        kick.on('pointerup', () => room.kick(p.id));
        this.seats.add(kick);
      }
    });

    this.readyBtn.setLabel(room.me?.ready ? t.notReady : t.imReady);
    this.readyBtn.setEnabled(!this.playing);
    const canStart = room.isHost && players.length >= 2 && room.allReady && !this.playing;
    this.startBtn.container.setVisible(room.isHost);
    this.startBtn.setLabel(this.stage.kind === 'over' ? t.playAgain : t.startGame);
    this.startBtn.setEnabled(canStart);
    this.hint.setText(
      room.isHost ? (canStart || this.playing ? '' : t.startHint) : t.waitingFor(this.name(room.host?.id ?? null)),
    );

    this.chat.setText(
      room.messages
        .slice(-3)
        .map((m) => `${m.info?.name ?? t.player}: ${m.text}`)
        .join('\n'),
    );
    const typing = room.typing.map((id) => this.name(id)).filter(Boolean);
    this.typing.setText(typing.length ? t.typing(typing.join(', ')) : '');
    this.renderPad();
  }

  private renderPad() {
    const t = this.t;
    const s = this.stage;
    const mine = this.room.myID ? this.taps.get(this.room.myID) : undefined;
    const fill = s.kind === 'go' ? COLORS.go : s.kind === 'wait' ? COLORS.wait : COLORS.panel;
    this.pad.setFillStyle(fill);
    this.pad.setStrokeStyle(4, this.playing ? 0xffffff : COLORS.line, this.playing ? 0.6 : 1);
    let label = '';
    if (s.kind === 'lobby') label = t.getReady;
    if (s.kind === 'wait') label = t.waitForIt;
    if (s.kind === 'go') label = mine !== undefined && mine >= 0 ? `${mine} ms` : 'GO!';
    if (s.kind === 'result') label = s.winner ? t.roundWinner(this.name(s.winner), s.round + 1) : t.noWinner;
    if (s.kind === 'over') label = t.gameOver(this.name(leader(this.scores)) || t.nobody);
    this.padText.setText(label).setFontSize(s.kind === 'go' && label === 'GO!' ? 64 : 26);
    this.notice.setText(mine === -1 ? t.tooEarly : '');
  }

  private setStage(s: Stage) {
    this.stage = s;
    this.render();
  }

  private clearTimers() {
    for (const timer of this.timers) timer.remove();
    this.timers = [];
  }

  private after(ms: number, fn: () => void) {
    this.timers.push(this.time.delayedCall(ms, fn));
  }

  // Every player runs the same rounds from the start event: wait, "GO!",
  // a window for taps, then the fastest valid tap scores.
  private play(game: GameStart) {
    this.clearTimers();
    this.scores = {};
    let at = 0;
    game.delays.forEach((delay, round) => {
      this.after(at, () => {
        this.taps = new Map();
        this.setStage({ kind: 'wait', round });
      });
      at += delay;
      this.after(at, () => {
        this.setStage({ kind: 'go', round, at: performance.now() });
        this.tweens.add({ targets: this.pad, scale: { from: 0.9, to: 1 }, duration: 160, ease: 'Back.Out' });
      });
      at += ROUND_WINDOW;
      this.after(at, () => {
        const winner = roundWinner(this.taps);
        if (winner) this.scores[winner] = (this.scores[winner] ?? 0) + 1;
        if (winner && winner === this.room.myID) this.sparks.explode(40);
        this.setStage({ kind: 'result', round, winner });
      });
      at += 1500;
    });
    this.after(at, () => this.setStage({ kind: 'over' }));
  }

  private record(userId: string, tap: Tap) {
    const s = this.stage;
    if ((s.kind !== 'go' && s.kind !== 'wait') || s.round !== tap.round) return;
    if (this.taps.has(userId)) return;
    this.taps.set(userId, tap.ms);
    this.renderPad();
  }

  private tap() {
    const s = this.stage;
    const me = this.room?.myID;
    if (!me || (s.kind !== 'wait' && s.kind !== 'go') || this.taps.has(me)) return;
    const mine: Tap = { round: s.round, ms: s.kind === 'go' ? Math.round(performance.now() - s.at) : -1 };
    // Client events are not echoed to the sender, so record our own tap here.
    this.room.channel.trigger(TAP_EVENT, mine);
    this.record(me, mine);
  }
}

function leader(scores: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [id, n] of Object.entries(scores)) if (best === null || n > scores[best]) best = id;
  return best;
}
