'use client';

import { useEffect, useRef, useState } from 'react';
import type { Channel, PresenceChannel } from 'pusher-js';
import GameHeader from './GameHeader';
import { useT } from './I18n';
import { connect, type Config } from '@/lib/connect';
import { CANVAS_CHANNEL } from '@/lib/games';
import {
  BOARD_EVENT, decode, encode, INK, PAINT_EVENT, PALETTE, REFILL_MS, SIZE, validPaint, welcomeBoard, type Paint,
} from '@/lib/canvas';

const CELL = 16;

interface Members {
  me: { id: string };
  count: number;
  each: (fn: (m: { id: string }) => void) => void;
}

export default function Canvas({ config }: { config: Config }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const board = useRef(welcomeBoard());
  const channelRef = useRef<PresenceChannel | null>(null);
  const flashes = useRef(new Map<number, number>());
  const [painters, setPainters] = useState(0);
  const [color, setColor] = useState(5);
  const [ink, setInk] = useState(INK);
  const [notice, setNotice] = useState('');
  const inkRef = useRef(ink);
  inkRef.current = ink;

  useEffect(() => {
    const pusher = connect(config, 'canvas', true);
    const channel = pusher.subscribe(CANVAS_CHANNEL) as PresenceChannel;
    channelRef.current = channel;
    let synced = false;
    const members = () => channel.members as unknown as Members;

    channel.bind('pusher:subscription_succeeded', (m: Members) => {
      setPainters(m.count);
      if (m.count === 1) synced = true;
    });
    channel.bind('pusher:subscription_error', () => setNotice(t.demoUnavailable));
    // The member with the lowest ID sends the board to each newcomer.
    channel.bind('pusher:member_added', (added: { id: string }) => {
      setPainters(members().count);
      let lowest: string | null = null;
      members().each((m) => {
        if (m.id !== added.id && (lowest === null || m.id < lowest)) lowest = m.id;
      });
      if (lowest === members().me.id) {
        (channel as Channel).trigger(BOARD_EVENT, { to: added.id, board: encode(board.current) });
      }
    });
    channel.bind('pusher:member_removed', () => setPainters(members().count));
    channel.bind(BOARD_EVENT, (data: { to: string; board: string }) => {
      const next = decode(data?.board ?? '');
      if (synced || data?.to !== members().me.id || !next) return;
      synced = true;
      board.current = next;
      draw();
    });
    channel.bind(PAINT_EVENT, (p: Paint) => {
      if (!validPaint(p)) return;
      board.current[p.i] = p.c;
      flashes.current.set(p.i, performance.now());
      draw();
      setTimeout(draw, 700);
    });
    draw();
    return () => pusher.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // One pixel of ink comes back every second.
  useEffect(() => {
    const timer = setInterval(() => setInk((n) => Math.min(INK, n + 1)), REFILL_MS);
    return () => clearInterval(timer);
  }, []);

  function draw() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const now = performance.now();
    for (let i = 0; i < SIZE * SIZE; i++) {
      ctx.fillStyle = PALETTE[board.current[i]];
      ctx.fillRect((i % SIZE) * CELL, Math.floor(i / SIZE) * CELL, CELL, CELL);
    }
    // Pixels others just placed get a short outline.
    ctx.lineWidth = 2;
    for (const [i, at] of flashes.current) {
      if (now - at > 600) {
        flashes.current.delete(i);
        continue;
      }
      ctx.strokeStyle = board.current[i] === 3 ? '#ffffff' : '#222222';
      ctx.strokeRect((i % SIZE) * CELL + 1, Math.floor(i / SIZE) * CELL + 1, CELL - 2, CELL - 2);
    }
  }

  const last = useRef(-1);

  function paintAt(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const i = y * SIZE + x;
    if (i === last.current) return;
    last.current = i;
    const channel = channelRef.current;
    if (!channel?.subscribed || inkRef.current <= 0 || board.current[i] === color) return;
    board.current[i] = color;
    // Client events are not echoed to the sender, so draw our own pixel here.
    (channel as Channel).trigger(PAINT_EVENT, { i, c: color } satisfies Paint);
    inkRef.current -= 1;
    setInk(inkRef.current);
    draw();
  }

  return (
    <main className="page">
      <GameHeader title={t.canvasTitle} intro={t.canvasHelp} />
      <div className="canvas-layout">
        <canvas
          ref={canvasRef}
          className="pixels"
          width={SIZE * CELL}
          height={SIZE * CELL}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            last.current = -1;
            paintAt(e);
          }}
          onPointerMove={(e) => e.buttons === 1 && paintAt(e)}
        />
        <aside className="card">
          <p className="painters">{painters > 0 && t.painters(painters)}</p>
          <div className="palette" role="radiogroup">
            {PALETTE.map((c, n) => (
              <button
                key={c}
                role="radio"
                aria-checked={n === color}
                aria-label={t.color(n + 1)}
                title={t.color(n + 1)}
                className={n === color ? 'swatch on' : 'swatch'}
                style={{ background: c }}
                onClick={() => setColor(n)}
              />
            ))}
          </div>
          <div className="ink" aria-label={`${t.ink} ${ink} / ${INK}`}>
            <span className="muted small">{t.ink}</span>
            {Array.from({ length: INK }, (_, n) => (
              <span key={n} className={n < ink ? 'drop full' : 'drop'} style={n < ink ? { background: PALETTE[color] } : undefined} />
            ))}
          </div>
          {notice && <p className="notice">{notice}</p>}
          <p className="muted small">{t.canvasNote}</p>
        </aside>
      </div>
    </main>
  );
}
