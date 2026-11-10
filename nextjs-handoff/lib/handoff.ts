// The handoff between a desktop page and a phone, on one Hibira presence
// channel, presence-handoff-<code>. The desktop page makes the code and an
// AES-GCM key and shows both in a QR code; the key sits in the link's
// #fragment, which browsers never send to a server, so Hibira and the auth
// route relay only ciphertext.
//
// Files go the fastest way open at the time:
//   direct  a WebRTC data channel between the two browsers. Hibira carries
//           only the offer, answer and ICE candidates (as client events).
//   relay   encrypted chunks as client events on the channel, paced under
//           the client event rate limit. Works on every network, including
//           the ones where WebRTC can't connect (no TURN server here).
//
// Nothing is stored anywhere: the channel only exists while both pages are
// open.
import type Pusher from 'pusher-js';
import type { PresenceChannel } from 'pusher-js';

export const CHANNEL_PREFIX = 'presence-handoff-';

export type Role = 'desk' | 'phone';
export type Transport = 'direct' | 'relay';

export interface Peer {
  id: string;
  role: Role;
  device: string;
}

export interface Incoming {
  id: string;
  name: string;
  type: string;
  size: number;
  /** A tiny blurred preview (a data: URL) to show while the file arrives. */
  thumb: string;
  /** How the first part of it arrived. */
  via: Transport;
}

export interface HandoffEvents {
  onPeer?: (peer: Peer | null) => void;
  onTransport?: (t: Transport) => void;
  onIncoming?: (file: Incoming) => void;
  onProgress?: (id: string, ratio: number) => void;
  onFile?: (id: string, blob: Blob) => void;
  /** The code is in use by two pages already, or the auth route said no. */
  onRefused?: () => void;
}

interface Options extends HandoffEvents {
  pusher: Pusher;
  code: string;
  key: CryptoKey;
  me: string;
  role: Role;
  /** Raw bytes per relayed chunk: the plan's event size limit, less the encryption and base64 overhead. */
  relayChunk?: number;
}

const DIRECT_CHUNK = 15_000;
const SIGNAL_EVENT = 'client-signal';
const DATA_EVENT = 'client-data';
// Client events are limited to 10 a second per connection (burst 10).
const RATE = 9;
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

/** A new code and key for the desktop page's QR code. */
export async function newSession(): Promise<{ code: string; key: string }> {
  return { code: b64url(crypto.getRandomValues(new Uint8Array(16))), key: b64url(crypto.getRandomValues(new Uint8Array(32))) };
}

export function validCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(code);
}

export async function importKey(key: string): Promise<CryptoKey> {
  const raw = unb64url(key);
  if (raw.length !== 32) throw new Error('bad key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** A short name for this device, like "iPhone · Safari", shown to the other side. */
export function deviceName(ua = navigator.userAgent): string {
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : 'Linux';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Line\//.test(ua)
        ? 'LINE'
        : /Firefox|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari/.test(ua)
              ? 'Safari'
              : '';
  return browser ? `${os} · ${browser}` : os;
}

export class Handoff {
  private o: Options;
  private channel: PresenceChannel;
  private peer: Peer | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private queue: (() => void)[] = [];
  private tokens = RATE;
  private timer: ReturnType<typeof setInterval>;
  private inbox = new Map<string, { n: number; got: number; parts: Uint8Array[]; type: string }>();
  private closed = false;
  // Signals are handled one at a time, so an ICE candidate never arrives
  // before the description it belongs to is set.
  private signals: Promise<void> = Promise.resolve();

  constructor(o: Options) {
    this.o = o;
    this.timer = setInterval(() => {
      this.tokens = RATE;
      this.drain();
    }, 1000);
    this.channel = o.pusher.subscribe(CHANNEL_PREFIX + o.code) as PresenceChannel;
    this.channel.bind('pusher:subscription_succeeded', () => {
      this.channel.members.each((m: { id: string; info: { role: Role; device: string } }) => {
        if (m.id !== o.me) this.setPeer({ id: m.id, ...m.info });
      });
    });
    this.channel.bind('pusher:subscription_error', () => o.onRefused?.());
    this.channel.bind('pusher:member_added', (m: { id: string; info: { role: Role; device: string } }) => this.setPeer({ id: m.id, ...m.info }));
    this.channel.bind('pusher:member_removed', (m: { id: string }) => {
      if (this.peer?.id === m.id) this.setPeer(null);
    });
    this.channel.bind(SIGNAL_EVENT, (d: { d: string }) => {
      const f = this.open(d.d);
      this.signals = this.signals
        .then(() => f)
        .then((x) => (x ? this.signal(x.head) : undefined))
        .catch(() => {});
    });
    this.channel.bind(DATA_EVENT, (d: { d: string }) => this.open(d.d).then((f) => f && this.frame(f.head, f.body, 'relay')));
  }

  /** Sends a file to the other side. Resolves when the last byte has left. */
  async send(file: Blob, name: string, thumb: string): Promise<void> {
    const id = b64url(crypto.getRandomValues(new Uint8Array(6)));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const direct = this.dc?.readyState === 'open';
    const size = direct ? DIRECT_CHUNK : (this.o.relayChunk ?? 2700);
    const n = Math.max(1, Math.ceil(bytes.length / size));
    await this.post({ t: 'start', id, name, type: file.type, size: bytes.length, n, thumb });
    for (let i = 0; i < n; i++) {
      await this.post({ t: 'chunk', id, i }, bytes.subarray(i * size, (i + 1) * size));
    }
  }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    this.pc?.close();
    this.o.pusher.unsubscribe(this.channel.name);
  }

  private setPeer(peer: Peer | null) {
    this.peer = peer;
    this.pc?.close();
    this.pc = null;
    this.dc = null;
    this.o.onPeer?.(peer);
    this.o.onTransport?.('relay');
    // The desktop page starts the WebRTC connection when a phone joins.
    if (peer && this.o.role === 'desk' && typeof RTCPeerConnection !== 'undefined') this.connect(true);
  }

  private connect(offerer: boolean) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    pc.onicecandidate = (e) => e.candidate && this.whisper({ t: 'ice', c: e.candidate.toJSON() });
    const useChannel = (dc: RTCDataChannel) => {
      dc.binaryType = 'arraybuffer';
      dc.onopen = () => {
        if (this.pc !== pc) return;
        this.dc = dc;
        this.o.onTransport?.('direct');
      };
      dc.onclose = () => {
        if (this.dc === dc) {
          this.dc = null;
          this.o.onTransport?.('relay');
        }
      };
      dc.onmessage = (e) =>
        this.decrypt(new Uint8Array(e.data as ArrayBuffer)).then((f) => f && this.frame(f.head, f.body, 'direct'));
    };
    if (offerer) {
      useChannel(pc.createDataChannel('files', { ordered: true }));
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => this.whisper({ t: 'sdp', d: pc.localDescription }))
        .catch(() => {});
    } else {
      pc.ondatachannel = (e) => useChannel(e.channel);
    }
  }

  private async signal(m: Record<string, unknown>) {
    if (m.t === 'sdp') {
      const desc = m.d as RTCSessionDescriptionInit;
      if (desc.type === 'offer') this.connect(false);
      const pc = this.pc;
      if (!pc) return;
      await pc.setRemoteDescription(desc).catch(() => {});
      if (desc.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer()).catch(() => {});
        this.whisper({ t: 'sdp', d: pc.localDescription });
      }
    } else if (m.t === 'ice') {
      await this.pc?.addIceCandidate(m.c as RTCIceCandidateInit).catch(() => {});
    }
  }

  private frame(head: Record<string, unknown>, body: Uint8Array, via: Transport) {
    const id = String(head.id ?? '');
    if (head.t === 'start') {
      const n = Number(head.n);
      if (!(n > 0 && n < 10_000)) return;
      this.inbox.set(id, { n, got: 0, parts: new Array(n), type: String(head.type ?? '') });
      this.o.onIncoming?.({ id, name: String(head.name ?? ''), type: String(head.type ?? ''), size: Number(head.size), thumb: String(head.thumb ?? ''), via });
    } else if (head.t === 'chunk') {
      const f = this.inbox.get(id);
      const i = Number(head.i);
      if (!f || !(i >= 0 && i < f.n) || f.parts[i]) return;
      f.parts[i] = body;
      f.got++;
      this.o.onProgress?.(id, f.got / f.n);
      if (f.got === f.n) {
        this.inbox.delete(id);
        this.o.onFile?.(id, new Blob(f.parts as BlobPart[], { type: f.type }));
      }
    }
  }

  // A file frame goes over the data channel when it is open, else as a
  // paced client event.
  private async post(head: Record<string, unknown>, body = new Uint8Array()) {
    const sealed = await this.seal(head, body);
    const dc = this.dc;
    if (dc?.readyState === 'open') {
      while (dc.bufferedAmount > 1 << 20) await new Promise((r) => setTimeout(r, 20));
      dc.send(sealed);
      return;
    }
    await this.paced(() => this.channel.trigger(DATA_EVENT, { d: b64url(sealed) }));
  }

  private whisper(head: Record<string, unknown>) {
    this.seal(head, new Uint8Array()).then((sealed) => this.paced(() => this.channel.trigger(SIGNAL_EVENT, { d: b64url(sealed) })));
  }

  private paced(send: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(() => {
        if (!this.closed) send();
        resolve();
      });
      this.drain();
    });
  }

  private drain() {
    while (this.tokens > 0 && this.queue.length) {
      this.tokens--;
      this.queue.shift()!();
    }
  }

  // A frame is [4-byte header length][header JSON][body], AES-GCM sealed
  // with a fresh 12-byte IV in front.
  private async seal(head: Record<string, unknown>, body: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    const h = new TextEncoder().encode(JSON.stringify(head));
    const plain = new Uint8Array(4 + h.length + body.length);
    new DataView(plain.buffer).setUint32(0, h.length);
    plain.set(h, 4);
    plain.set(body, 4 + h.length);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.o.key, plain));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return out;
  }

  private open(data: string) {
    try {
      return this.decrypt(unb64url(data));
    } catch {
      return Promise.resolve(null);
    }
  }

  private async decrypt(sealed: Uint8Array<ArrayBuffer>): Promise<{ head: Record<string, unknown>; body: Uint8Array } | null> {
    try {
      const plain = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.subarray(0, 12) }, this.o.key, sealed.subarray(12)),
      );
      const len = new DataView(plain.buffer).getUint32(0);
      return { head: JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + len))), body: plain.subarray(4 + len) };
    } catch {
      return null;
    }
  }
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
