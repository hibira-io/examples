import { InviteQueue, MemoryStorage } from './invite-queue.js';
import { configured, hibira } from './hibira';

// This app's own server: the queue in memory (it starts empty on every
// restart), events through your Hibira app, and the email codes printed in
// the terminal instead of sent. Hibira's hosted demo runs the same
// lib/invite-queue.js in a Durable Object and sends real email.

const PRODUCTS = [
  { id: 'app-beta', name: 'App beta invite' },
  { id: 'game-playtest', name: 'Game playtest key' },
  { id: 'testflight', name: 'TestFlight spot' },
];

function products(): { id: string; name: string }[] {
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
