'use client';

import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { Space, LockedError, type Member, type Lock } from '@hibira-io/spaces';
import { COLORS, DOC_PREFIX, SECTIONS, newCode, validCode } from '@/lib/plan';

interface Props {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
}

interface User {
  id: string;
  name: string;
  color: string;
}

type Info = { name: string };
type Profile = { color: string };
type PlanMember = Member<Info, Profile, string>;
type PlanLock = Lock<Info, Profile, string>;

interface CursorPos {
  x: number;
  y: number;
}

const NAMES = ['Aiko', 'Bao', 'Chen', 'Dara', 'Emi', 'Farid', 'Ga-eun', 'Hana', 'Indra', 'Jun'];

// The user's ID, name and color live in this browser only. A real app has a
// signed-in user instead.
function loadUser(): User {
  try {
    const saved = JSON.parse(localStorage.getItem('planner-user') ?? 'null');
    if (saved?.id && saved?.name && saved?.color) return saved;
  } catch {}
  const user = {
    id: crypto.randomUUID(),
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  localStorage.setItem('planner-user', JSON.stringify(user));
  return user;
}

// Field contents are app data, not part of the space: they travel as the
// app's own client events next to the space's.
const FIELD_EVENT = 'client-plan-field';
const STATE_EVENT = 'client-plan-state';

export default function Planner({ appKey, host, port, tls }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [code, setCode] = useState('');
  const [members, setMembers] = useState<PlanMember[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorPos>>({});
  const [locks, setLocks] = useState<Record<string, PlanLock>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(SECTIONS[0].id);
  const [following, setFollowing] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [share, setShare] = useState('');
  const spaceRef = useRef<Space<Info, Profile, string> | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef(values);
  const sendTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  valuesRef.current = values;

  useEffect(() => {
    setUser(loadUser());
    let c = new URLSearchParams(location.search).get('plan')?.toUpperCase() ?? '';
    if (!validCode(c)) {
      c = newCode();
      history.replaceState(null, '', `?plan=${c}`);
    }
    setCode(c);
    setShare(`${location.origin}${location.pathname}?plan=${c}`);
  }, []);

  useEffect(() => {
    if (!user || !code) return;
    const pusher = new Pusher(appKey, {
      cluster: 'hkg', // required by pusher-js, unused once wsHost is set
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: tls,
      enabledTransports: ['ws', 'wss'],
      channelAuthorization: {
        endpoint: '/api/hibira/auth',
        transport: 'ajax',
        params: { user_id: user.id, name: user.name },
      },
    });
    const space = Space.enter<Info, Profile, string>(pusher, DOC_PREFIX + code, {
      profile: { color: user.color },
      location: SECTIONS[0].id,
      cursorInterval: 250,
    });
    spaceRef.current = space;
    const channel = space.channel;

    const syncMembers = () => setMembers(space.members);
    space.on('ready', syncMembers);
    space.on('members', ({ joined }) => {
      syncMembers();
      // The member with the lowest ID (newcomer aside) sends the plan so far.
      if (!joined) return;
      const senders = space.members.filter((m) => m.id !== joined.id).map((m) => m.id).sort();
      if (senders[0] === space.myID) {
        setTimeout(() => channel.trigger(STATE_EVENT, { values: valuesRef.current }), 400);
      }
    });
    space.on('lock', () => setLocks(Object.fromEntries(space.locks.map((l) => [l.id, l]))));
    space.on('cursor', ({ id, x, y, hidden }) =>
      setCursors((c) => {
        const next = { ...c };
        if (hidden || x == null || y == null) delete next[id];
        else next[id] = { x, y };
        return next;
      }),
    );
    space.on('error', (err) => console.warn(err));

    channel.bind(FIELD_EVENT, (d: { field: string; value: string }) =>
      setValues((v) => ({ ...v, [d.field]: d.value })),
    );
    channel.bind(STATE_EVENT, (d: { values: Record<string, string> }) =>
      setValues((v) => ({ ...d.values, ...v })),
    );

    return () => {
      space.leave();
      pusher.disconnect();
      spaceRef.current = null;
    };
  }, [user, code, appKey, host, port, tls]);

  // Follow mode: go wherever the followed member goes.
  useEffect(() => {
    const space = spaceRef.current;
    if (!space || !following) return;
    return space.follow(following, (location, member) => {
      if (!member) setFollowing(null);
      else if (location) setTab(location);
    });
  }, [following]);

  useEffect(() => {
    spaceRef.current?.setLocation(tab);
  }, [tab]);

  function chooseTab(id: string) {
    setFollowing(null);
    setTab(id);
  }

  function onPointerMove(e: React.PointerEvent) {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return;
    spaceRef.current?.moveCursor((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }

  async function onFocus(field: string, el: HTMLInputElement | HTMLTextAreaElement) {
    const space = spaceRef.current;
    if (!space) return;
    try {
      await space.lock(field);
      setNotice('');
    } catch (err) {
      if (err instanceof LockedError) {
        el.blur();
        setNotice(`${space.member(err.holder)?.info?.name ?? 'Someone'} is editing this field.`);
      }
    }
  }

  function onChange(field: string, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    clearTimeout(sendTimers.current[field]);
    sendTimers.current[field] = setTimeout(() => spaceRef.current?.channel.trigger(FIELD_EVENT, { field, value }), 300);
  }

  const section = SECTIONS.find((s) => s.id === tab) ?? SECTIONS[0];
  const here = members.filter((m) => !m.me && m.location === tab);

  return (
    <main className="planner">
      <header>
        <div>
          <h1>Shared trip planner</h1>
          <p className="muted">
            Plan <span className="code">{code}</span>. Open{' '}
            <a href={share} target="_blank" rel="noreferrer">
              this link
            </a>{' '}
            in another tab or on your phone to plan together.
          </p>
        </div>
        <ul className="avatars" aria-label="Who's here">
          {members.map((m) => (
            <li key={m.id}>
              <button
                className={`avatar${following === m.id ? ' following' : ''}`}
                style={{ background: m.profile.color }}
                disabled={m.me}
                title={m.me ? `${m.info?.name} (you)` : `Follow ${m.info?.name}`}
                onClick={() => setFollowing(following === m.id ? null : m.id)}
              >
                {m.info?.name?.[0] ?? '?'}
              </button>
            </li>
          ))}
        </ul>
      </header>

      {following && (
        <p className="notice">
          Following {members.find((m) => m.id === following)?.info?.name}.{' '}
          <button className="link" onClick={() => setFollowing(null)}>
            Stop
          </button>
        </p>
      )}

      <nav className="tabs">
        {SECTIONS.map((s) => {
          const people = members.filter((m) => !m.me && m.location === s.id);
          return (
            <button key={s.id} className={s.id === tab ? 'active' : ''} onClick={() => chooseTab(s.id)}>
              {s.label}
              {people.map((m) => (
                <span key={m.id} className="dot" style={{ background: m.profile.color }} />
              ))}
            </button>
          );
        })}
      </nav>

      <div
        className="board card"
        ref={boardRef}
        onPointerMove={onPointerMove}
        onPointerLeave={() => spaceRef.current?.hideCursor()}
      >
        {section.fields.map((f) => {
          const lock = locks[f.id];
          const other = lock && !lock.mine ? lock.member : null;
          const props = {
            value: values[f.id] ?? '',
            readOnly: !!other,
            onFocus: (e: React.FocusEvent<HTMLInputElement & HTMLTextAreaElement>) => onFocus(f.id, e.currentTarget),
            onBlur: () => spaceRef.current?.unlock(f.id),
            onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(f.id, e.target.value),
            style: other ? { outline: `2px solid ${other.profile.color}` } : undefined,
          };
          return (
            <label key={f.id} className="field">
              <span>
                {f.label}
                {other && (
                  <em className="editing" style={{ background: other.profile.color }}>
                    {other.info?.name} is editing
                  </em>
                )}
              </span>
              {f.multiline ? <textarea rows={4} {...props} /> : <input {...props} />}
            </label>
          );
        })}

        {here.map((m) =>
          cursors[m.id] ? (
            <div
              key={m.id}
              className="cursor"
              style={{ left: `${cursors[m.id].x * 100}%`, top: `${cursors[m.id].y * 100}%`, color: m.profile.color }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M1 1l5 14 2-6 6-2z" fill="currentColor" stroke="#fff" strokeWidth="1" />
              </svg>
              <span style={{ background: m.profile.color }}>{m.info?.name}</span>
            </div>
          ) : null,
        )}
      </div>

      {notice && <p className="notice">{notice}</p>}
      <p className="muted small">
        Click someone&apos;s avatar to follow them between sections. A field someone is typing in is locked for
        everyone else until they leave it.
      </p>
    </main>
  );
}
