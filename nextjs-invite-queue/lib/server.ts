import { InviteQueue, MemoryStorage } from './invite-queue.js';
import { configured, hibira } from './hibira';

// This app's own server: the queue in memory (it starts empty on every
// restart), events through your Hibira app, and the email codes printed in
// the terminal instead of sent. Hibira's hosted demo runs the same
// lib/invite-queue.js in a Durable Object and sends real email.

const PRODUCTS = [
  { id: 'claude-code', name: 'Claude Code', icon: 'claude-code.png' },
  { id: 'cursor', name: 'Cursor', icon: 'cursor.png' },
  { id: 'lovable', name: 'Lovable', icon: 'lovable.png' },
];

function products(): { id: string; name: string; icon?: string }[] {
  try {
    const list = JSON.parse(process.env.INVITE_PRODUCTS || 'null');
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  return PRODUCTS;
}

const g = globalThis as unknown as { inviteQueue?: InviteQueue; inviteTimer?: ReturnType<typeof setInterval> };

export function queue(): InviteQueue {
  if (!g.inviteQueue) {
    g.inviteQueue = new InviteQueue({
      storage: new MemoryStorage(),
      products: products(),
      admins: (process.env.INVITE_ADMINS ?? '').split(','),
      siteUrl: process.env.INVITE_SITE_URL || 'http://localhost:3000/',
      publish: async (channel: string, event: string, data: unknown) => {
        if (configured()) await hibira().trigger(channel, event, data);
      },
      sendMail: async (m: { to: string; kind: string; code?: string; product?: string }) => {
        if (m.kind === 'code') console.log(`\n[invite-queue] email code for ${m.to}: ${m.code}\n`);
        else console.log(`\n[invite-queue] ${m.to}: your turn for ${m.product}\n`);
      },
      // With Turnstile keys set, an email code needs Cloudflare's bot check.
      verifyHuman: process.env.TURNSTILE_SECRET_KEY ? verifyTurnstile : undefined,
    });
    // Offers that run out move on even when nobody calls the API.
    g.inviteTimer ??= setInterval(() => g.inviteQueue?.tick().catch(console.error), 30_000);
  }
  return g.inviteQueue;
}

export function bearer(request: Request): string {
  const h = request.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY ?? '', response: token });
  if (ip) form.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean };
  return data.success === true;
}
