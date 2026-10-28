'use client';

import { useState } from 'react';
import type { ChatMessage, Room } from '@hibira-io/lobby';
import { useT } from './I18n';
import type { Info } from './useRoom';

/**
 * The room's chat (@hibira-io/lobby). `onSubmit` takes over what is typed,
 * as draw & guess does with guesses; `system` lines are the game's own.
 */
export default function Chat({
  room,
  placeholder,
  onSubmit,
  system = [],
}: {
  room: Room<Info>;
  placeholder?: string;
  onSubmit?: (text: string) => void;
  system?: { id: string; text: string; at: number }[];
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const lines = [
    ...room.messages.map((m: ChatMessage<Info>) => ({ id: m.id, at: m.at, mine: m.mine, name: m.info?.name ?? t.player, text: m.text })),
    ...system.map((s) => ({ ...s, mine: false, name: '' })),
  ].sort((a, b) => a.at - b.at);
  const typing = room.typing.map((id) => room.players.find((p) => p.id === id)?.info?.name).filter(Boolean);

  return (
    <section className="card chat">
      <h2>{t.chat}</h2>
      <ul className="messages">
        {lines.map((m) => (
          <li key={m.id} className={m.name ? (m.mine ? 'mine' : undefined) : 'system'}>
            {m.name && <strong>{m.name}</strong>} {m.text}
          </li>
        ))}
      </ul>
      <p className="muted small typing">{typing.length > 0 && `${typing.join(', ')} …`}</p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          if (onSubmit) onSubmit(text);
          else room.send(text);
          setDraft('');
        }}
      >
        <input
          aria-label={t.message}
          placeholder={placeholder ?? t.saySomething}
          value={draft}
          maxLength={200}
          onChange={(e) => {
            setDraft(e.target.value);
            room.sendTyping();
          }}
        />
        <button type="submit">{t.send}</button>
      </form>
    </section>
  );
}
